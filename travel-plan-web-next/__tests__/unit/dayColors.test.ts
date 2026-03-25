import { DAY_COLORS, getAttractionColor } from '../../app/lib/dayColors'

describe('DAY_COLORS', () => {
  it('has exactly 7 entries', () => {
    expect(DAY_COLORS).toHaveLength(7)
  })

  it('each entry has bg, text, and border properties', () => {
    for (const color of DAY_COLORS) {
      expect(color).toHaveProperty('bg')
      expect(color).toHaveProperty('text')
      expect(color).toHaveProperty('border')
    }
  })

  it('first entry is the blue color scheme', () => {
    expect(DAY_COLORS[0]).toEqual({
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
    })
  })
})

describe('getAttractionColor', () => {
  it('returns a valid DAY_COLORS entry for any id', () => {
    const color = getAttractionColor('some-id')
    expect(DAY_COLORS).toContainEqual(color)
  })

  it('returns the same color for the same id', () => {
    expect(getAttractionColor('eiffel-tower')).toEqual(getAttractionColor('eiffel-tower'))
  })

  it('is stable regardless of array position', () => {
    const id = 'louvre-museum'
    const color1 = getAttractionColor(id)
    const color2 = getAttractionColor(id)
    expect(color1).toBe(color2)
  })

  it('can return different colors for different ids', () => {
    const colors = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(getAttractionColor)
    const unique = new Set(colors.map((c) => c.bg))
    expect(unique.size).toBeGreaterThan(1)
  })
})
