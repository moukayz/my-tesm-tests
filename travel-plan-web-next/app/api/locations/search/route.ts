import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import logger from '../../../lib/logger'
import { LocationSearchInputError, searchLocations } from '../../../lib/location-search/service'

function parseLimit(rawLimit: string | null): number | undefined {
  if (!rawLimit) return undefined
  const parsed = Number(rawLimit)
  if (!Number.isInteger(parsed)) {
    throw new LocationSearchInputError(400, 'LOCATION_LIMIT_INVALID')
  }
  return parsed
}

export async function GET(request: NextRequest) {
  const session = await auth()
  const userEmail = session?.user?.email

  if (!userEmail) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query') ?? ''

  let limit: number | undefined
  try {
    limit = parseLimit(searchParams.get('limit'))
  } catch (error) {
    if (error instanceof LocationSearchInputError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'LOCATION_LIMIT_INVALID' }, { status: 400 })
  }

  try {
    const result = await searchLocations(query, limit, userEmail)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof LocationSearchInputError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }

    logger.error({ err: error, route: '/api/locations/search', userEmail }, 'location search failed')
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
