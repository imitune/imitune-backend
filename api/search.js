import { handleCorsPreflightAndValidate } from './utils/cors.js';
import { checkSearchRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

// Pinecone configuration from environment variables
// PINECONE_INDEX_HOST bypasses the control plane lookup for faster, more reliable queries
const apiKey = process.env.PINECONE_API_KEY;
const defaultIndexHost = process.env.PINECONE_INDEX_HOST;
const devModeEnabled = process.env.ENABLE_DEV_MODE === 'true';
const TOP_K_MATCHES = 4;

function normalizeHost(host) {
  return host.startsWith('https://') ? host : `https://${host}`;
}

function parseRequestedIndexes(indexes) {
  if (!indexes) return [];
  if (!Array.isArray(indexes)) return null;

  const normalizedIndexes = indexes
    .filter(indexId => typeof indexId === 'string')
    .map(indexId => indexId.trim())
    .filter(Boolean);

  return normalizedIndexes;
}

function getDevIndexConfigs() {
  const rawJson = process.env.PINECONE_DEV_INDEXES_JSON;
  if (!rawJson) {
    throw new Error('PINECONE_DEV_INDEXES_JSON is not configured');
  }

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(rawJson);
  } catch (error) {
    throw new Error('PINECONE_DEV_INDEXES_JSON contains invalid JSON');
  }

  if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
    throw new Error('PINECONE_DEV_INDEXES_JSON must be an object keyed by index id');
  }

  const configuredOrder = (process.env.PINECONE_DEV_INDEX_ORDER || '')
    .split(',')
    .map(indexId => indexId.trim())
    .filter(Boolean);
  const orderedIds = configuredOrder.length ? configuredOrder : Object.keys(parsedConfig);

  return orderedIds.map(indexId => {
    const rawEntry = parsedConfig[indexId];
    if (!rawEntry) {
      throw new Error(`PINECONE_DEV_INDEX_ORDER references unknown index: ${indexId}`);
    }

    if (typeof rawEntry === 'string') {
      return {
        indexId,
        indexLabel: indexId,
        host: rawEntry,
      };
    }

    if (typeof rawEntry === 'object' && !Array.isArray(rawEntry) && typeof rawEntry.host === 'string') {
      return {
        indexId,
        indexLabel: typeof rawEntry.label === 'string' && rawEntry.label.trim() ? rawEntry.label.trim() : indexId,
        host: rawEntry.host,
      };
    }

    throw new Error(`Invalid dev index config for ${indexId}`);
  });
}

async function queryIndex({ host, indexId, indexLabel }, embedding) {
  let response;
  try {
    response = await fetch(`${normalizeHost(host)}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topK: TOP_K_MATCHES,
        vector: embedding,
        includeMetadata: true,
      }),
    });
  } catch (e) {
    throw new Error(`Pinecone network error for ${indexId}: ${e.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinecone API error for ${indexId}: ${response.status} - ${errorText}`);
  }

  const queryResponse = await response.json();
  const results = (queryResponse.matches || []).map(match => ({
    id: match.id,
    score: match.score,
    freesound_url: match.metadata?.freesound_url || '',
  }));

  return {
    indexId,
    indexLabel,
    results,
    error: null,
  };
}

export default async function handler(req, res) {
  // SECURITY: Validate origin and set CORS headers
  const corsHandled = handleCorsPreflightAndValidate(req, res, {
    methods: 'POST,OPTIONS',
  });
  if (corsHandled) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // SECURITY: Rate limiting - 10 requests per minute per IP
    const clientIp = getClientIp(req);
    const rateLimit = await checkSearchRateLimit(clientIp);
    setRateLimitHeaders(res, rateLimit);
    
    if (!rateLimit.success) {
      console.log(`[Search] Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000)
      });
    }
    
    console.log(`[Search] Request from IP: ${clientIp}, remaining: ${rateLimit.remaining}/${rateLimit.limit}`);

    if (!apiKey) {
      console.error('[Search] ERROR: PINECONE_API_KEY not set');
      return res.status(500).json({ error: 'Server configuration error: Pinecone API key not configured' });
    }

    const { embedding } = req.body;
    const requestedMode = typeof req.body?.mode === 'string' ? req.body.mode : 'single';
    const requestedIndexes = parseRequestedIndexes(req.body?.indexes);

    if (requestedIndexes === null) {
      return res.status(400).json({ error: 'indexes must be an array of strings when provided' });
    }
    
    // SECURITY: Validate embedding exists and is an array
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'Missing or invalid embedding vector' });
    }

    // SECURITY: Validate embedding size (model outputs 960 dimensions)
    const MIN_EMBEDDING_SIZE = 32;
    const MAX_EMBEDDING_SIZE = 2048;
    if (embedding.length < MIN_EMBEDDING_SIZE || embedding.length > MAX_EMBEDDING_SIZE) {
      return res.status(400).json({ 
        error: `Invalid embedding size. Expected between ${MIN_EMBEDDING_SIZE} and ${MAX_EMBEDDING_SIZE}, got ${embedding.length}` 
      });
    }

    // SECURITY: Validate all values are valid numbers
    if (!embedding.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
      return res.status(400).json({ error: 'Embedding contains invalid values (must be finite numbers)' });
    }

    console.log(`[Search] Embedding size: ${embedding.length}`);

    const isDevRequest = requestedMode === 'dev' || requestedIndexes.length > 0;
    if (isDevRequest) {
      if (!devModeEnabled) {
        return res.status(403).json({ error: 'Dev mode is not enabled on this backend deployment' });
      }

      const availableIndexConfigs = getDevIndexConfigs();
      const selectedIndexConfigs = requestedIndexes.length
        ? requestedIndexes.map(indexId => {
            const match = availableIndexConfigs.find(config => config.indexId === indexId);
            if (!match) {
              throw new Error(`Unknown dev index requested: ${indexId}`);
            }
            return match;
          })
        : availableIndexConfigs;

      const settledRows = await Promise.allSettled(
        selectedIndexConfigs.map(config => queryIndex(config, embedding))
      );

      const rows = settledRows.map((result, index) => {
        const config = selectedIndexConfigs[index];
        if (result.status === 'fulfilled') {
          return result.value;
        }

        console.error(`[Search] Dev index query failed for ${config.indexId}:`, result.reason);
        return {
          indexId: config.indexId,
          indexLabel: config.indexLabel,
          results: [],
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      });

      return res.status(200).json({
        mode: 'multi-index',
        rows,
      });
    }

    if (!defaultIndexHost) {
      console.error('[Search] ERROR: PINECONE_INDEX_HOST not set');
      return res.status(500).json({ error: 'Server configuration error: Pinecone index host not configured' });
    }

    const defaultResult = await queryIndex({
      host: defaultIndexHost,
      indexId: 'default',
      indexLabel: 'Default',
    }, embedding);

    return res.status(200).json({ results: defaultResult.results });

  } catch (error) {
    console.error('[Search] Error occurred:', error);
    
    // Distinguish between service outages and other internal errors
    const isServiceError = error.message?.includes('Pinecone') || 
                           error.message?.includes('fetch') || 
                           error.message?.includes('network error');
    
    if (isServiceError) {
      return res.status(503).json({ 
        error: 'One of the services used seems to be down right now (Search). Please try again later.' 
      });
    }

    return res.status(500).json({ 
      error: 'An internal server error occurred. Please try again later.' 
    });
  }
}
