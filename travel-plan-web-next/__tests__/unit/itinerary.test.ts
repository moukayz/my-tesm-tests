/**
 * @jest-environment node
 */
import { getOvernightColor, processItinerary, type RouteDay } from '../../app/lib/itinerary'

describe('getOvernightColor', () => {
  it('returns #f5f5f5 for em-dash location', () => {
    expect(getOvernightColor('—')).toBe('#f5f5f5')
  })

  it('returns an hsl color string for a real location', () => {
    const color = getOvernightColor('Paris')
    expect(color).toMatch(/^hsl\(\d+, 70%, 95%\)$/)
  })

  it('returns consistent color for same input', () => {
    expect(getOvernightColor('巴黎')).toBe(getOvernightColor('巴黎'))
  })

  it('returns different colors for different locations', () => {
    expect(getOvernightColor('Paris')).not.toBe(getOvernightColor('London'))
  })

  it('hue is within 0-359 range', () => {
    const color = getOvernightColor('Rome')
    const match = color.match(/hsl\((\d+),/)
    expect(Number(match![1])).toBeGreaterThanOrEqual(0)
    expect(Number(match![1])).toBeLessThan(360)
  })
})

describe('processItinerary', () => {
  const makeDay = (overnight: string, dayNum: number): RouteDay => ({
    date: `2026/9/${dayNum + 24}`,
    weekDay: '星期一',
    dayNum,
    overnight,
    plan: {
      morning: 'morning plan',
      afternoon: 'afternoon plan',
      evening: 'evening plan',
    },
    train: [],
  })

  it('returns empty array for empty input', () => {
    expect(processItinerary([])).toEqual([])
  })

  it('sets overnightRowSpan=1 for a single row group', () => {
    const result = processItinerary([makeDay('Paris', 1)])
    expect(result[0].overnightRowSpan).toBe(1)
  })

  it('sets overnightRowSpan on the first row of each group', () => {
    const days = [makeDay('Paris', 1), makeDay('Paris', 2), makeDay('Paris', 3)]
    const result = processItinerary(days)
    expect(result[0].overnightRowSpan).toBe(3)
    expect(result[1].overnightRowSpan).toBe(0)
    expect(result[2].overnightRowSpan).toBe(0)
  })

  it('handles multiple groups correctly', () => {
    const days = [
      makeDay('Paris', 1),
      makeDay('Paris', 2),
      makeDay('Lyon', 3),
      makeDay('Lyon', 4),
      makeDay('Lyon', 5),
      makeDay('Nice', 6),
    ]
    const result = processItinerary(days)
    expect(result[0].overnightRowSpan).toBe(2) // Paris group
    expect(result[2].overnightRowSpan).toBe(3) // Lyon group
    expect(result[5].overnightRowSpan).toBe(1) // Nice group
  })

  it('does not mutate the input array', () => {
    const days = [makeDay('Paris', 1), makeDay('Paris', 2)]
    const copy = JSON.parse(JSON.stringify(days))
    processItinerary(days)
    expect(days).toEqual(copy)
  })

  it('preserves all original fields', () => {
    const day: RouteDay = {
      date: '2026/9/25',
      weekDay: '星期五',
      dayNum: 1,
      overnight: 'Paris',
      plan: {
        morning: 'some plan',
        afternoon: 'some plan',
        evening: 'some plan',
      },
      train: [{ train_id: 'ICE905', start: 'berlin', end: 'munich' }],
    }
    const [result] = processItinerary([day])
    expect(result.date).toBe(day.date)
    expect(result.weekDay).toBe(day.weekDay)
    expect(result.plan).toBe(day.plan)
    expect(result.train).toEqual(day.train)
  })
})

describe('normalizeTrainId', () => {
  it('inserts a space between letters and digits when missing', () => {
    const { normalizeTrainId } = require('../../app/lib/itinerary')
    expect(normalizeTrainId('ICE905')).toBe('ICE 905')
    expect(normalizeTrainId('EC81')).toBe('EC 81')
    expect(normalizeTrainId('EST9423')).toBe('EST 9423')
  })

  it('keeps train ids that already contain a space', () => {
    const { normalizeTrainId } = require('../../app/lib/itinerary')
    expect(normalizeTrainId('ICE 905')).toBe('ICE 905')
  })

  it('returns the input for non-train labels', () => {
    const { normalizeTrainId } = require('../../app/lib/itinerary')
    expect(normalizeTrainId('Paris ↔ Versailles（往返）')).toBe('Paris ↔ Versailles（往返）')
  })
})
