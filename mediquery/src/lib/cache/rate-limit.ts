import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/cache/redis'

// 20 queries per user per 24-hour sliding window
export const queryRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '24 h'),
  prefix: 'mediquery:query',
})
