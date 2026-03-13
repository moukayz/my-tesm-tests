import { Pool } from 'pg'
import logger from './logger'

let pool: Pool
let hasLoggedPoolBackend = false
let hasLoggedNeonBackend = false

function getDatabaseHost(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return 'unset'
  try {
    return new URL(databaseUrl).host
  } catch {
    return 'invalid-url'
  }
}

function getPool(): Pool {
  if (!pool) {
    if (!hasLoggedPoolBackend) {
      logger.info(
        { backend: 'local-postgres-pool', databaseHost: getDatabaseHost() },
        'Postgres backend selected'
      )
      hasLoggedPoolBackend = true
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  if (process.env.VERCEL) {
    if (!hasLoggedNeonBackend) {
      logger.info(
        {
          backend: 'neon-serverless',
          databaseHost: getDatabaseHost(),
          vercelEnv: process.env.VERCEL,
        },
        'Postgres backend selected'
      )
      hasLoggedNeonBackend = true
    }
    const { neon } = await import('@neondatabase/serverless')
    const db = neon(process.env.DATABASE_URL!)
    const rows = await db.query(sql, params ?? [])
    return rows as T[]
  }
  const result = await getPool().query(sql, params)
  return result.rows as T[]
}
