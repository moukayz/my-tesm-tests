import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import logger from '../../lib/logger'
import { createItineraryShell, ItineraryApiError, listItineraries } from '../../lib/itinerary-store/service'

export async function GET() {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const response = await listItineraries(userEmail)
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    logger.error({ err: error, route: '/api/itineraries', userEmail }, 'list itineraries failed')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { name?: unknown; startDate?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_START_DATE' }, { status: 400 })
  }

  try {
    const response = await createItineraryShell(userEmail, body)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error({ err: error, route: '/api/itineraries', userEmail }, 'create itinerary failed')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
