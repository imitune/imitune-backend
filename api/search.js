import { Pinecone } from '@pinecone-database/pinecone';

// --- CORS helper -----------------------------------------------------------
function setCors(res, origin) {
  res.setHeader('Vary', 'Origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function resolveOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return '*';
  // Allow localhost during dev + GitHub Pages deployment origin
  const allowed = [
    'http://localhost:5173',
    'http://localhost:5173/imitune-frontend', // some browsers may include path though origin strictly shouldn't
    'https://imitune.github.io'
  ];
  return allowed.includes(origin) ? origin : '*';
}

const pinecone = new Pinecone();
const indexName = 'imitune-search';
const index = pinecone.index(indexName);

export default async function handler(req, res) {
  const origin = resolveOrigin(req);
  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    setCors(res, origin);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { embedding } = req.body;
    if (!embedding || !Array.isArray(embedding)) {
      setCors(res, origin);
      return res.status(400).json({ error: 'Missing or invalid embedding vector' });
    }

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

  setCors(res, origin);
  return res.status(200).json({ results });

  } catch (error) {
    console.error('An error occurred:', error);
  setCors(res, origin);
  return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}

