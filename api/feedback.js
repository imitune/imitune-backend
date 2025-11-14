import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { checkFeedbackRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // SECURITY: Rate limiting - 10 submissions per hour per IP
  const clientIp = getClientIp(req);
  const rateLimit = await checkFeedbackRateLimit(clientIp);
  setRateLimitHeaders(res, rateLimit);
  
  if (!rateLimit.success) {
    console.log(`[Feedback] Rate limit exceeded for IP: ${clientIp}`);
    return res.status(429).json({ 
      error: 'Too many feedback submissions. Please try again later.',
      retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000)
    });
  }
  
  console.log(`[Feedback] Request from IP: ${clientIp}, remaining: ${rateLimit.remaining}/${rateLimit.limit}`);

  try {
    const { audioQuery, freesound_urls, ratings } = req.body;

    // Validate required fields
  if (!audioQuery || !freesound_urls || !ratings) {
      return res.status(400).json({ error: 'Missing required fields: audioQuery, freesound_urls, ratings' });
    }

    // SECURITY: Validate data URL format and content type
    if (typeof audioQuery !== 'string' || !audioQuery.startsWith('data:audio/')) {
      return res.status(400).json({ error: 'Invalid audio format. Must be a data URL with audio MIME type.' });
    }

    // SECURITY: Validate audio MIME type (webm, wav, mp3, ogg)
    const mimeMatch = audioQuery.match(/^data:(audio\/(?:webm|wav|mp3|ogg|mpeg));base64,/);
    if (!mimeMatch) {
      return res.status(400).json({ 
        error: 'Unsupported audio format. Supported formats: webm, wav, mp3, ogg.' 
      });
    }
    const contentType = mimeMatch[1];

    // SECURITY: Extract and validate base64 data
    const base64Data = audioQuery.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: 'Invalid audio data: missing base64 content.' });
    }

    // SECURITY: Check file size (limit to 10MB)
    const sizeInBytes = (base64Data.length * 3) / 4; // Base64 to binary size estimation
    const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
    
    if (sizeInBytes > maxSizeInBytes) {
      return res.status(413).json({ 
        error: `Audio file too large. Maximum size is 10MB, received ${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB.` 
      });
    }

    // Log upload size for monitoring
    console.log(`[Feedback] Audio upload: ${(sizeInBytes / 1024).toFixed(2)}KB, type: ${contentType}`);


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
    const audioBuffer = Buffer.from(base64Data, 'base64');
    const audioFileName = `feedback-audio-${uniqueId}.webm`;
    
    // SECURITY: Upload audio file as PRIVATE (not publicly accessible)
    // Files can only be accessed with authentication or signed URLs
    const { url: blobAudioUrl } = await put(audioFileName, audioBuffer, {
      access: 'private',
      contentType: contentType,
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
    // SECURITY: Keep metadata private to protect participant information
    const { url: blobMetaUrl } = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
      access: 'private',
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
