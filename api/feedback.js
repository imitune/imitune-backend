import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // This function only accepts POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { audioQuery, freesound_url, ratings } = req.body;

    // Basic validation to ensure required fields are present
    if (!audioQuery || !freesound_url || !ratings) {
      return res.status(400).json({ error: 'Missing required fields: audioQuery, freesound_url, ratings' });
    }

    // --- 1. Upload Audio to Vercel Blob ---
    // The frontend should send the audio as a base64 encoded string.
    // We extract the base64 part and convert it to a Buffer.
    const audioBuffer = Buffer.from(audioQuery.split(',')[1], 'base64');
    const uniqueId = uuidv4();
    const audioFileName = `feedback-audio-${uniqueId}.webm`;
    
    // Upload the audio file
    const { url: blobAudioUrl } = await put(audioFileName, audioBuffer, {
      access: 'public',
      contentType: 'audio/webm',
    });
    
    console.log(`Successfully uploaded audio to: ${blobAudioUrl}`);

    // --- 2. Store Metadata as a JSON file in Vercel Blob ---
    const metadataFileName = `feedback-meta-${uniqueId}.json`;
    const metadata = {
      audioUrl: blobAudioUrl,
      targetSoundUrl: freesound_url,
      userRatings: ratings,
      createdAt: new Date().toISOString(),
    };

    // Upload the metadata JSON object as a file
    const { url: blobMetaUrl } = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });
    console.log(`Successfully uploaded metadata to: ${blobMetaUrl}`);


    // --- 3. Send Success Response ---
    return res.status(200).json({ 
      message: 'Feedback submitted successfully', 
      audioUrl: blobAudioUrl,
      metadataUrl: blobMetaUrl
    });

  } catch (error) {
    console.error('An error occurred while handling feedback:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

