/**
 * @jest-environment node
 */

import type { ItinerarySummary } from '../../app/lib/itinerary-store/types'
import type { RouteDay } from '../../app/lib/itinerary'
import { buildItineraryCardsPayload } from '../../app/lib/itineraryCards'

function makeDay(date: string, overnight: string): RouteDay {
  return {
    date,
    weekDay: '星期一',
    dayNum: 1,
    overnight,
    plan: {
      morning: '',
      afternoon: '',
      evening: '',
    },
    train: [],
  }
}

describe('buildItineraryCardsPayload', () => {
  it('derives starter route metadata from seeded route days', () => {
    const routeDays: RouteDay[] = [
      makeDay('2026/9/25', 'Paris'),
      makeDay('2026/9/26', 'Paris'),
      makeDay('2026/9/27', 'Lyon'),
      makeDay('2026/9/28', 'Nice'),
    ]

    const payload = buildItineraryCardsPayload({ routeDays, itinerarySummaries: [] })

    expect(payload.starterRouteCard).toEqual({
      name: 'Original seeded route',
      sourceBadge: 'Starter route',
      legacyTabKey: 'route',
      startDate: '2026-09-25',
      dayCount: 4,
      stayCount: 3,
    })
  })

  it('keeps user itinerary ordering unchanged', () => {
    const itinerarySummaries: ItinerarySummary[] = [
      {
        id: 'iti-2',
        name: 'Second',
        startDate: '2026-06-10',
        status: 'draft',
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
      },
      {
        id: 'iti-1',
        name: 'First',
        startDate: '2026-05-01',
        status: 'draft',
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
    ]

    const payload = buildItineraryCardsPayload({
      routeDays: [makeDay('2026/9/25', 'Paris')],
      itinerarySummaries,
    })

    expect(payload.itinerarySummaries).toEqual(itinerarySummaries)
    expect(payload.itinerarySummaries[0].id).toBe('iti-2')
    expect(payload.itinerarySummaries[1].id).toBe('iti-1')
  })
})
