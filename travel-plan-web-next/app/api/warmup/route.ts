import { query, STOPS_PARQUET, DELAY_PARQUET } from '../../lib/db'
import logger from '../../lib/logger'

// Used by Playwright's webServer.url to block until DuckDB/MotherDuck is
// fully ready. Queries both parquets so the connection handshake AND file
// metadata cache for each table are warm before any test runs.
export async function GET() {
  const t0 = Date.now()
  await Promise.all([
    query(`SELECT train_name FROM ${STOPS_PARQUET} LIMIT 1`),
    query(`SELECT train_name FROM ${DELAY_PARQUET} LIMIT 1`),
  ])
  logger.info({ ms: Date.now() - t0 }, '/api/warmup ready')
  return Response.json({ ok: true })
}
