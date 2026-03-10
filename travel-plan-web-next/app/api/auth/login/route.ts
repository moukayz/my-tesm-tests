import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from '../../../lib/session'
import { recordFailure, recordSuccess } from '../../../lib/rateLimiter'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    const body = await request.json()

    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Missing username or password' }, { status: 400 })
    }

    const { username, password } = body

    if (
      username !== process.env.AUTH_USERNAME ||
      password !== process.env.AUTH_PASSWORD
    ) {
      await recordFailure(ip)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    session.isLoggedIn = true
    session.username = username
    await session.save()

    await recordSuccess(ip)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
  }
}
