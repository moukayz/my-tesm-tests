/**
 * @jest-environment node
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { RouteDay } from '../../app/lib/itinerary'
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

describe('itinerary store', () => {
  let tempDir: string

  beforeEach(() => {
    jest.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itinerary-store-'))
    process.env.ITINERARY_DATA_DIR = tempDir
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
  })

  afterEach(() => {
    delete process.env.ITINERARY_DATA_DIR
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('createShell persists itinerary and owner index, and listByOwner is sorted by updatedAt desc', async () => {
    const store = getItineraryStore()

    const first = await store.createShell({ ownerEmail: 'u@example.com', name: 'First', startDate: '2026-03-21' })
    const second = await store.createShell({ ownerEmail: 'u@example.com', name: 'Second', startDate: '2026-03-25' })

    await new Promise((resolve) => setTimeout(resolve, 5))
    await store.replaceDays(first.id, first.updatedAt, baseDays)

    const list = await store.listByOwner('u@example.com')
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(first.id)
    expect(list[1].id).toBe(second.id)
  })

  it('getLatestByOwner returns the newest itinerary or null', async () => {
    const store = getItineraryStore()
    expect(await store.getLatestByOwner('none@example.com')).toBeNull()

    const first = await store.createShell({ ownerEmail: 'u@example.com', name: 'First', startDate: '2026-03-21' })
    const second = await store.createShell({ ownerEmail: 'u@example.com', name: 'Second', startDate: '2026-03-25' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await store.replaceDays(first.id, first.updatedAt, baseDays)

    const latest = await store.getLatestByOwner('u@example.com')
    expect(latest?.id).toBe(first.id)
    expect(latest?.days).toEqual(baseDays)
    expect(latest?.ownerEmail).toBe('u@example.com')
    expect(latest?.id).not.toBe(second.id)
  })

  it('replaceDays rejects stale expectedUpdatedAt', async () => {
    const store = getItineraryStore()
    const created = await store.createShell({ ownerEmail: 'u@example.com', name: 'Trip', startDate: '2026-03-21' })

    const updated = await store.replaceDays(created.id, created.updatedAt, baseDays)
    expect(updated).not.toBeNull()

    const stale = await store.replaceDays(created.id, created.updatedAt, [...baseDays, { ...baseDays[0], dayNum: 2 }])
    expect(stale).toBeNull()
  })
})
