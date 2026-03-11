/**
 * @jest-environment node
 */

// Mock duckdb to prevent real DB connections during unit tests
// (eager init would otherwise open MotherDuck background threads)
jest.mock('duckdb', () => ({
  default: { Database: jest.fn().mockImplementation(() => ({ connect: jest.fn() })) },
  Database: jest.fn().mockImplementation(() => ({ connect: jest.fn() })),
}))

import { convertBigInt, DELAY_PARQUET, STOPS_PARQUET } from '../../app/lib/db'

describe('convertBigInt', () => {
  it('converts bigint values to numbers', () => {
    const input = [{ count: BigInt(42) }]
    const result = convertBigInt(input) as Array<{ count: number }>
    expect(result[0].count).toBe(42)
  })

  it('preserves regular numbers unchanged', () => {
    const input = [{ value: 3.14 }]
    const result = convertBigInt(input) as Array<{ value: number }>
    expect(result[0].value).toBeCloseTo(3.14)
  })

  it('preserves string values', () => {
    const input = [{ name: 'ICE 905' }]
    const result = convertBigInt(input) as Array<{ name: string }>
    expect(result[0].name).toBe('ICE 905')
  })

  it('handles nested objects with bigint', () => {
    const input = { nested: { big: BigInt(9007199254740991) } }
    const result = convertBigInt(input) as { nested: { big: number } }
    expect(result.nested.big).toBe(9007199254740991)
  })

  it('handles empty array', () => {
    expect(convertBigInt([])).toEqual([])
  })

  it('handles mixed types in same row', () => {
    const input = [{ id: BigInt(1), name: 'test', delay: 5.5 }]
    const result = convertBigInt(input) as Array<{ id: number; name: string; delay: number }>
    expect(result[0].id).toBe(1)
    expect(result[0].name).toBe('test')
    expect(result[0].delay).toBe(5.5)
  })
})

describe('Parquet path exports', () => {
  it('DELAY_PARQUET contains local slim path when MOTHERDUCK_TOKEN is unset', () => {
    // Verify that without MOTHERDUCK_TOKEN, we get a local file path
    expect(DELAY_PARQUET).toContain('db_railway_stats_slim')
    expect(DELAY_PARQUET).toContain('delay_events_slim.parquet')
  })

  it('STOPS_PARQUET contains local slim path when MOTHERDUCK_TOKEN is unset', () => {
    // Verify that without MOTHERDUCK_TOKEN, we get a local file path
    expect(STOPS_PARQUET).toContain('db_railway_stats_slim')
    expect(STOPS_PARQUET).toContain('train_latest_stops.parquet')
  })

  it('DELAY_PARQUET returns MotherDuck table ref when MOTHERDUCK_TOKEN is set', () => {
    // Save original env
    const originalToken = process.env.MOTHERDUCK_TOKEN
    const originalDb = process.env.MOTHERDUCK_DB
    const originalTable = process.env.MOTHERDUCK_DELAY_TABLE

    try {
      // Set MotherDuck env vars and re-import the module
      process.env.MOTHERDUCK_TOKEN = 'test-token'
      process.env.MOTHERDUCK_DB = 'test_db'
      process.env.MOTHERDUCK_DELAY_TABLE = 'delay_events_slim'

      // Clear the module cache to force re-evaluation
      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DELAY_PARQUET: delayRef } = require('../../app/lib/db')

      expect(delayRef).toBe('test_db.delay_events_slim')
    } finally {
      // Restore original env and reset modules again
      process.env.MOTHERDUCK_TOKEN = originalToken
      process.env.MOTHERDUCK_DB = originalDb
      process.env.MOTHERDUCK_DELAY_TABLE = originalTable
      jest.resetModules()
    }
  })

  it('STOPS_PARQUET returns MotherDuck table ref when MOTHERDUCK_TOKEN is set', () => {
    // Save original env
    const originalToken = process.env.MOTHERDUCK_TOKEN
    const originalDb = process.env.MOTHERDUCK_DB
    const originalTable = process.env.MOTHERDUCK_STOPS_TABLE

    try {
      // Set MotherDuck env vars and re-import the module
      process.env.MOTHERDUCK_TOKEN = 'test-token'
      process.env.MOTHERDUCK_DB = 'test_db'
      process.env.MOTHERDUCK_STOPS_TABLE = 'train_latest_stops'

      // Clear the module cache to force re-evaluation
      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { STOPS_PARQUET: stopsRef } = require('../../app/lib/db')

      expect(stopsRef).toBe('test_db.train_latest_stops')
    } finally {
      // Restore original env and reset modules again
      process.env.MOTHERDUCK_TOKEN = originalToken
      process.env.MOTHERDUCK_DB = originalDb
      process.env.MOTHERDUCK_STOPS_TABLE = originalTable
      jest.resetModules()
    }
  })
})
