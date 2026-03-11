import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { getRouteStore } from '../../lib/routeStore'

interface UpdatePlanRequest {
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UpdatePlanRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
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

    const store = getRouteStore()
    const allData = await store.getAll()

    if (body.dayIndex < 0 || body.dayIndex >= allData.length) {
      return NextResponse.json(
        { error: `Invalid dayIndex: must be between 0 and ${allData.length - 1}` },
        { status: 400 }
      )
    }

    const updatedDay = await store.updatePlan(body.dayIndex, body.plan)
    return NextResponse.json(updatedDay, { status: 200 })
  } catch (error) {
    console.error('Error updating plan:', error)
    return NextResponse.json(
      { error: 'Internal server error while updating plan' },
      { status: 500 }
    )
  }
}
