import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import logger from '../../../../lib/logger'
import { appendStay, ItineraryApiError } from '../../../../lib/itinerary-store/service'

interface RouteContext {
  params: Promise<{ itineraryId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { itineraryId } = await context.params

  let body: { city?: unknown; nights?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'STAY_MUTATION_INVALID' }, { status: 400 })
  }

  try {
    const workspace = await appendStay(itineraryId, userEmail, body)
    return NextResponse.json(workspace, { status: 200 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error(
      { err: error, route: '/api/itineraries/[itineraryId]/stays', itineraryId, userEmail },
      'append stay failed'
    )
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
