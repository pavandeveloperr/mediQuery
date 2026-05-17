import { Redis } from '@upstash/redis'
import { env } from '@/config/env'

export const redis = new Redis({
  url: env.upstashRedisUrl,
  token: env.upstashRedisToken,
})
