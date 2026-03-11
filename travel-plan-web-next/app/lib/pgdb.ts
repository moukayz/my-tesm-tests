import { Pool } from 'pg'

let pool: Pool

function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  if (process.env.VERCEL) {
    const { neon } = await import('@neondatabase/serverless')
    const db = neon(process.env.DATABASE_URL!)
    const rows = await (db as unknown as (sql: string, params?: unknown[]) => Promise<unknown[]>)(sql, params ?? [])
    return rows as T[]
  }
  const result = await getPool().query(sql, params)
  return result.rows as T[]
}
