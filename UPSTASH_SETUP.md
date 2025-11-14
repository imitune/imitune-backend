# Upstash Redis Setup Guide for Rate Limiting

This guide walks you through setting up Upstash Redis for rate limiting your APIs.

## Step 1: Create Upstash Account

1. Go to https://upstash.com/
2. Sign up for a free account (you can use GitHub login)
3. Confirm your email

## Step 2: Create Redis Database

1. Once logged in, click **"Create Database"**
2. Configure your database:
   - **Name:** `imitune-ratelimit` (or any name you prefer)
   - **Type:** Select **Regional** (faster, free tier available)
   - **Region:** Choose closest to your Vercel deployment (e.g., `us-east-1` for US)
   - **TLS:** Keep enabled (recommended)
   
3. Click **"Create"**

## Step 3: Get Your Credentials

After creating the database, you'll see your database details page.

1. Click on the **"REST API"** tab (or look for REST API section)
2. You'll see two important values:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxx
   ```
3. **Copy these values** - you'll need them in the next step

## Step 4: Add Environment Variables to Vercel

### For Local Development:

Create `.env` file in your `imitune-backend` directory:

```bash
cd /Users/chris/dev/Personal/imitune/imitune-backend
cat > .env << 'EOF'
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxx
PINECONE_API_KEY=your_pinecone_key
BLOB_READ_WRITE_TOKEN=your_blob_token
EOF
```

Replace the values with your actual credentials.

### For Production (Vercel):

1. Go to https://vercel.com/dashboard
2. Select your project: **`imitune-backend`**
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

   **Variable 1:**
   - Name: `UPSTASH_REDIS_REST_URL`
   - Value: `https://your-db-name.upstash.io`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

   **Variable 2:**
   - Name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: `AXxxxxxxxxxxxxxxxxxxxxxx`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

5. Click **"Save"**

## Step 5: Redeploy (Production Only)

If you've already deployed to production, you need to redeploy for the environment variables to take effect:

```bash
cd /Users/chris/dev/Personal/imitune/imitune-backend
vercel --prod
```

## Step 6: Test Rate Limiting

### Local Testing:

1. Start your dev server:
   ```bash
   npm run start
   ```

2. Run the rate limit test script:
   ```bash
   cd test
   python3 test_rate_limits.py
   ```

This will test that:
- First 10 search requests succeed
- 11th request gets rate limited (429)
- First 10 feedback requests succeed
- 11th feedback request gets rate limited (429)

### Check Upstash Dashboard:

1. Go back to https://console.upstash.com
2. Click on your database
3. Go to **"Data Browser"** tab
4. You should see keys like:
   ```
   ratelimit:search:192.168.1.1
   ratelimit:feedback:192.168.1.1
   ```

## Rate Limit Configuration

Current limits (configured in `api/utils/ratelimit.js`):

| API | Limit | Window |
|-----|-------|--------|
| Search (`/api/search`) | 10 requests | per minute |
| Feedback (`/api/feedback`) | 10 submissions | per hour |

### To Adjust Limits:

Edit `/api/utils/ratelimit.js`:

```javascript
// Search API: Change first number for requests, second for time window
searchRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 per minute
  // Change to: Ratelimit.slidingWindow(20, '1 m'), // 20 per minute
  analytics: true,
  prefix: 'ratelimit:search',
});

// Feedback API
feedbackRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 per hour
  // Change to: Ratelimit.slidingWindow(5, '1 h'), // 5 per hour
  analytics: true,
  prefix: 'ratelimit:feedback',
});
```

Time windows: `'1 s'` (second), `'1 m'` (minute), `'1 h'` (hour), `'1 d'` (day)

## Monitoring Usage

### Upstash Dashboard:
- **Data Browser:** See active rate limit keys
- **Metrics:** Track command count (should stay under 500K/month)
- **Logs:** See all Redis operations

### Vercel Logs:
Check your function logs for:
```
[Search] Rate limit exceeded for IP: 123.45.67.89
[Feedback] Request from IP: 123.45.67.89, remaining: 5/10
```
