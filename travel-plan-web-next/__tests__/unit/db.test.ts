/**
 * @jest-environment node
 */
import { convertBigInt } from '../../app/lib/db'

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
