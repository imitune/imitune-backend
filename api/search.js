// Using direct REST API to Pinecone to bypass SDK control plane issues
import { handleCorsPreflightAndValidate } from './utils/cors.js';
import { checkSearchRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

// #region agent log
console.error('[DEBUG-A] Module load v4-direct-api');
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
    const indexHost = process.env.PINECONE_INDEX_HOST;
    
    // #region agent log
    console.error('[DEBUG-B] Env check:', JSON.stringify({ hasApiKey: !!apiKey, hasHost: !!indexHost, hostValue: indexHost }));
    // #endregion
    
    if (!apiKey) {
      console.error('[Search] ERROR: PINECONE_API_KEY not set');
      return res.status(500).json({ error: 'Server configuration error: Pinecone API key not configured' });
    }
    
    if (!indexHost) {
      console.error('[Search] ERROR: PINECONE_INDEX_HOST not set');
      return res.status(500).json({ error: 'Server configuration error: Pinecone index host not configured' });
    }

    const { embedding } = req.body;
    
    // SECURITY: Validate embedding exists and is an array
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'Missing or invalid embedding vector' });
    }

    // SECURITY: Validate embedding size
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

    // Build the Pinecone query URL - direct to index host, bypassing control plane entirely
    const host = indexHost.startsWith('https://') ? indexHost : `https://${indexHost}`;
    const queryUrl = `${host}/query`;
    
    // #region agent log
    console.error('[DEBUG-C] About to call Pinecone REST API:', queryUrl);
    // #endregion

    // Direct REST API call to Pinecone
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topK: 3,
        vector: embedding,
        includeMetadata: true,
      }),
    });

    // #region agent log
    console.error('[DEBUG-D] Pinecone response status:', response.status);
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Search] Pinecone API error:', response.status, errorText);
      throw new Error(`Pinecone API error: ${response.status} - ${errorText}`);
    }

    const queryResponse = await response.json();

    // #region agent log
    console.error('[DEBUG-E] Query success, matches:', queryResponse.matches?.length);
    // #endregion

    // Process the results to match the new required format
    const results = (queryResponse.matches || []).map(match => ({
      id: match.id,
      score: match.score,
      freesound_url: match.metadata?.freesound_url || '',
    }));

    return res.status(200).json({ results });

  } catch (error) {
    // #region agent log
    console.error('[DEBUG-ERR] Error:', error.message);
    // #endregion
    console.error('[Search] Error occurred:', error);
    return res.status(500).json({ 
      error: 'An internal server error occurred. Please try again later.' 
    });
  }
}

