import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { getRouteStore, VALID_TAB_KEYS } from '../../lib/routeStore'
import type { TabKey } from '../../lib/routeStore'
import { validateStayEdit, applyStayEdit, StayEditError } from '../../lib/stayUtils'
import logger from '../../lib/logger'

interface StayUpdateRequest {
  tabKey: TabKey
  stayIndex: number
  newNights: number
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    logger.warn('/api/stay-update unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: StayUpdateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
  }

  // Step 1: Validate tabKey (pure — before any I/O)
  if (!body.tabKey || !VALID_TAB_KEYS.includes(body.tabKey as TabKey)) {
    logger.warn(
      { user: session.user.email, tabKey: body.tabKey },
      '/api/stay-update validation failed: invalid_tab_key'
    )
    return NextResponse.json({ error: 'invalid_tab_key' }, { status: 400 })
  }

  // Step 2: Validate stayIndex (pure — before any I/O)
  if (
    body.stayIndex === undefined ||
    body.stayIndex === null ||
    typeof body.stayIndex !== 'number' ||
    !Number.isInteger(body.stayIndex) ||
    body.stayIndex < 0
  ) {
    logger.warn(
      { user: session.user.email, tabKey: body.tabKey, stayIndex: body.stayIndex },
      '/api/stay-update validation failed: invalid_stay_index'
    )
    return NextResponse.json({ error: 'invalid_stay_index' }, { status: 400 })
  }

  // Step 3: Validate newNights (pure — before any I/O)
  if (
    body.newNights === undefined ||
    body.newNights === null ||
    typeof body.newNights !== 'number' ||
    !Number.isInteger(body.newNights) ||
    body.newNights < 1
  ) {
    logger.warn(
      { user: session.user.email, tabKey: body.tabKey, newNights: body.newNights },
      '/api/stay-update validation failed: invalid_new_nights'
    )
    return NextResponse.json({ error: 'invalid_new_nights' }, { status: 400 })
  }

  const tabKey = body.tabKey as TabKey

  try {
    // Load current state from store
    const store = getRouteStore(tabKey)
    const days = await store.getAll()

    // Step 4: Domain validation (requires days to compute stay boundaries)
    const validationError = validateStayEdit(days, body.stayIndex, body.newNights)
    if (validationError) {
      logger.warn(
        { user: session.user.email, tabKey, stayIndex: body.stayIndex, newNights: body.newNights, code: validationError.code },
        '/api/stay-update validation failed'
      )
      return NextResponse.json({ error: validationError.code }, { status: 400 })
    }

    // Apply domain mutation
    const updatedDays = applyStayEdit(days, body.stayIndex, body.newNights)

    // Persist atomically
    const persistedDays = await store.updateDays(updatedDays)

    logger.info(
      {
        user: session.user.email,
        tabKey,
        stayIndex: body.stayIndex,
        newNights: body.newNights,
      },
      '/api/stay-update ok'
    )

    return NextResponse.json({ updatedDays: persistedDays }, { status: 200 })
  } catch (error) {
    if (error instanceof StayEditError) {
      // Defence-in-depth: applyStayEdit threw a domain error (e.g., day_conservation_violated)
      logger.warn(
        { user: session.user.email, tabKey, stayIndex: body.stayIndex, code: error.code },
        '/api/stay-update domain error'
      )
      return NextResponse.json({ error: error.code }, { status: 400 })
    }

    logger.error(
      { err: error, user: session.user.email, tabKey, stayIndex: body.stayIndex },
      '/api/stay-update error'
    )
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
