import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { audioQuery, freesound_urls, ratings } = req.body;

    // Validate required fields
  if (!audioQuery || !freesound_urls || !ratings) {
      return res.status(400).json({ error: 'Missing required fields: audioQuery, freesound_urls, ratings' });
    }

    // Check if both are arrays
    if (!Array.isArray(freesound_urls) || !Array.isArray(ratings)) {
  return res.status(400).json({ error: 'freesound_urls and ratings must be arrays' });
    }

    // Check if arrays have the same length
    if (freesound_urls.length !== ratings.length) {
  return res.status(400).json({ error: 'freesound_urls and ratings arrays must have the same length' });
    }

    // Validate rating values (like, dislike, or null only)
    for (const rating of ratings) {
      if (rating !== null && rating !== 'like' && rating !== 'dislike') {
  return res.status(400).json({ error: 'Each rating must be either "like", "dislike", or null' });
      }
    }

    // --- 1. Upload Audio to Vercel Blob ---
    // Generate unique ID for audio query
    const uniqueId = uuidv4();
    const audioBuffer = Buffer.from(audioQuery.split(',')[1], 'base64');
    const audioFileName = `feedback-audio-${uniqueId}.webm`;
    
    // Upload audio file
    const { url: blobAudioUrl } = await put(audioFileName, audioBuffer, {
      access: 'public',
      contentType: 'audio/webm',
    });
    
    console.log(`Successfully uploaded audio to: ${blobAudioUrl}`);

    // --- 2. Store Metadata as JSON file in Vercel Blob ---
    const metadataFileName = `feedback-meta-${uniqueId}.json`;

    const metadata = {
      audioUrl: blobAudioUrl,
      audioId: uniqueId,  // Unique identifier for the audio query
      freesound_urls: freesound_urls, // Store as array
      ratings: ratings, // Store as array
      createdAt: new Date().toISOString(),
    };

    // Upload metadata JSON file
    const { url: blobMetaUrl } = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });
    console.log(`Successfully uploaded metadata to: ${blobMetaUrl}`);

    // --- 3. Send Success Response ---
  return res.status(200).json({ 
      message: 'Feedback submitted successfully', 
      audioId: uniqueId,
      audioUrl: blobAudioUrl,
      metadataUrl: blobMetaUrl
    });

  } catch (error) {
    console.error('Error occurred while handling feedback:', error);
  return res.status(500).json({ error: 'Internal server error' });
  }
}
