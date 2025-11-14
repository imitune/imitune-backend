/**
 * CORS (Cross-Origin Resource Sharing) utilities
 * Validates and sets CORS headers to allow only trusted origins
 */

// List of allowed origins (domains that can call your API)
const ALLOWED_ORIGINS = [
  // Production domains
  'https://thatsoundslike.me',
  'https://www.thatsoundslike.me',
  
  // GitHub Pages (if different from custom domain)
  'https://imitune.github.io',
  
  // Vercel preview deployments (adjust with your actual domain pattern)
  // Note: This regex allows all vercel.app previews - be more specific if needed
  /^https:\/\/.*\.vercel\.app$/,
  
  // Local development
  'http://localhost:5173',  // Vite default
  'http://localhost:3000',  // Common dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * Check if an origin is allowed
 * @param {string} origin - The origin header from the request
 * @returns {boolean} - True if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) {
    // No origin header (same-origin request or curl/Postman)
    return false;
  }

  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    } else if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return false;
  });
}

/**
 * Set CORS headers for a response
 * @param {Request} req - The incoming request
 * @param {Response} res - The response object
 * @param {Object} options - CORS options
 * @returns {boolean} - True if origin is allowed, false otherwise
 */
export function setCorsHeaders(req, res, options = {}) {
  const {
    methods = 'GET,POST,OPTIONS',
    headers = 'Content-Type, Authorization, X-Requested-With',
    maxAge = '86400', // 24 hours
    allowCredentials = false,
  } = options;

  const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');

  // Check if origin is allowed
  if (isOriginAllowed(origin)) {
    // Set the specific origin (not '*' to support credentials if needed)
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    if (allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    // For blocked origins, we could either:
    // 1. Not set CORS headers (browser will block)
    // 2. Set explicit origin to block
    // We'll use option 1 (don't set headers for unauthorized origins)
    console.warn(`[CORS] Blocked request from unauthorized origin: ${origin || 'unknown'}`);
    return false;
  }

  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
  res.setHeader('Access-Control-Max-Age', maxAge);
  
  return true;
}

/**
 * Handle CORS preflight (OPTIONS) requests
 * @param {Request} req 
 * @param {Response} res 
 * @returns {boolean} - True if this was a preflight that was handled
 */
export function handleCorsPreflightAndValidate(req, res, options = {}) {
  const originAllowed = setCorsHeaders(req, res, options);
  
  if (req.method === 'OPTIONS') {
    // Preflight request
    res.status(204).end();
    return true;
  }
  
  // Not a preflight, but check if origin is allowed
  if (!originAllowed) {
    const origin = req.headers.origin || req.headers.referer || 'unknown';
    res.status(403).json({ 
      error: 'Origin not allowed',
      message: `Requests from ${origin} are not permitted. Please use the official website.`
    });
    return true; // Handled (rejected)
  }
  
  return false; // Not handled, continue with request
}

/**
 * Add a new allowed origin (useful for testing or dynamic configuration)
 * @param {string|RegExp} origin - Origin to allow
 */
export function addAllowedOrigin(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ALLOWED_ORIGINS.push(origin);
    console.log(`[CORS] Added allowed origin: ${origin}`);
  }
}

/**
 * Get list of allowed origins (for debugging)
 */
export function getAllowedOrigins() {
  return ALLOWED_ORIGINS.map(o => o.toString());
}
