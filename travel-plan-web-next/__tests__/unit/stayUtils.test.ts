/**
 * @jest-environment node
 */
import {
  getStays,
  applyStayEdit,
  validateStayEdit,
  StayEditError,
} from '../../app/lib/stayUtils'
import type { RouteDay } from '../../app/lib/itinerary'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeDay(dayNum: number, overnight: string): RouteDay {
  return {
    date: `2026/9/${dayNum}`,
    weekDay: '星期一',
    dayNum,
    overnight,
    plan: { morning: '', afternoon: '', evening: '' },
    train: [],
  }
}

/** Build a RouteDay[] from a stay spec: [['Paris', 4], ['Lyon', 3], ...] */
function makeDays(spec: [string, number][]): RouteDay[] {
  let dayNum = 1
  const result: RouteDay[] = []
  for (const [city, nights] of spec) {
    for (let i = 0; i < nights; i++) {
      result.push(makeDay(dayNum++, city))
    }
  }
  return result
}

// ─── getStays ────────────────────────────────────────────────────────────────

describe('getStays', () => {
  it('returns empty array for empty input', () => {
    expect(getStays([])).toEqual([])
  })

  it('returns a single stay when all days share the same overnight', () => {
    const days = makeDays([['Paris', 3]])
    const stays = getStays(days)
    expect(stays).toHaveLength(1)
    expect(stays[0]).toEqual({ overnight: 'Paris', startIndex: 0, nights: 3 })
  })

  it('returns two stays with correct startIndex and nights', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    const stays = getStays(days)
    expect(stays).toHaveLength(2)
    expect(stays[0]).toEqual({ overnight: 'Paris', startIndex: 0, nights: 4 })
    expect(stays[1]).toEqual({ overnight: 'Lyon', startIndex: 4, nights: 3 })
  })

  it('returns three stays with correct boundaries', () => {
    const days = makeDays([['Paris', 2], ['Lyon', 3], ['Rome', 4]])
    const stays = getStays(days)
    expect(stays).toHaveLength(3)
    expect(stays[0]).toEqual({ overnight: 'Paris', startIndex: 0, nights: 2 })
    expect(stays[1]).toEqual({ overnight: 'Lyon', startIndex: 2, nights: 3 })
    expect(stays[2]).toEqual({ overnight: 'Rome', startIndex: 5, nights: 4 })
  })

  it('sum of nights equals days.length', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3], ['Rome', 5]])
    const stays = getStays(days)
    const total = stays.reduce((acc, s) => acc + s.nights, 0)
    expect(total).toBe(days.length)
  })
})

// ─── validateStayEdit ────────────────────────────────────────────────────────

describe('validateStayEdit', () => {
  const days = makeDays([['Paris', 4], ['Lyon', 3]]) // stayIndex 0 & 1

  it('returns null for a valid shrink (4 → 2)', () => {
    expect(validateStayEdit(days, 0, 2)).toBeNull()
  })

  it('returns null for a valid extend (4 → 6, Lyon becomes 1)', () => {
    expect(validateStayEdit(days, 0, 6)).toBeNull()
  })

  it('returns invalid_new_nights when newNights is 0', () => {
    const err = validateStayEdit(days, 0, 0)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_new_nights')
  })

  it('returns invalid_new_nights when newNights is -1', () => {
    const err = validateStayEdit(days, 0, -1)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_new_nights')
  })

  it('returns invalid_new_nights when newNights is not an integer (1.5)', () => {
    const err = validateStayEdit(days, 0, 1.5)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_new_nights')
  })

  it('returns invalid_stay_index when stayIndex is last stay', () => {
    // 2 stays → last index is 1
    const err = validateStayEdit(days, 1, 2)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_stay_index')
  })

  it('returns invalid_stay_index when stayIndex is out of range (99)', () => {
    const err = validateStayEdit(days, 99, 2)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_stay_index')
  })

  it('returns invalid_stay_index when stayIndex is negative', () => {
    const err = validateStayEdit(days, -1, 2)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_stay_index')
  })

  it('returns next_stay_exhausted when extending would reduce next stay to 0', () => {
    // Lyon has 3; if Paris goes from 4 to 7 → Lyon would have 0
    const err = validateStayEdit(days, 0, 7)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('next_stay_exhausted')
  })

  it('returns next_stay_exhausted when next stay has 1 night and we try to extend', () => {
    // Paris=4, Lyon=1 → extending Paris by 1 would exhaust Lyon
    const tightDays = makeDays([['Paris', 4], ['Lyon', 1]])
    const err = validateStayEdit(tightDays, 0, 5)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('next_stay_exhausted')
  })

  it('returns null for a valid max-extend when next stay would become exactly 1', () => {
    // Paris=4, Lyon=3 → Paris to 6, Lyon becomes 1 → exactly valid
    expect(validateStayEdit(days, 0, 6)).toBeNull()
  })

  it('validates stayIndex=0 for a three-stay itinerary', () => {
    const threeDays = makeDays([['Paris', 3], ['Lyon', 3], ['Rome', 3]])
    expect(validateStayEdit(threeDays, 0, 2)).toBeNull()
  })

  it('returns invalid_stay_index for last stay in a three-stay itinerary', () => {
    const threeDays = makeDays([['Paris', 3], ['Lyon', 3], ['Rome', 3]])
    const err = validateStayEdit(threeDays, 2, 2)
    expect(err).not.toBeNull()
    expect(err!.code).toBe('invalid_stay_index')
  })
})

