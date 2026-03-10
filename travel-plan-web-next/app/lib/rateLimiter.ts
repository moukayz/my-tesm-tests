import { Redis } from '@upstash/redis'

const MAX_FAILURES = 5
const BLOCK_TTL_SECONDS = 60
const FAILURES_TTL_SECONDS = 300

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const failuresKey = (ip: string) => `login:failures:${ip}`
export const blockedKey = (ip: string) => `login:blocked:${ip}`

export async function checkRateLimit(ip: string): Promise<{ blocked: boolean; retryAfter?: number }> {
  if (!redis) return { blocked: false }
  try {
    const ttl = await redis.ttl(blockedKey(ip))
    if (ttl > 0) {
      return { blocked: true, retryAfter: ttl }
    }
  } catch {
    // Redis unavailable — fail open
  }
  return { blocked: false }
}

export async function recordFailure(ip: string): Promise<void> {
  if (!redis) return
  try {
    const failures = await redis.incr(failuresKey(ip))
    await redis.expire(failuresKey(ip), FAILURES_TTL_SECONDS)
    if (failures >= MAX_FAILURES) {
      await redis.set(blockedKey(ip), '1', { ex: BLOCK_TTL_SECONDS })
    }
  } catch {
    // Redis unavailable — skip recording
  }
}

export async function recordSuccess(ip: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(failuresKey(ip), blockedKey(ip))
  } catch {
    // Redis unavailable — skip
  }
}
