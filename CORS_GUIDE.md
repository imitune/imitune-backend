# CORS Origin Validation Guide

## What Changed

Previously, your APIs used `Access-Control-Allow-Origin: *` which allowed **any website** to call your API.

Now, only **trusted origins** can access your API:
- ✅ Your production website: `https://thatsoundslike.me`
- ✅ Local development: `http://localhost:5173`, etc.
- ✅ Vercel preview deployments: `*.vercel.app`
- ❌ Random websites: Blocked with 403 error

## Security Benefits

### Before (CORS: `*`):
- ❌ Any website could embed your API and use your Pinecone quota
- ❌ Malicious sites could scrape your service
- ❌ No control over who uses your backend

### After (CORS validation):
- ✅ Only your website can use the API
- ✅ Blocks unauthorized third-party usage
- ✅ Reduces attack surface for bots
- ✅ Protects your API quotas and costs

## How It Works

1. **Browser sends request** with `Origin: https://thatsoundslike.me`
2. **Server checks** if origin is in allowed list (`api/utils/cors.js`)
3. **If allowed:** Sets `Access-Control-Allow-Origin: https://thatsoundslike.me`
4. **If blocked:** Returns `403 Forbidden` with no CORS headers
5. **Browser enforces** - blocks response if CORS headers don't match

## Allowed Origins (Configured)

Edit `api/utils/cors.js` to modify allowed origins:

```javascript
const ALLOWED_ORIGINS = [
  // Production
  'https://thatsoundslike.me',
  'https://www.thatsoundslike.me',
  
  // GitHub Pages
  'https://imitune.github.io',
  
  // Vercel previews (regex pattern)
  /^https:\/\/.*\.vercel\.app$/,
  
  // Local development
  'http://localhost:5173',  // Vite
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  // ... more as needed
];
```

## Testing CORS

### Test Locally:

```bash
cd test
python3 test_cors.py
```

This will test:
- ✅ Allowed origins are accepted
- ❌ Blocked origins are rejected
- ✅ CORS headers are set correctly
- ✅ Preflight requests work

### Test from Browser:

1. Open your website: `https://thatsoundslike.me`
2. Open DevTools → Network tab
3. Record audio and search
4. Check the request headers:
   - Request: `Origin: https://thatsoundslike.me`
   - Response: `Access-Control-Allow-Origin: https://thatsoundslike.me`

### Test Blocking:

Try accessing from a different domain (this should fail):
```javascript
// Open DevTools console on any other website
fetch('https://your-backend.vercel.app/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ embedding: [0.1, 0.2, ...] })
})
// Should get CORS error: "Origin not allowed"
```

## Common Issues & Solutions

### Issue: "Origin not allowed" on legitimate site

**Cause:** Your origin isn't in the allowed list

**Solution:** Add it to `ALLOWED_ORIGINS` in `api/utils/cors.js`:
```javascript
const ALLOWED_ORIGINS = [
  // ... existing origins
  'https://your-new-domain.com',
];
```

### Issue: Works locally but not in production

**Cause:** Production URL not in allowed origins

**Solution:** Add your production domain:
```javascript
const ALLOWED_ORIGINS = [
  'https://thatsoundslike.me',  // Make sure this matches exactly
  'https://www.thatsoundslike.me',  // Include www variant if you use it
];
```

### Issue: Vercel preview deployments blocked

**Cause:** Preview URL doesn't match pattern

**Solution:** The regex `/^https:\/\/.*\.vercel\.app$/` should match all Vercel previews. If you have a custom pattern, adjust:
```javascript
// For specific preview pattern
/^https:\/\/imitune-.*\.vercel\.app$/,
```

### Issue: API works in Postman but not browser

**Explanation:** This is normal! Postman doesn't send `Origin` headers like browsers do, so it bypasses CORS. Browsers enforce CORS for security.

**Solution:** Test with the Python script or from your actual website.

## Environment-Specific Configuration

If you want different origins for dev vs production:

```javascript
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' 
  ? [
      // Production only
      'https://thatsoundslike.me',
    ]
  : [
      // Development: allow localhost
      'http://localhost:5173',
      'http://localhost:3000',
    ];
```

