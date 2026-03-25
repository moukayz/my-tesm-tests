import { parseAttractions } from '../../app/lib/attractionValidator'

describe('parseAttractions', () => {
  it('returns null for non-array input', () => {
    expect(parseAttractions(null)).toBeNull()
    expect(parseAttractions('string')).toBeNull()
    expect(parseAttractions(42)).toBeNull()
    expect(parseAttractions({ id: 'x', label: 'y' })).toBeNull()
  })

  it('returns empty array for empty input', () => {
    expect(parseAttractions([])).toEqual([])
  })

  it('returns null when item is not a plain object', () => {
    expect(parseAttractions([null])).toBeNull()
    expect(parseAttractions([[]])).toBeNull()
    expect(parseAttractions(['string'])).toBeNull()
  })

  it('returns null when id is empty string', () => {
    expect(parseAttractions([{ id: '', label: 'Ok' }])).toBeNull()
  })

  it('returns null when id is whitespace only', () => {
    expect(parseAttractions([{ id: '   ', label: 'Ok' }])).toBeNull()
  })

  it('returns null when id exceeds 80 characters', () => {
    expect(parseAttractions([{ id: 'x'.repeat(81), label: 'Ok' }])).toBeNull()
  })

  it('returns null when label is empty string', () => {
    expect(parseAttractions([{ id: 'valid-id', label: '' }])).toBeNull()
  })

  it('returns null when label exceeds 120 characters', () => {
    expect(parseAttractions([{ id: 'valid-id', label: 'L'.repeat(121) }])).toBeNull()
  })

  it('returns null when coordinates is not a plain object', () => {
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: 'bad' }])).toBeNull()
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: [] }])).toBeNull()
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: null }])).toBeNull()
  })

  it('returns null when coordinates has non-finite lat or lng', () => {
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: { lat: 'bad', lng: 2 } }])).toBeNull()
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: { lat: NaN, lng: 2 } }])).toBeNull()
    expect(parseAttractions([{ id: 'x', label: 'y', coordinates: { lat: 1, lng: Infinity } }])).toBeNull()
  })

  it('returns null when images is not an array of strings', () => {
    expect(parseAttractions([{ id: 'x', label: 'y', images: 'not-array' }])).toBeNull()
    expect(parseAttractions([{ id: 'x', label: 'y', images: [42] }])).toBeNull()
  })

  it('returns valid DayAttraction[] for minimal valid input', () => {
    const result = parseAttractions([{ id: 'geonames:123', label: 'Eiffel Tower' }])
    expect(result).toEqual([{ id: 'geonames:123', label: 'Eiffel Tower' }])
  })

  it('returns correct result with coordinates and images', () => {
    const input = [
      {
        id: 'geonames:2988507',
        label: 'Eiffel Tower',
        coordinates: { lat: 48.858, lng: 2.294 },
        images: ['https://blob.vercel.com/photo.jpg'],
      },
    ]
    expect(parseAttractions(input)).toEqual(input)
  })

  it('trims id and label whitespace', () => {
    const result = parseAttractions([{ id: '  trimmed  ', label: '  Name  ' }])
    expect(result).toEqual([{ id: 'trimmed', label: 'Name' }])
  })

  it('returns all valid items when multiple attractions provided', () => {
    const input = [
      { id: 'a', label: 'Place A' },
      { id: 'b', label: 'Place B', coordinates: { lat: 1, lng: 2 } },
    ]
    expect(parseAttractions(input)).toEqual(input)
  })
})
