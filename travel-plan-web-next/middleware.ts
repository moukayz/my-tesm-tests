import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const blockedKey = (ip: string) => `login:blocked:${ip}`

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function middleware(request: NextRequest) {
  if (!redis) return NextResponse.next()
  try {
    const ip = getClientIp(request)
    const ttl = await redis.ttl(blockedKey(ip))

    if (ttl > 0) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again later.', retryAfter: ttl },
        { status: 429 }
      )
    }
  } catch {
    // Redis unavailable — fail open so login still works in local dev
    // without Redis credentials configured
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/auth/login',
}
