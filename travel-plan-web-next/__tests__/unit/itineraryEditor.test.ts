/**
 * @jest-environment node
 */
import type { RouteDay } from '../../app/lib/itinerary'
import {
  applyAppendStay,
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
      { stayIndex: 0, city: 'Paris', nights: 2, startDayIndex: 0, endDayIndex: 1, isLastStay: false },
      { stayIndex: 1, city: 'Lyon', nights: 1, startDayIndex: 2, endDayIndex: 2, isLastStay: false },
      { stayIndex: 2, city: 'Rome', nights: 2, startDayIndex: 3, endDayIndex: 4, isLastStay: true },
    ])
  })

  it('applyAppendStay appends blank days with target city', () => {
    const days = applyAppendStay([day('Paris', 1), day('Paris', 2)], 'Lyon', 2)
    expect(days).toHaveLength(4)
    expect(days[2].overnight).toBe('Lyon')
    expect(days[3].overnight).toBe('Lyon')
    expect(days[3].plan).toEqual({ morning: '', afternoon: '', evening: '' })
  })

  it('applyPatchStay changes non-last stay nights by borrowing from next stay', () => {
    const days = [day('Paris', 1), day('Paris', 2), day('Lyon', 3), day('Lyon', 4)]
    const updated = applyPatchStay(days, 0, { nights: 3 })
    expect(updated.map((d) => d.overnight)).toEqual(['Paris', 'Paris', 'Paris', 'Lyon'])
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

  it('canRemoveTrailingDays only allows blank plan and train content', () => {
    expect(canRemoveTrailingDays([day('Paris', 1)])).toBe(true)
    expect(canRemoveTrailingDays([{ ...day('Paris', 1), train: [{ train_id: 'ICE 1' }] }])).toBe(false)
  })
})
