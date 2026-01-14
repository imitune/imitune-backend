import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { handleCorsPreflightAndValidate } from './utils/cors.js';
import { checkFeedbackRateLimit, getClientIp, setRateLimitHeaders } from './utils/ratelimit.js';

export default async function handler(req, res) {
  // SECURITY: Validate origin and set CORS headers
  const corsHandled = handleCorsPreflightAndValidate(req, res, {
    methods: 'POST,OPTIONS',
  });
  if (corsHandled) return; // Either preflight response sent or origin blocked
  
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
  
  try {
    const { audioQuery, audioId, freesound_urls, ratings } = req.body;

    // Validate required fields (either audioQuery OR audioId must be provided)
    if (!freesound_urls || !ratings) {
      return res.status(400).json({ error: 'Missing required fields: freesound_urls, ratings' });
    }
    
    if (!audioQuery && !audioId) {
      return res.status(400).json({ error: 'Either audioQuery or audioId must be provided' });
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

    let uniqueId;
    let blobAudioUrl;
    
    // Handle update scenario (audioId provided)
    if (audioId) {
      console.log(`[Feedback] Update request for audioId: ${audioId}`);
      uniqueId = audioId;
      // We don't have the audio URL stored, but we can construct a placeholder
      // The client doesn't really need this for updates
      blobAudioUrl = `existing-audio-${audioId}`;
    } else {
      // Handle new submission scenario (audioQuery provided)
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

      // --- Upload Audio to Vercel Blob ---
      uniqueId = uuidv4();
      const audioBuffer = Buffer.from(base64Data, 'base64');
      const audioFileName = `feedback-audio-${uniqueId}.webm`;
      
      console.log(`[Feedback] Attempting to upload audio file: ${audioFileName}, size: ${audioBuffer.length} bytes`);
      
      // Upload audio file as public (required by Blob store configuration)
      // Note: Random suffix is added by default to make URLs unguessable
      const uploadResult = await put(audioFileName, audioBuffer, {
        access: 'public',
        contentType: contentType,
        addRandomSuffix: true, // Explicit: adds random suffix to prevent URL guessing
      });
      blobAudioUrl = uploadResult.url;
      
      console.log(`[Feedback] Successfully uploaded audio to: ${blobAudioUrl}`);
    }

    // --- Store Metadata as JSON file in Vercel Blob ---
    const metadataFileName = `feedback-meta-${uniqueId}.json`;

    const metadata = {
      audioUrl: blobAudioUrl,
      audioId: uniqueId,  // Unique identifier for the audio query
      freesound_urls: freesound_urls, // Store as array
      ratings: ratings, // Store as array
      createdAt: new Date().toISOString(),
      isUpdate: !!audioId, // Flag to indicate if this is an update
    };

    // Upload metadata JSON file
    // Note: Random suffix is added by default to make URLs unguessable
    const { url: blobMetaUrl } = await put(metadataFileName, JSON.stringify(metadata, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true, // Explicit: adds random suffix to prevent URL guessing
    });
    console.log(`[Feedback] Successfully uploaded metadata to: ${blobMetaUrl}`);

    // --- 3. Send Success Response ---
  return res.status(200).json({ 
      message: 'Feedback submitted successfully', 
      audioId: uniqueId,
      audioUrl: blobAudioUrl,
      metadataUrl: blobMetaUrl
    });

  } catch (error) {
    console.error('[Feedback] Error occurred while handling feedback:', error);
    console.error('[Feedback] Error name:', error?.name);
    console.error('[Feedback] Error message:', error?.message);
    console.error('[Feedback] Error stack:', error?.stack);
    
    // Provide more specific error messages for common issues
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error?.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      errorMessage = 'Storage configuration error. Please contact support.';
      console.error('[Feedback] CRITICAL: Vercel Blob token not configured!');
    } else if (error?.name === 'BlobError' || error?.message?.includes('blob')) {
      errorMessage = 'Failed to store feedback. Please try again.';
      console.error('[Feedback] Blob storage error:', error);
    }
    
    return res.status(statusCode).json({ error: errorMessage });
  }
}
