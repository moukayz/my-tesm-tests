/**
 * @jest-environment node
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { RouteDay } from '../../app/lib/itinerary'
import { createItineraryShell, listItineraries } from '../../app/lib/itinerary-store/service'
import { getItineraryStore } from '../../app/lib/itinerary-store/store'

const baseDays: RouteDay[] = [
  {
    date: '2026/3/21',
    weekDay: '星期六',
    dayNum: 1,
    overnight: 'Paris',
    plan: { morning: '', afternoon: '', evening: '' },
    train: [],
  },
]

describe('itinerary service', () => {
  let tempDir: string

  beforeEach(() => {
    jest.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itinerary-service-'))
    process.env.ITINERARY_DATA_DIR = tempDir
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
  })

  afterEach(() => {
    delete process.env.ITINERARY_DATA_DIR
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('listItineraries returns owner summaries ordered by updatedAt desc', async () => {
    const first = await createItineraryShell('owner@example.com', { name: 'Trip A', startDate: '2026-03-21' })
    const second = await createItineraryShell('owner@example.com', { name: 'Trip B', startDate: '2026-03-22' })
    await createItineraryShell('other@example.com', { name: 'Trip C', startDate: '2026-03-23' })

    await new Promise((resolve) => setTimeout(resolve, 5))
    const store = getItineraryStore()
    await store.replaceDays(first.itinerary.id, first.itinerary.updatedAt, baseDays)

    const list = await listItineraries('owner@example.com')

    expect(list.items).toHaveLength(2)
    expect(list.items[0].id).toBe(first.itinerary.id)
    expect(list.items[1].id).toBe(second.itinerary.id)
    expect(list.items.every((item) => !('ownerEmail' in item))).toBe(true)
    expect(list.items.every((item) => !('days' in item))).toBe(true)
  })
})
