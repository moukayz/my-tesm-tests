/**
 * @jest-environment node
 */
import { getCountryColor, getCityColor, getOvernightColor, processItinerary, getRailwayFromTrainId, type RouteDay } from '../../app/lib/itinerary'

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

describe('getCountryColor', () => {
  it('returns #f5f5f5 for em-dash', () => {
    expect(getCountryColor('—')).toBe('#f5f5f5')
  })

  it('returns an hsl pastel for a real country', () => {
    expect(getCountryColor('France')).toMatch(/^hsl\(\d+, 70%, 95%\)$/)
  })

  it('is deterministic for the same country', () => {
    expect(getCountryColor('France')).toBe(getCountryColor('France'))
  })

  it('returns different colors for different countries', () => {
    expect(getCountryColor('France')).not.toBe(getCountryColor('Italy'))
  })
})

describe('getCityColor', () => {
  it('returns #f5f5f5 when country is em-dash', () => {
    expect(getCityColor('Paris', '—')).toBe('#f5f5f5')
  })

  it('is deterministic for the same city+country', () => {
    expect(getCityColor('Paris', 'France')).toBe(getCityColor('Paris', 'France'))
  })

  it('city hue matches country hue exactly', () => {
    const countryColor = getCountryColor('France')
    const countryHue = Number(countryColor.match(/hsl\((\d+),/)![1])
    const cityColor = getCityColor('Paris', 'France')
    const cityHue = Number(cityColor.match(/hsl\((\d+),/)![1])
    expect(cityHue).toBe(countryHue)
  })

  it('two cities in the same country have different colors', () => {
    expect(getCityColor('Paris', 'France')).not.toBe(getCityColor('Lyon', 'France'))
  })

  it('saturation is in range 25–75%', () => {
    const color = getCityColor('Paris', 'France')
    const s = Number(color.match(/hsl\(\d+, (\d+)%,/)![1])
    expect(s).toBeGreaterThanOrEqual(25)
    expect(s).toBeLessThanOrEqual(75)
  })

  it('lightness is in range 83–93%', () => {
    const color = getCityColor('Paris', 'France')
    const l = Number(color.match(/hsl\(\d+, \d+%, (\d+)%/)![1])
    expect(l).toBeGreaterThanOrEqual(83)
    expect(l).toBeLessThanOrEqual(93)
  })

  it('falls back to city-only hash when no country provided', () => {
    const color = getCityColor('CustomCity', '')
    expect(color).toMatch(/^hsl\(\d+, 70%, 95%\)$/)
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

describe('getRailwayFromTrainId', () => {
  it('returns "french" for a TGV train id (already normalised)', () => {
    expect(getRailwayFromTrainId('TGV 9242')).toBe('french')
  })

  it('returns "french" for a TGV train id (unnormalised, no space)', () => {
    expect(getRailwayFromTrainId('TGV9242')).toBe('french')
  })

  it('returns "french" for lowercase tgv train id', () => {
    expect(getRailwayFromTrainId('tgv456')).toBe('french')
  })

  it('returns "eurostar" for an EST train id (already normalised)', () => {
    expect(getRailwayFromTrainId('EST 9023')).toBe('eurostar')
  })

  it('returns "eurostar" for an EST train id (unnormalised, no space)', () => {
    expect(getRailwayFromTrainId('EST9423')).toBe('eurostar')
  })

  it('returns "eurostar" for lowercase est train id', () => {
    expect(getRailwayFromTrainId('est9002')).toBe('eurostar')
  })

  it('returns empty string for a German ICE train id', () => {
    expect(getRailwayFromTrainId('ICE 905')).toBe('')
  })

  it('returns empty string for a German EC train id', () => {
    expect(getRailwayFromTrainId('EC81')).toBe('')
  })

  it('returns empty string for non-train labels', () => {
    expect(getRailwayFromTrainId('Paris ↔ Versailles（往返）')).toBe('')
  })

  it('handles whitespace-padded train ids', () => {
    expect(getRailwayFromTrainId('  TGV 1234  ')).toBe('french')
    expect(getRailwayFromTrainId('  EST 9002  ')).toBe('eurostar')
    expect(getRailwayFromTrainId('  ICE 905  ')).toBe('')
  })
})
