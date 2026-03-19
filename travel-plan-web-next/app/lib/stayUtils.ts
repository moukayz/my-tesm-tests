/**
 * Pure, side-effect-free stay utility functions.
 * Shared by FE (client components) and BE (API routes).
 * MUST NOT import server-only modules.
 */
import type { RouteDay } from './itinerary'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Stay {
  overnight: string
  /** Index of first RouteDay in this stay */
  startIndex: number
  /** Count of consecutive RouteDay rows with this overnight value */
  nights: number
}

/**
 * Extended Stay type used by FE components.
 * Includes stayIndex, firstDayIndex (alias for startIndex), and isLast flag.
 */
export interface StayWithMeta extends Stay {
  stayIndex: number
  firstDayIndex: number
  isLast: boolean
}

export type StayEditErrorCode =
  | 'invalid_stay_index'
  | 'invalid_new_nights'
  | 'next_stay_exhausted'
  | 'day_conservation_violated'

export class StayEditError extends Error {
  constructor(
    public readonly code: StayEditErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'StayEditError'
  }
}

// ── getStays ─────────────────────────────────────────────────────────────────

/**
 * Derives an ordered array of city stays from a RouteDay array.
 * Returns Stay objects with startIndex, nights, and overnight fields.
 */
export function getStays(days: RouteDay[]): Stay[] {
  if (days.length === 0) return []

  const stays: Stay[] = []
  let currentCity = days[0].overnight
  let stayStart = 0

  for (let i = 1; i <= days.length; i++) {
    const atEnd = i === days.length
    const newCity = atEnd ? null : days[i].overnight

    if (atEnd || newCity !== currentCity) {
      stays.push({
        overnight: currentCity,
        nights: i - stayStart,
        startIndex: stayStart,
      })
      if (!atEnd) {
        currentCity = newCity!
        stayStart = i
      }
    }
  }

  return stays
}

/**
 * Augments Stay[] with stayIndex, firstDayIndex, and isLast fields.
 * Used by FE components.
 */
export function getStaysWithMeta(days: RouteDay[]): StayWithMeta[] {
  const stays = getStays(days)
  return stays.map((stay, i) => ({
    ...stay,
    stayIndex: i,
    firstDayIndex: stay.startIndex,
    isLast: i === stays.length - 1,
  }))
}

// ── validateStayEdit ─────────────────────────────────────────────────────────

/**
 * Validates a proposed stay edit.
 * Returns null if valid, or a StayEditError if invalid.
 */
export function validateStayEdit(
  days: RouteDay[],
  stayIndex: number,
  newNights: number
): StayEditError | null {
  const stays = getStays(days)

  // Validate stayIndex
  if (
    !Number.isInteger(stayIndex) ||
    stayIndex < 0 ||
    stayIndex >= stays.length ||
    stayIndex === stays.length - 1
  ) {
    return new StayEditError('invalid_stay_index', 'invalid_stay_index')
  }

  // Validate newNights
  if (!Number.isInteger(newNights) || newNights < 1) {
    return new StayEditError('invalid_new_nights', 'A stay must be at least 1 night.')
  }

  // Validate next stay would not be exhausted
  const nextStay = stays[stayIndex + 1]
  const delta = newNights - stays[stayIndex].nights
  if (nextStay.nights - delta < 1) {
    return new StayEditError(
      'next_stay_exhausted',
      'The next stay has no nights left to borrow.'
    )
  }

  return null
}

// ── applyStayEdit ─────────────────────────────────────────────────────────────

/**
 * Returns a new RouteDay[] with the stay at stayIndex adjusted to newNights,
 * borrowing/donating the delta from/to the immediately following stay.
 *
 * Validates preconditions and throws StayEditError if invalid.
 * Does NOT mutate the input array.
 */
export function applyStayEdit(
  days: RouteDay[],
  stayIndex: number,
  newNights: number
): RouteDay[] {
  const validationError = validateStayEdit(days, stayIndex, newNights)
  if (validationError) throw validationError

  const stays = getStays(days)
  const stayA = stays[stayIndex]
  const stayB = stays[stayIndex + 1]
  const delta = newNights - stayA.nights

  const result = [...days]

  if (delta > 0) {
    // Extend A: move boundary days from B to A
    for (let i = stayB.startIndex; i < stayB.startIndex + delta; i++) {
      result[i] = { ...result[i], overnight: stayA.overnight }
    }
  } else if (delta < 0) {
    // Shrink A: move boundary days from A to B
    const shrinkCount = -delta
    const aLastIndex = stayB.startIndex - 1
    for (let i = aLastIndex - shrinkCount + 1; i <= aLastIndex; i++) {
      result[i] = { ...result[i], overnight: stayB.overnight }
    }
  }

  // Defence-in-depth: verify conservation
  const newStays = getStays(result)
  const newA = newStays[stayIndex]
  const newB = newStays[stayIndex + 1]
  if (newA && newB) {
    const expectedSum = stayA.nights + stayB.nights
    const actualSum = newA.nights + newB.nights
    if (actualSum !== expectedSum) {
      throw new StayEditError(
        'day_conservation_violated',
        `Day conservation violated: expected ${expectedSum}, got ${actualSum}`
      )
    }
  }

  return result
}

// ── applyStayEditOptimistic ───────────────────────────────────────────────────

/**
 * FE-only alias for applyStayEdit.
 * Used for the optimistic local state update before the server response arrives.
 */
export function applyStayEditOptimistic(
  days: RouteDay[],
  stayIndex: number,
  newNights: number
): RouteDay[] {
  return applyStayEdit(days, stayIndex, newNights)
}
