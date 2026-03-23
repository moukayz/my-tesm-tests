/**
 * @jest-environment node
 */
import type { RouteDay } from '../../app/lib/itinerary'
import {
  applyAppendStay,
  applyMoveStay,
  applyPatchStay,
  canRemoveTrailingDays,
  deriveStays,
  regenerateDerivedDates,
} from '../../app/lib/itinerary-store/domain'

function day(overnight: string, dayNum: number): RouteDay {
  return {
    date: `2026/3/${dayNum}`,
    weekDay: '星期一',
    dayNum,
    overnight,
    plan: { morning: '', afternoon: '', evening: '' },
    train: [],
  }
}

describe('itinerary domain helpers', () => {
  it('deriveStays groups contiguous overnight blocks', () => {
    const stays = deriveStays([day('Paris', 1), day('Paris', 2), day('Lyon', 3), day('Rome', 4), day('Rome', 5)])
    expect(stays).toEqual([
      {
        stayIndex: 0,
        city: 'Paris',
        nights: 2,
        startDayIndex: 0,
        endDayIndex: 1,
        isLastStay: false,
        location: { kind: 'custom', label: 'Paris', queryText: 'Paris' },
      },
      {
        stayIndex: 1,
        city: 'Lyon',
        nights: 1,
        startDayIndex: 2,
        endDayIndex: 2,
        isLastStay: false,
        location: { kind: 'custom', label: 'Lyon', queryText: 'Lyon' },
      },
      {
        stayIndex: 2,
        city: 'Rome',
        nights: 2,
        startDayIndex: 3,
        endDayIndex: 4,
        isLastStay: true,
        location: { kind: 'custom', label: 'Rome', queryText: 'Rome' },
      },
    ])
  })

  it('applyAppendStay appends blank days with target city', () => {
    const days = applyAppendStay([day('Paris', 1), day('Paris', 2)], 'Lyon', 2)
    expect(days).toHaveLength(4)
    expect(days[2].overnight).toBe('Lyon')
    expect(days[3].overnight).toBe('Lyon')
    expect(days[3].plan).toEqual({ morning: '', afternoon: '', evening: '' })
  })

  it('applyPatchStay increases non-last stay nights by inserting new days (trip grows)', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Lyon', 3), day('Lyon', 4)]
    const updated = applyPatchStay(days, 0, { nights: 3 })
    expect(updated).toHaveLength(5)
    expect(updated.map((d) => d.overnight)).toEqual(['Paris', 'Paris', 'Paris', 'Lyon', 'Lyon'])
  })

  it('applyPatchStay inserted day for non-last stay is blank (no plan, no trains)', () => {
    const days = [day('Paris', 1), day('Lyon', 2)]
    const updated = applyPatchStay(days, 0, { nights: 2 })
    expect(updated[1].plan).toEqual({ morning: '', afternoon: '', evening: '' })
    expect(updated[1].train).toEqual([])
  })

  it('applyPatchStay decreases non-last stay nights by removing days from end of stay (trip shrinks)', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Paris', 3), day('Lyon', 4), day('Lyon', 5)]
    const updated = applyPatchStay(days, 0, { nights: 1 })
    expect(updated).toHaveLength(3)
    expect(updated.map((d) => d.overnight)).toEqual(['Paris', 'Lyon', 'Lyon'])
  })

  it('applyPatchStay throws STAY_TRAILING_DAYS_LOCKED when decreasing non-last stay removes days with content', () => {
    const days = [
      day('Paris', 1),
      { ...day('Paris', 2), plan: { morning: 'Museum', afternoon: '', evening: '' } },
      day('Lyon', 3),
    ]
    expect(() => applyPatchStay(days, 0, { nights: 1 })).toThrow('STAY_TRAILING_DAYS_LOCKED')
  })

  it('applyPatchStay expands the last stay by appending blank days', () => {
    const days = [day('Paris', 1), day('Lyon', 2)]
    const updated = applyPatchStay(days, 1, { nights: 3 })
    expect(updated).toHaveLength(4)
    expect(updated.slice(1).every((d) => d.overnight === 'Lyon')).toBe(true)
  })

  it('applyPatchStay rejects shrinking the last stay when trailing days contain authored data', () => {
    const days = [
      day('Paris', 1),
      day('Lyon', 2),
      { ...day('Lyon', 3), plan: { morning: 'Museum', afternoon: '', evening: '' } },
    ]
    expect(() => applyPatchStay(days, 1, { nights: 1 })).toThrow('STAY_TRAILING_DAYS_LOCKED')
  })

  it('applyPatchStay merges adjacent stays when city rename matches neighbor', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Lyon', 3), day('Rome', 4)]
    const updated = applyPatchStay(days, 1, { city: 'Paris' })
    const stays = deriveStays(updated)
    expect(stays).toHaveLength(2)
    expect(stays[0].city).toBe('Paris')
    expect(stays[0].nights).toBe(3)
  })

  it('regenerateDerivedDates rewrites date, weekday, and dayNum from startDate', () => {
    const regenerated = regenerateDerivedDates('2026-03-21', [day('Paris', 100), day('Lyon', 200)])
    expect(regenerated[0].dayNum).toBe(1)
    expect(regenerated[1].dayNum).toBe(2)
    expect(regenerated[0].date).toBe('2026/3/21')
    expect(regenerated[1].date).toBe('2026/3/22')
  })

  it('applyMoveStay moves stay down by swapping blocks with next stay', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Lyon', 3)]
    const updated = applyMoveStay(days, 0, 'down')
    expect(updated).toHaveLength(3)
    expect(updated.map((d) => d.overnight)).toEqual(['Lyon', 'Paris', 'Paris'])
  })

  it('applyMoveStay moves stay up by swapping blocks with previous stay', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Lyon', 3)]
    const updated = applyMoveStay(days, 1, 'up')
    expect(updated.map((d) => d.overnight)).toEqual(['Lyon', 'Paris', 'Paris'])
  })

  it('applyMoveStay plan content travels with the block', () => {
    const days = [
      { ...day('Paris', 1), plan: { morning: 'Museum', afternoon: '', evening: '' } },
      day('Lyon', 2),
    ]
    const updated = applyMoveStay(days, 0, 'down')
    expect(updated[0].overnight).toBe('Lyon')
    expect(updated[1].overnight).toBe('Paris')
    expect(updated[1].plan.morning).toBe('Museum')
  })

  it('applyMoveStay handles unequal block sizes', () => {
    const days = [day('Paris', 1), day('Lyon', 2), day('Lyon', 3), day('Lyon', 4)]
    const updated = applyMoveStay(days, 0, 'down')
    expect(updated).toHaveLength(4)
    expect(updated.map((d) => d.overnight)).toEqual(['Lyon', 'Lyon', 'Lyon', 'Paris'])
  })

  it('applyMoveStay throws STAY_INDEX_INVALID for out-of-range stayIndex', () => {
    const days = [day('Paris', 1), day('Lyon', 2)]
    expect(() => applyMoveStay(days, 5, 'down')).toThrow('STAY_INDEX_INVALID')
  })

  it('applyMoveStay throws STAY_SWAP_BOUNDARY when moving first stay up', () => {
    const days = [day('Paris', 1), day('Lyon', 2)]
    expect(() => applyMoveStay(days, 0, 'up')).toThrow('STAY_SWAP_BOUNDARY')
  })

  it('applyMoveStay throws STAY_SWAP_BOUNDARY when moving last stay down', () => {
    const days = [day('Paris', 1), day('Lyon', 2)]
    expect(() => applyMoveStay(days, 1, 'down')).toThrow('STAY_SWAP_BOUNDARY')
  })

  it('canRemoveTrailingDays only allows blank plan and train content', () => {
    expect(canRemoveTrailingDays([day('Paris', 1)])).toBe(true)
    expect(canRemoveTrailingDays([{ ...day('Paris', 1), train: [{ train_id: 'ICE 1' }] }])).toBe(false)
  })
})
