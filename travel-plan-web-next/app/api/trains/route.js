import { NextResponse } from 'next/server'
import { query, PARQUET } from '../../lib/db.js'

export async function GET() {
  try {
    const rows = await query(`
      SELECT DISTINCT train_name, train_type
      FROM ${PARQUET}
      ORDER BY train_name
    `)
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
