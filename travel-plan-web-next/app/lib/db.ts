import duckdb from 'duckdb'
import { join } from 'path'

export const PARQUET = `read_parquet('${join(process.cwd(), 'db_railway_stats')}/*.parquet')`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (!db) db = new duckdb.Database(':memory:')
  return db
}

export function convertBigInt(rows: unknown): unknown {
  return JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
}

export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = getDb().connect()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conn.all(sql, (err: Error | null, rows: any[]) => {
      conn.close()
      if (err) reject(err)
      else resolve(convertBigInt(rows) as T[])
    })
  })
}
