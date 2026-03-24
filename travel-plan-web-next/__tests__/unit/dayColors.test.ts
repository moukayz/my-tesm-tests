import { DAY_COLORS } from '../../app/lib/dayColors'

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
