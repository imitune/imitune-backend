import { Pinecone } from '@pinecone-database/pinecone';
import { handleCorsPreflightAndValidate } from './utils/cors.js';
import { checkSearchRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

const indexName = 'imitune-search';
// Index host from environment variable to bypass control plane lookup
// Set PINECONE_INDEX_HOST in Vercel environment variables
// Get the host URL from: Pinecone Dashboard -> Your Index -> Host
const indexHost = process.env.PINECONE_INDEX_HOST;

// #region agent log
console.log('[DEBUG-A] Module load - env vars:', JSON.stringify({ hasIndexHost: !!indexHost, indexHostLength: indexHost?.length, indexHostPrefix: indexHost?.substring(0, 20), hasApiKey: !!process.env.PINECONE_API_KEY, codeVersion: 'v3-correct-api' }));
// #endregion

export default async function handler(req, res) {
  // SECURITY: Validate origin and set CORS headers
  const corsHandled = handleCorsPreflightAndValidate(req, res, {
    methods: 'POST,OPTIONS',
  });
  if (corsHandled) return; // Either preflight response sent or origin blocked
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

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

  try {
    const apiKey = process.env.PINECONE_API_KEY;
    // #region agent log
    console.log('[DEBUG-B] Handler entry - env check:', JSON.stringify({ hasApiKey: !!apiKey, apiKeyLen: apiKey?.length, hasIndexHost: !!indexHost, indexHost: indexHost }));
    // #endregion
    
    // Initialize Pinecone client on each request to ensure fresh connection
    if (!apiKey) {
      console.error('[Search] ERROR: PINECONE_API_KEY environment variable is not set!');
      return res.status(500).json({ 
        error: 'Server configuration error: Pinecone API key not configured' 
      });
    }
    
    if (!indexHost) {
      // #region agent log
      console.log('[DEBUG-C] indexHost is falsy, returning error');
      // #endregion
      console.error('[Search] ERROR: PINECONE_INDEX_HOST environment variable is not set!');
      return res.status(500).json({ 
        error: 'Server configuration error: Pinecone index host not configured' 
      });
    }
    
    // #region agent log
    console.log('[DEBUG-D] About to create Pinecone client');
    // #endregion
    
    // Initialize Pinecone client and use host from environment variable to bypass control plane lookup
    const pinecone = new Pinecone({ apiKey });
    
    // #region agent log
    console.log('[DEBUG-E] Pinecone client created, about to get index with host:', indexHost);
    // #endregion
    
    // Use pinecone.index(name, host) syntax - passing host as second argument bypasses control plane
    // Ensure host has https:// prefix
    const fullHost = indexHost.startsWith('https://') ? indexHost : `https://${indexHost}`;
    
    // #region agent log
    console.log('[DEBUG-E2] Full host URL:', fullHost);
    // #endregion
    
    const index = pinecone.index(indexName, fullHost);
    
    // #region agent log
    console.log('[DEBUG-F] Index reference obtained successfully');
    // #endregion
    
    const { embedding } = req.body;
    
    // SECURITY: Validate embedding exists and is an array
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'Missing or invalid embedding vector' });
    }

    // SECURITY: Validate embedding size (adjust based on your model - common sizes: 128, 256, 512, 1024)
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

    // #region agent log
    console.log('[DEBUG-H] About to call index.query()');
    // #endregion
    
    const queryResponse = await index.query({
      topK: 3,
      vector: embedding,
      includeMetadata: true,
    });

    // Process the results to match the new required format
    const results = queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      // Retrieve the full URL directly from metadata
      freesound_url: match.metadata?.freesound_url || '',
    }));

  return res.status(200).json({ results });

  } catch (error) {
    // #region agent log
    console.log('[DEBUG-G] Error caught:', JSON.stringify({ name: error.name, message: error.message, stack: error.stack?.substring(0, 500) }));
    // #endregion
    console.error('[Search] Error occurred:', error);
    return res.status(500).json({ 
      error: 'An internal server error occurred. Please try again later.' 
    });
  }
}

