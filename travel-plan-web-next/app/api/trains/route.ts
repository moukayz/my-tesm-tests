import { NextResponse } from 'next/server'
import { query, PARQUET } from '../../lib/db'

export async function GET() {
  try {
    const rows = await query(`
      SELECT DISTINCT train_name, train_type
      FROM ${PARQUET}
      ORDER BY train_name
    `)
    return NextResponse.json(rows)
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