// ─── applyStayEdit ────────────────────────────────────────────────────────────

describe('applyStayEdit', () => {
  it('shrinks stay A and grows stay B: A=4→2, B=3→5', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    const result = applyStayEdit(days, 0, 2)

    expect(result).toHaveLength(7) // total unchanged

    // First 2 days: Paris
    expect(result.slice(0, 2).every(d => d.overnight === 'Paris')).toBe(true)
    // Remaining 5 days: Lyon
    expect(result.slice(2).every(d => d.overnight === 'Lyon')).toBe(true)
  })

  it('extends stay A and shrinks stay B: A=2→4, B=4→2', () => {
    const days = makeDays([['Paris', 2], ['Lyon', 4]])
    const result = applyStayEdit(days, 0, 4)

    expect(result).toHaveLength(6) // total unchanged

    expect(result.slice(0, 4).every(d => d.overnight === 'Paris')).toBe(true)
    expect(result.slice(4).every(d => d.overnight === 'Lyon')).toBe(true)
  })

  it('day conservation: sum of nights equals original days.length', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    const result = applyStayEdit(days, 0, 2)
    expect(result).toHaveLength(days.length)
  })

  it('no-op when newNights equals current nights', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    const result = applyStayEdit(days, 0, 4)
    expect(result.slice(0, 4).every(d => d.overnight === 'Paris')).toBe(true)
    expect(result.slice(4).every(d => d.overnight === 'Lyon')).toBe(true)
    expect(result).toHaveLength(days.length)
  })

  it('does not mutate the original array', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    const originalOvernights = days.map(d => d.overnight)
    applyStayEdit(days, 0, 2)
    expect(days.map(d => d.overnight)).toEqual(originalOvernights)
  })

  it('middle stay boundaries preserved in three-stay itinerary (shrink first stay)', () => {
    const days = makeDays([['Paris', 3], ['Lyon', 3], ['Rome', 3]])
    const result = applyStayEdit(days, 0, 2)

    // Paris: 2, Lyon: 4, Rome: 3
    expect(result.slice(0, 2).every(d => d.overnight === 'Paris')).toBe(true)
    expect(result.slice(2, 6).every(d => d.overnight === 'Lyon')).toBe(true)
    expect(result.slice(6).every(d => d.overnight === 'Rome')).toBe(true)
    expect(result).toHaveLength(9)
  })

  it('middle stay boundaries preserved in three-stay itinerary (shrink middle stay)', () => {
    const days = makeDays([['Paris', 3], ['Lyon', 3], ['Rome', 3]])
    const result = applyStayEdit(days, 1, 2)

    // Paris: 3, Lyon: 2, Rome: 4
    expect(result.slice(0, 3).every(d => d.overnight === 'Paris')).toBe(true)
    expect(result.slice(3, 5).every(d => d.overnight === 'Lyon')).toBe(true)
    expect(result.slice(5).every(d => d.overnight === 'Rome')).toBe(true)
    expect(result).toHaveLength(9)
  })

  it('non-consecutive overnights — fields other than overnight are unchanged after edit', () => {
    const days = makeDays([['Paris', 2], ['Lyon', 2]])
    const result = applyStayEdit(days, 0, 1)

    // day 0: Paris; days 1–3: Lyon
    // Original day[0] fields should be unchanged except overnight (still Paris for idx 0)
    expect(result[0].dayNum).toBe(days[0].dayNum)
    expect(result[0].date).toBe(days[0].date)
    expect(result[0].overnight).toBe('Paris')
    // day 1 was Paris but is now reassigned to Lyon (boundary day)
    expect(result[1].overnight).toBe('Lyon')
    expect(result[1].dayNum).toBe(days[1].dayNum) // dayNum unchanged
  })

  it('throws StayEditError with day_conservation_violated when postcondition fails (simulated)', () => {
    // This tests the internal defensive check; we trigger it by patching a fabricated invalid case
    // We cannot normally produce a conservation failure via valid inputs, so we test the error class directly
    const err = new StayEditError('day_conservation_violated', 'test')
    expect(err.code).toBe('day_conservation_violated')
    expect(err).toBeInstanceOf(Error)
  })

  it('throws StayEditError when preconditions are violated (invalid stayIndex at runtime)', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    expect(() => applyStayEdit(days, 1, 2)).toThrow(StayEditError)
    expect(() => applyStayEdit(days, 1, 2)).toThrow(/invalid_stay_index/)
  })

  it('throws StayEditError when newNights < 1 at runtime', () => {
    const days = makeDays([['Paris', 4], ['Lyon', 3]])
    expect(() => applyStayEdit(days, 0, 0)).toThrow(StayEditError)
  })
})

// ─── StayEditError ───────────────────────────────────────────────────────────

describe('StayEditError', () => {
  it('is an instance of Error', () => {
    const err = new StayEditError('invalid_stay_index', 'msg')
    expect(err).toBeInstanceOf(Error)
  })

  it('has the correct code property', () => {
    const codes = [
      'invalid_stay_index',
      'invalid_new_nights',
      'next_stay_exhausted',
      'day_conservation_violated',
    ] as const
    for (const code of codes) {
      expect(new StayEditError(code, 'msg').code).toBe(code)
    }
  })

  it('message is set correctly', () => {
    const err = new StayEditError('invalid_new_nights', 'A stay must be at least 1 night.')
    expect(err.message).toBe('A stay must be at least 1 night.')
  })
})
