import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { getRouteStore, VALID_TAB_KEYS } from '../../lib/routeStore'
import type { TabKey } from '../../lib/routeStore'
import { parseAttractions } from '../../lib/attractionValidator'
import logger from '../../lib/logger'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    logger.warn('/api/attraction-update unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tabKey?: unknown; dayIndex?: unknown; attractions?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
  }

  if (body.tabKey !== undefined && !VALID_TAB_KEYS.includes(body.tabKey as TabKey)) {
    return NextResponse.json({ error: 'invalid_tab_key' }, { status: 400 })
  }

  try {
    if (typeof body.dayIndex !== 'number' || !Number.isInteger(body.dayIndex) || body.dayIndex < 0) {
      return NextResponse.json({ error: 'Invalid request: dayIndex must be a non-negative integer' }, { status: 400 })
    }

    const attractions = parseAttractions(body.attractions)
    if (attractions === null) {
      return NextResponse.json({ error: 'Invalid request: attractions must be a valid array' }, { status: 400 })
    }

    const tabKey: TabKey = (body.tabKey as TabKey) ?? 'route'
    const store = getRouteStore()
    const allData = await store.getAll()

    if (body.dayIndex >= allData.length) {
      return NextResponse.json(
        { error: `Invalid dayIndex: must be between 0 and ${allData.length - 1}` },
        { status: 400 }
      )
    }

    const updatedDay = await store.updateAttractions(body.dayIndex, attractions)
    logger.info({ user: session.user.email, tabKey, dayIndex: body.dayIndex }, '/api/attraction-update ok')
    return NextResponse.json(updatedDay, { status: 200 })
  } catch (error) {
    logger.error({ err: error, user: session.user.email, dayIndex: body?.dayIndex }, '/api/attraction-update error')
    return NextResponse.json({ error: 'Internal server error while updating attractions' }, { status: 500 })
  }
}
