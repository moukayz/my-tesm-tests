import type { RouteDay } from '../itinerary'
import type { StayLocation, StaySummary } from './types'
import { normalizeStayLocation } from '../stayLocation'

const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const dt = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(dt.getTime())) return false
  const [y, m, d] = value.split('-').map(Number)
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

export function deriveStays(days: RouteDay[]): StaySummary[] {
  if (days.length === 0) return []

  const stays: StaySummary[] = []
  let city = days[0].overnight
  let start = 0

  for (let i = 1; i <= days.length; i++) {
    const atEnd = i === days.length
    const nextCity = atEnd ? '' : days[i].overnight
    if (atEnd || nextCity !== city) {
      stays.push({
        stayIndex: stays.length,
        city,
        nights: i - start,
        startDayIndex: start,
        endDayIndex: i - 1,
        isLastStay: false,
        location: normalizeStayLocation(city, days[start].location),
      })
      city = nextCity
      start = i
    }
  }

  const lastIndex = stays.length - 1
  if (lastIndex >= 0) stays[lastIndex].isLastStay = true
  return stays
}

function blankDay(city: string, dayNum: number, location?: StayLocation): RouteDay {
  return {
    date: '',
    weekDay: '',
    dayNum,
    overnight: city,
    location: normalizeStayLocation(city, location),
    plan: { morning: '', afternoon: '', evening: '' },
    train: [],
  }
}

export function applyAppendStay(days: RouteDay[], city: string, nights: number, location?: StayLocation): RouteDay[] {
  const startDayNum = days.length + 1
  const appended = Array.from({ length: nights }, (_, idx) => blankDay(city, startDayNum + idx, location))
  return [...days, ...appended]
}

export function canRemoveTrailingDays(daysToRemove: RouteDay[]): boolean {
  return daysToRemove.every((day) => {
    const { morning, afternoon, evening } = day.plan
    const hasPlan = morning.trim() !== '' || afternoon.trim() !== '' || evening.trim() !== ''
    return !hasPlan && day.train.length === 0
  })
}

export function applyPatchStay(
  days: RouteDay[],
  stayIndex: number,
  patch: { city?: string; nights?: number; location?: StayLocation }
): RouteDay[] {
  if (patch.city === undefined && patch.nights === undefined && patch.location === undefined) {
    throw new Error('STAY_MUTATION_INVALID')
  }

  let updated: RouteDay[] = days.map((day) => ({
    ...day,
    location: normalizeStayLocation(day.overnight, day.location),
    plan: { ...day.plan },
    train: [...day.train],
  }))

  if (patch.nights !== undefined) {
    if (!Number.isInteger(patch.nights) || patch.nights < 1) throw new Error('STAY_NIGHTS_MIN')

    const stays = deriveStays(updated)
      const target = stays[stayIndex]
      if (!target) throw new Error('STAY_INDEX_INVALID')
      const targetLocation = normalizeStayLocation(target.city, target.location)

      if (!target.isLastStay) {
        const delta = patch.nights - target.nights
        if (delta > 0) {
          const insertAt = target.endDayIndex + 1
          const newDays = Array.from({ length: delta }, () => blankDay(target.city, 0, targetLocation))
          updated = [...updated.slice(0, insertAt), ...newDays, ...updated.slice(insertAt)]
        } else if (delta < 0) {
          const shrink = -delta
          const removeStart = target.endDayIndex - shrink + 1
          const toRemove = updated.slice(removeStart, target.endDayIndex + 1)
          if (!canRemoveTrailingDays(toRemove)) throw new Error('STAY_TRAILING_DAYS_LOCKED')
          updated = [...updated.slice(0, removeStart), ...updated.slice(target.endDayIndex + 1)]
        }
      } else {
        const delta = patch.nights - target.nights
        if (delta > 0) {
          updated = [
            ...updated,
            ...Array.from({ length: delta }, (_, idx) => blankDay(target.city, updated.length + idx + 1, targetLocation)),
          ]
        } else if (delta < 0) {
          const removeCount = -delta
        const removeStart = updated.length - removeCount
        const trailing = updated.slice(removeStart)
        if (!canRemoveTrailingDays(trailing)) throw new Error('STAY_TRAILING_DAYS_LOCKED')
        updated = updated.slice(0, removeStart)
      }
    }
  }

  if (patch.city !== undefined || patch.location !== undefined) {
    const stays = deriveStays(updated)
    const target = stays[stayIndex]
    if (!target) throw new Error('STAY_INDEX_INVALID')

    const city = patch.city !== undefined ? patch.city.trim() : target.city
    if (city.length === 0) throw new Error('STAY_CITY_REQUIRED')

    const nextLocation = patch.location
      ? normalizeStayLocation(city, patch.location)
      : patch.city !== undefined && city !== target.city
        ? normalizeStayLocation(city)
        : normalizeStayLocation(city, target.location)

    for (let i = target.startDayIndex; i <= target.endDayIndex; i++) {
      updated[i] = { ...updated[i], overnight: city, location: nextLocation }
    }
  }

  return updated
}

export function applyMoveStay(days: RouteDay[], stayIndex: number, direction: 'up' | 'down'): RouteDay[] {
  const stays = deriveStays(days)
  const target = stays[stayIndex]
  if (!target) throw new Error('STAY_INDEX_INVALID')

  const neighborIndex = direction === 'up' ? stayIndex - 1 : stayIndex + 1
  const neighbor = stays[neighborIndex]
  if (!neighbor) throw new Error('STAY_SWAP_BOUNDARY')

  const [first, second] = direction === 'up' ? [neighbor, target] : [target, neighbor]

  return [
    ...days.slice(0, first.startDayIndex),
    ...days.slice(second.startDayIndex, second.endDayIndex + 1),
    ...days.slice(first.startDayIndex, first.endDayIndex + 1),
    ...days.slice(second.endDayIndex + 1),
  ]
}

export function regenerateDerivedDates(startDate: string, days: RouteDay[]): RouteDay[] {
  if (!isValidDateString(startDate)) {
    throw new Error('INVALID_START_DATE')
  }

  const base = new Date(`${startDate}T00:00:00.000Z`)
  return days.map((day, index) => {
    const next = new Date(base)
    next.setUTCDate(base.getUTCDate() + index)
    const year = next.getUTCFullYear()
    const month = next.getUTCMonth() + 1
    const date = next.getUTCDate()

    return {
      ...day,
      date: `${year}/${month}/${date}`,
      weekDay: WEEKDAY_CN[next.getUTCDay()],
      dayNum: index + 1,
    }
  })
}
