/**
 * @jest-environment node
 */
import { formatDay, buildStatItems, type DelayStats } from '../../app/lib/trainDelay'

describe('formatDay', () => {
  it('returns empty string for empty input', () => {
    expect(formatDay('')).toBe('')
  })

  it('formats a date string to M/D', () => {
    // Use a full ISO timestamp to avoid UTC vs local ambiguity
    const result = formatDay('2024-03-15T12:00:00')
    expect(result).toBe('3/15')
  })

  it('formats single-digit month and day without zero-padding', () => {
    const result = formatDay('2024-01-05T12:00:00')
    expect(result).toBe('1/5')
  })
})

describe('buildStatItems', () => {
  const stats: DelayStats = {
    total_stops: 120,
    avg_delay: 3.5,
    p50: 2.0,
    p75: 5.0,
    p90: 8.0,
    p95: 12.0,
    max_delay: 45,
  }

  it('returns 7 stat items', () => {
    expect(buildStatItems(stats)).toHaveLength(7)
  })

  it('maps total_stops correctly with no unit', () => {
    const items = buildStatItems(stats)
    const totalStops = items.find((i) => i.label === 'Total Stops')!
    expect(totalStops.value).toBe(120)
    expect(totalStops.unit).toBe('')
  })

  it('maps avg_delay with min unit', () => {
    const items = buildStatItems(stats)
    const avgDelay = items.find((i) => i.label === 'Avg Delay')!
    expect(avgDelay.value).toBe(3.5)
    expect(avgDelay.unit).toBe(' min')
  })

  it('includes all percentile labels', () => {
    const items = buildStatItems(stats)
    const labels = items.map((i) => i.label)
    expect(labels).toContain('Median (p50)')
    expect(labels).toContain('p75')
    expect(labels).toContain('p90')
    expect(labels).toContain('p95')
    expect(labels).toContain('Max Delay')
  })
})
