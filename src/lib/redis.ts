import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('⚠️ Upstash Redis environment variables are missing. Rate limiting will be disabled.');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Create a new ratelimiter, that allows 10 requests per 1 minute
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});
