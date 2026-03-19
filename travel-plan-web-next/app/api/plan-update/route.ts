import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { getRouteStore, VALID_TAB_KEYS } from '../../lib/routeStore'
import type { TabKey } from '../../lib/routeStore'
import logger from '../../lib/logger'

interface UpdatePlanRequest {
  tabKey?: TabKey
  dayIndex: number
  plan: {
    morning: string
    afternoon: string
    evening: string
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    logger.warn('/api/plan-update unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UpdatePlanRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
  }

  // Validate tabKey if present
  if (body.tabKey !== undefined && !VALID_TAB_KEYS.includes(body.tabKey as TabKey)) {
    return NextResponse.json({ error: 'invalid_tab_key' }, { status: 400 })
  }

  try {
    if (
      typeof body.dayIndex !== 'number' ||
      !body.plan ||
      typeof body.plan.morning !== 'string' ||
      typeof body.plan.afternoon !== 'string' ||
      typeof body.plan.evening !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid request: dayIndex must be a number and plan must have morning, afternoon, and evening strings' },
        { status: 400 }
      )
    }

    const tabKey: TabKey = (body.tabKey as TabKey) ?? 'route'
    const store = getRouteStore(tabKey)
    const allData = await store.getAll()

    if (body.dayIndex < 0 || body.dayIndex >= allData.length) {
      return NextResponse.json(
        { error: `Invalid dayIndex: must be between 0 and ${allData.length - 1}` },
        { status: 400 }
      )
    }

    const updatedDay = await store.updatePlan(body.dayIndex, body.plan)
    logger.info({ user: session.user.email, tabKey, dayIndex: body.dayIndex }, '/api/plan-update ok')
    return NextResponse.json(updatedDay, { status: 200 })
  } catch (error) {
    logger.error({ err: error, user: session.user.email, dayIndex: body?.dayIndex }, '/api/plan-update error')
    return NextResponse.json(
      { error: 'Internal server error while updating plan' },
      { status: 500 }
    )
  }
}
