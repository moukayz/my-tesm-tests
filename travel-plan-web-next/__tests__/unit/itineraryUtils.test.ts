import { formatTripDate, getCountryFromLocation } from '../../app/lib/itineraryUtils'
import type { StayLocation } from '../../app/lib/itinerary-store/types'

describe('formatTripDate', () => {
  it('formats a YYYY-MM-DD date string', () => {
    expect(formatTripDate('2026-04-01')).toMatch(/Apr/)
    expect(formatTripDate('2026-04-01')).toMatch(/2026/)
  })

  it('formats a slash-delimited date string', () => {
    expect(formatTripDate('2026/04/01')).toMatch(/Apr/)
  })

  it('returns input as-is when it cannot be parsed', () => {
    expect(formatTripDate('not-a-date')).toBe('not-a-date')
    expect(formatTripDate('April 1, 2026')).toBe('April 1, 2026')
  })

  it('returns input as-is for a 2-part string', () => {
    expect(formatTripDate('2026-04')).toBe('2026-04')
  })
})

describe('getCountryFromLocation', () => {
  it('returns undefined for undefined input', () => {
    expect(getCountryFromLocation(undefined)).toBeUndefined()
  })

  it('returns country from resolved location', () => {
    const location: StayLocation = {
      kind: 'resolved',
      label: 'Paris',
      queryText: 'Paris',
      coordinates: { lng: 2.35, lat: 48.85 },
      place: { placeId: 'p1', name: 'Paris', country: 'France' },
    }
    expect(getCountryFromLocation(location)).toBe('France')
  })

  it('falls back to countryCode for resolved location without country', () => {
    const location: StayLocation = {
      kind: 'resolved',
      label: 'Paris',
      queryText: 'Paris',
      coordinates: { lng: 2.35, lat: 48.85 },
      place: { placeId: 'p1', name: 'Paris', countryCode: 'FR' },
    }
    expect(getCountryFromLocation(location)).toBe('FR')
  })

  it('returns country from geonames location', () => {
    const location: StayLocation = {
      kind: 'geonames',
      label: 'Berlin',
      queryText: 'Berlin',
      coordinates: { lng: 13.4, lat: 52.5 },
      place: { geonameId: 1, name: 'Berlin', countryName: 'Germany', countryCode: 'DE' },
    }
    expect(getCountryFromLocation(location)).toBe('Germany')
  })

  it('returns undefined for custom location kind', () => {
    const location: StayLocation = {
      kind: 'custom',
      label: 'Somewhere',
      queryText: 'Somewhere',
    }
    expect(getCountryFromLocation(location)).toBeUndefined()
  })
})
