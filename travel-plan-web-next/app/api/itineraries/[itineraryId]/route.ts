import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import logger from '../../../lib/logger'
import { getWorkspace, ItineraryApiError } from '../../../lib/itinerary-store/service'

interface RouteContext {
  params: Promise<{ itineraryId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { itineraryId } = await context.params

  try {
    const workspace = await getWorkspace(itineraryId, userEmail)
    return NextResponse.json(workspace, { status: 200 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error({ err: error, route: '/api/itineraries/[itineraryId]', itineraryId, userEmail }, 'get workspace failed')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
