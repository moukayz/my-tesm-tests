import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../../auth'
import logger from '../../../../../../lib/logger'
import { ItineraryApiError, moveStay } from '../../../../../../lib/itinerary-store/service'

interface RouteContext {
  params: Promise<{ itineraryId: string; stayIndex: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { itineraryId, stayIndex: stayIndexParam } = await context.params
  const stayIndex = Number(stayIndexParam)

  let body: { direction?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'STAY_MUTATION_INVALID' }, { status: 400 })
  }

  try {
    const workspace = await moveStay(itineraryId, stayIndex, userEmail, body.direction as 'up' | 'down')
    return NextResponse.json(workspace, { status: 200 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error(
      { err: error, route: '/api/itineraries/[itineraryId]/stays/[stayIndex]/move', itineraryId, stayIndex, userEmail },
      'move stay failed'
    )
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
