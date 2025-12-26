import { Pinecone } from '@pinecone-database/pinecone';
import { handleCorsPreflightAndValidate } from './utils/cors.js';
import { checkSearchRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

const indexName = 'imitune-search';

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
    // Initialize Pinecone client on each request to ensure fresh connection
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(indexName);
    
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
    console.error('An error occurred:', error);
  return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}

