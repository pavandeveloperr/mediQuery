function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  upstashRedisUrl: requireEnv('UPSTASH_REDIS_REST_URL'),
  upstashRedisToken: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
} as const
