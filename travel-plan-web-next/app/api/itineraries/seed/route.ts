import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { getRouteStore } from '../../../lib/routeStore'
import { ItineraryApiError, seedItinerary } from '../../../lib/itinerary-store/service'
import logger from '../../../lib/logger'

function routeDateToISO(date: string): string {
  const [y, m, d] = date.split('/').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function POST() {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const allDays = await getRouteStore().getAll()
  if (allDays.length === 0) {
    return NextResponse.json({ error: 'SEED_EMPTY' }, { status: 404 })
  }

  const startDate = routeDateToISO(allDays[0].date)
  const name = 'Original seeded route'

  try {
    const response = await seedItinerary(userEmail, allDays, name, startDate)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof ItineraryApiError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    logger.error({ err: error, route: '/api/itineraries/seed', userEmail }, 'seed itinerary failed')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
