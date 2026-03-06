import duckdb from 'duckdb'
import { join } from 'path'

export const PARQUET = `read_parquet('${join(process.cwd(), 'db_railway_stats')}/*.parquet')`

let db

function getDb() {
  if (!db) db = new duckdb.Database(':memory:')
  return db
}

function convertBigInt(rows) {
  return JSON.parse(JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? Number(v) : v))
}

export function query(sql) {
  return new Promise((resolve, reject) => {
    const conn = getDb().connect()
    conn.all(sql, (err, rows) => {
      conn.close()
      if (err) reject(err)
      else resolve(convertBigInt(rows))
    })
  })
}
