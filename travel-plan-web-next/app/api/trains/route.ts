import { NextRequest, NextResponse } from 'next/server'
import { query, PARQUET, EURO_GTFS } from '../../lib/db'

export async function GET(request: NextRequest) {
  const railway = request.nextUrl.searchParams.get('railway')

  try {
    if (railway === 'german') {
      const result = await query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT train_name, train_type
        FROM ${PARQUET}
        ORDER BY train_name
      `)
      return NextResponse.json(result.map((r) => ({ ...r, railway: 'german' as const })))
    }

    const [germanResult, frenchResult, eurostarResult] = await Promise.allSettled([
      query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT train_name, train_type
        FROM ${PARQUET}
        ORDER BY train_name
      `),
      query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT trip_headsign::VARCHAR AS train_name, 'SNCF' AS train_type
        FROM read_csv('${EURO_GTFS}/trips.txt', header=true, auto_detect=true)
        WHERE split_part(trip_id, ':', 1) = 'fr'
          AND NULLIF(trip_headsign::VARCHAR, '') IS NOT NULL
        ORDER BY train_name
      `),
      query<{ train_name: string; train_type: string }>(`
        SELECT DISTINCT trip_headsign::VARCHAR AS train_name, 'Eurostar' AS train_type
        FROM read_csv('${EURO_GTFS}/trips.txt', header=true, auto_detect=true)
        WHERE split_part(trip_id, ':', 1) = 'eu'
          AND NULLIF(trip_headsign::VARCHAR, '') IS NOT NULL
        ORDER BY train_name
      `),
    ])

    const germanRows = germanResult.status === 'fulfilled' ? germanResult.value : []
    const frenchRows = frenchResult.status === 'fulfilled' ? frenchResult.value : []
    const eurostarRows = eurostarResult.status === 'fulfilled' ? eurostarResult.value : []

    const seen = new Set<string>()
    const combined = [
      ...frenchRows.map((r) => ({ ...r, railway: 'french' as const })),
      ...eurostarRows.map((r) => ({ ...r, railway: 'eurostar' as const })),
      ...germanRows.map((r) => ({ ...r, railway: 'german' as const })),
    ]
      .sort((a, b) => a.train_name.localeCompare(b.train_name))
      .filter((r) => {
        if (seen.has(r.train_name)) return false
        seen.add(r.train_name)
        return true
      })

    return NextResponse.json(combined)
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
