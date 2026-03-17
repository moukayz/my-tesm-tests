import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { getRouteStore } from '../../lib/routeStore'
import logger from '../../lib/logger'

interface UpdateTrainRequest {
  dayIndex: number
  trainJson: string
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    logger.warn('/api/train-update unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UpdateTrainRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
  }

  try {
    // Validation 2: dayIndex must be a number
    if (typeof body.dayIndex !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request: dayIndex must be a number' },
        { status: 400 }
      )
    }

    // Validation 3: trainJson must be a string
    if (typeof body.trainJson !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: trainJson must be a string' },
        { status: 400 }
      )
    }

    // Validation 4: trainJson must be valid JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(body.trainJson)
    } catch (parseErr) {
      return NextResponse.json(
        { error: `Invalid JSON: ${(parseErr as Error).message}` },
        { status: 400 }
      )
    }

    // Validation 5: Parsed value must be an array
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Train data must be an array' },
        { status: 400 }
      )
    }

    // Validation 6: Each element must have a non-empty string train_id
    for (const entry of parsed) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        typeof entry.train_id !== 'string' ||
        entry.train_id.length === 0
      ) {
        return NextResponse.json(
          { error: 'Each train entry must have a string train_id' },
          { status: 400 }
        )
      }
    }

    // Validation 7: dayIndex must be in range
    const store = getRouteStore()
    const allData = await store.getAll()

    if (body.dayIndex < 0 || body.dayIndex >= allData.length) {
      return NextResponse.json(
        { error: `Invalid dayIndex: must be between 0 and ${allData.length - 1}` },
        { status: 400 }
      )
    }

    const updatedDay = await store.updateTrain(body.dayIndex, parsed)
    logger.info({ user: session.user.email, dayIndex: body.dayIndex }, '/api/train-update ok')
    return NextResponse.json(updatedDay, { status: 200 })
  } catch (error) {
    logger.error({ err: error, user: session.user.email, dayIndex: body?.dayIndex }, '/api/train-update error')
    return NextResponse.json(
      { error: 'Internal server error while updating train' },
      { status: 500 }
    )
  }
}
