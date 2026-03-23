import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { RouteDay } from '../itinerary'
import logger from '../logger'
import type { CreateShellInput, ItineraryRecord, ItineraryStore } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function nextUpdatedAt(previousIso: string): string {
  const now = new Date()
  const previous = new Date(previousIso)
  if (Number.isNaN(previous.getTime())) return now.toISOString()
  if (now.getTime() > previous.getTime()) return now.toISOString()
  return new Date(previous.getTime() + 1).toISOString()
}

function hashOwnerEmail(ownerEmail: string): string {
  return crypto.createHash('sha256').update(ownerEmail).digest('hex')
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function getBaseDir(): string {
  const configured = process.env.ITINERARY_DATA_DIR ?? 'data/itineraries'
  if (path.isAbsolute(configured)) return configured
  return path.join(process.cwd(), configured)
}

function getRecordFilePath(baseDir: string, itineraryId: string): string {
  return path.join(baseDir, `${itineraryId}.json`)
}

function getOwnerIndexFilePath(baseDir: string, ownerEmail: string): string {
  return path.join(baseDir, 'index', `${hashOwnerEmail(ownerEmail)}.json`)
}

class FileItineraryStore implements ItineraryStore {
  constructor(private readonly baseDir: string) {}

  private ensureLayout(): void {
    fs.mkdirSync(this.baseDir, { recursive: true })
    fs.mkdirSync(path.join(this.baseDir, 'index'), { recursive: true })
  }

  private readOwnerIndex(ownerEmail: string): string[] {
    const filePath = getOwnerIndexFilePath(this.baseDir, ownerEmail)
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as string[]
  }

  private writeOwnerIndex(ownerEmail: string, ids: string[]): void {
    const filePath = getOwnerIndexFilePath(this.baseDir, ownerEmail)
    fs.writeFileSync(filePath, JSON.stringify(dedupePreserveOrder(ids), null, 2))
  }

  private writeRecord(record: ItineraryRecord): void {
    const filePath = getRecordFilePath(this.baseDir, record.id)
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2))
  }

  async createShell(input: CreateShellInput): Promise<ItineraryRecord> {
    this.ensureLayout()
    const timestamp = nowIso()
    const record: ItineraryRecord = {
      id: crypto.randomUUID(),
      ownerEmail: input.ownerEmail,
      name: input.name,
      startDate: input.startDate,
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
      days: [],
    }

    this.writeRecord(record)
    this.writeOwnerIndex(record.ownerEmail, [record.id, ...this.readOwnerIndex(record.ownerEmail)])
    return record
  }

  async getById(itineraryId: string): Promise<ItineraryRecord | null> {
    this.ensureLayout()
    const filePath = getRecordFilePath(this.baseDir, itineraryId)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ItineraryRecord
  }

  async listByOwner(ownerEmail: string): Promise<ItineraryRecord[]> {
    this.ensureLayout()
    const ids = this.readOwnerIndex(ownerEmail)
    const records: ItineraryRecord[] = []
    for (const id of ids) {
      const record = await this.getById(id)
      if (!record) continue
      if (record.ownerEmail !== ownerEmail) continue
      records.push(record)
    }
    records.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return records
  }

  async getLatestByOwner(ownerEmail: string): Promise<ItineraryRecord | null> {
    const items = await this.listByOwner(ownerEmail)
    return items[0] ?? null
  }

  async replaceDays(itineraryId: string, expectedUpdatedAt: string, days: RouteDay[]): Promise<ItineraryRecord | null> {
    this.ensureLayout()
    const current = await this.getById(itineraryId)
    if (!current) return null
    if (current.updatedAt !== expectedUpdatedAt) return null

    const updated: ItineraryRecord = {
      ...current,
      days,
      updatedAt: nextUpdatedAt(current.updatedAt),
    }

    this.writeRecord(updated)
    this.writeOwnerIndex(updated.ownerEmail, [updated.id, ...this.readOwnerIndex(updated.ownerEmail)])
    return updated
  }
}

class UpstashItineraryStore implements ItineraryStore {
  async createShell(input: CreateShellInput): Promise<ItineraryRecord> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const timestamp = nowIso()
    const record: ItineraryRecord = {
      id: crypto.randomUUID(),
      ownerEmail: input.ownerEmail,
      name: input.name,
      startDate: input.startDate,
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
      days: [],
    }

    await redis.set(`itinerary:${record.id}`, record)
    const indexKey = `user-itineraries:${record.ownerEmail}`
    const current = (await redis.get<string[]>(indexKey)) ?? []
    await redis.set(indexKey, dedupePreserveOrder([record.id, ...current]))
    return record
  }

  async getById(itineraryId: string): Promise<ItineraryRecord | null> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const value = await redis.get<ItineraryRecord>(`itinerary:${itineraryId}`)
    return value ?? null
  }

  async listByOwner(ownerEmail: string): Promise<ItineraryRecord[]> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const ids = (await redis.get<string[]>(`user-itineraries:${ownerEmail}`)) ?? []
    const records: ItineraryRecord[] = []
    for (const id of ids) {
      const record = await this.getById(id)
      if (!record) continue
      if (record.ownerEmail !== ownerEmail) continue
      records.push(record)
    }
    records.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    return records
  }

  async getLatestByOwner(ownerEmail: string): Promise<ItineraryRecord | null> {
    const items = await this.listByOwner(ownerEmail)
    return items[0] ?? null
  }

  async replaceDays(itineraryId: string, expectedUpdatedAt: string, days: RouteDay[]): Promise<ItineraryRecord | null> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const current = await this.getById(itineraryId)
    if (!current) return null
    if (current.updatedAt !== expectedUpdatedAt) return null

    const updated: ItineraryRecord = {
      ...current,
      days,
      updatedAt: nextUpdatedAt(current.updatedAt),
    }

    await redis.set(`itinerary:${itineraryId}`, updated)
    const indexKey = `user-itineraries:${updated.ownerEmail}`
    const index = (await redis.get<string[]>(indexKey)) ?? []
    await redis.set(indexKey, dedupePreserveOrder([updated.id, ...index]))
    return updated
  }
}

export function getItineraryStore(): ItineraryStore {
  const hasUrl = Boolean(process.env.KV_REST_API_URL)
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN)

  if (hasUrl && hasToken) {
    logger.info({ backend: 'upstash-redis' }, 'ItineraryStore backend selected')
    return new UpstashItineraryStore()
  }

  if (hasUrl || hasToken) {
    logger.warn({ hasUrl, hasToken }, 'KV env is incomplete, falling back to FileItineraryStore')
  }

  const baseDir = getBaseDir()
  logger.info({ backend: 'local-file', baseDir }, 'ItineraryStore backend selected')
  return new FileItineraryStore(baseDir)
}
