import duckdb from 'duckdb'
import { join } from 'path'

const SLIM_DIR = join(process.cwd(), 'db_railway_stats_slim')
const LOCAL_DELAY = `read_parquet('${SLIM_DIR}/delay_events_slim.parquet')`
const LOCAL_STOPS = `read_parquet('${SLIM_DIR}/train_latest_stops.parquet')`

function isMotherduck() {
  return !!process.env.MOTHERDUCK_TOKEN
}

export const DELAY_PARQUET = isMotherduck()
  ? `${process.env.MOTHERDUCK_DB ?? 'my_db'}.${process.env.MOTHERDUCK_DELAY_TABLE ?? 'delay_events_slim'}`
  : LOCAL_DELAY

export const STOPS_PARQUET = isMotherduck()
  ? `${process.env.MOTHERDUCK_DB ?? 'my_db'}.${process.env.MOTHERDUCK_STOPS_TABLE ?? 'train_latest_stops'}`
  : LOCAL_STOPS

export const EURO_GTFS = join(process.cwd(), 'euro-railway-timetable')

// Eagerly initialize the DB connection at module load time so the MotherDuck
// cold-start (~80s handshake) happens at server startup, not on the first request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = isMotherduck()
  ? new duckdb.Database(`md:${process.env.MOTHERDUCK_DB ?? 'my_db'}`)
  : new duckdb.Database(':memory:')

export function convertBigInt(rows: unknown): unknown {
  return JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
}

export function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = db.connect()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conn.all(sql, (err: Error | null, rows: any[]) => {
      conn.close()
      if (err) reject(err)
      else resolve(convertBigInt(rows) as T[])
    })
  })
}
