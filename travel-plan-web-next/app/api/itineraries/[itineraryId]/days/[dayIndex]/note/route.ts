import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../../auth'
import logger from '../../../../../../lib/logger'
import { ItineraryApiError, patchDayNote } from '../../../../../../lib/itinerary-store/service'

interface RouteContext {
  params: Promise<{ itineraryId: string; dayIndex: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { itineraryId, dayIndex: dayIndexParam } = await context.params
  const dayIndex = Number(dayIndexParam)

  let body: { note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_NOTE' }, { status: 400 })
  }

  try {
    const day = await patchDayNote(itineraryId, dayIndex, userEmail, body)
    return NextResponse.json(day, { status: 200 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error(
      { err: error, route: '/api/itineraries/[itineraryId]/days/[dayIndex]/note', itineraryId, dayIndex, userEmail },
      'patch day note failed'
    )
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
