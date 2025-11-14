import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
// Upstash automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env
let redis;
let searchRateLimiter;
let feedbackRateLimiter;

try {
  redis = Redis.fromEnv();
  
  // Search API: 10 requests per minute per IP
  searchRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:search',
  });

  // Feedback API: 10 submissions per hour per IP
  feedbackRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'ratelimit:feedback',
  });
} catch (error) {
  console.warn('Rate limiting not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
}

/**
 * Get client IP from request, handling Vercel's forwarded headers
 */
export function getClientIp(req) {
  // Vercel sets x-forwarded-for with the real client IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  // Fallback to x-real-ip
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  // Last resort: connection remote address (usually not useful in serverless)
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Check rate limit for search API
 * @param {string} identifier - Usually the IP address
 * @returns {Promise<{success: boolean, limit: number, remaining: number, reset: number}>}
 */
export async function checkSearchRateLimit(identifier) {
  if (!searchRateLimiter) {
    // If rate limiting is not configured, allow all requests
    console.warn('Rate limiter not initialized, allowing request');
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  
  return await searchRateLimiter.limit(identifier);
}

/**
 * Check rate limit for feedback API
 * @param {string} identifier - Usually the IP address
 * @returns {Promise<{success: boolean, limit: number, remaining: number, reset: number}>}
 */
export async function checkFeedbackRateLimit(identifier) {
  if (!feedbackRateLimiter) {
    // If rate limiting is not configured, allow all requests
    console.warn('Rate limiter not initialized, allowing request');
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  
  return await feedbackRateLimiter.limit(identifier);
}

/**
 * Apply rate limit headers to response
 */
export function setRateLimitHeaders(res, rateLimit) {
  res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.reset.toString());
}
