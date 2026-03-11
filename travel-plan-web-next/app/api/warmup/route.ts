import { pgQuery } from '../../lib/pgdb'
import logger from '../../lib/logger'

// Used by Playwright's webServer.url to block until the DB is ready.
export async function GET() {
  const t0 = Date.now()
  await Promise.all([
    pgQuery(`SELECT train_name FROM de_db_train_latest_stops LIMIT 1`),
    pgQuery(`SELECT train_name FROM de_db_delay_events LIMIT 1`),
  ])
  logger.info({ ms: Date.now() - t0 }, '/api/warmup ready')
  return Response.json({ ok: true })
}
