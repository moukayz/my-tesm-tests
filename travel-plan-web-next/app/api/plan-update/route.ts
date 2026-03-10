import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from '../../lib/session'

interface UpdatePlanRequest {
  dayIndex: number
  plan: {
    morning: string
    afternoon: string
    evening: string
  }
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: UpdatePlanRequest = await request.json()

    // Validate request body
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

    // Read route.json
    const routeJsonPath = path.join(process.cwd(), 'data', 'route.json')
    const fileContent = fs.readFileSync(routeJsonPath, 'utf-8')
    const routeData = JSON.parse(fileContent)

    // Validate dayIndex
    if (body.dayIndex < 0 || body.dayIndex >= routeData.length) {
      return NextResponse.json(
        { error: `Invalid dayIndex: must be between 0 and ${routeData.length - 1}` },
        { status: 400 }
      )
    }

    // Update the plan for the specified day
    routeData[body.dayIndex].plan = {
      morning: body.plan.morning,
      afternoon: body.plan.afternoon,
      evening: body.plan.evening,
    }

    // Write updated data back to file
    fs.writeFileSync(routeJsonPath, JSON.stringify(routeData, null, 2))

    // Return the updated day object
    return NextResponse.json(routeData[body.dayIndex], { status: 200 })
  } catch (error) {
    console.error('Error updating plan:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error while updating plan' },
      { status: 500 }
    )
  }
}
