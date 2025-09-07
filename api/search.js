import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone();
const indexName = 'imitune-search';
const index = pinecone.index(indexName);

export default async function handler(req, res) {
  // Always set permissive CORS. (You can later replace '*' with a concrete origin.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { embedding } = req.body;
    if (!embedding || !Array.isArray(embedding)) {
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

  return res.status(200).json({ results });

  } catch (error) {
    console.error('An error occurred:', error);
  return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
  }
}

