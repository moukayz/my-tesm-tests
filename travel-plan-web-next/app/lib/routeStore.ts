import fs from 'fs'
import path from 'path'
import type { RouteDay, PlanSections, TrainRoute, DayAttraction } from './itinerary'
import logger from './logger'

// ── TabKey ────────────────────────────────────────────────────────────────────

export type TabKey = 'route'
export const VALID_TAB_KEYS: readonly TabKey[] = ['route']

// ── RouteStore interface ──────────────────────────────────────────────────────

export interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
  updateNote(dayIndex: number, note: string): Promise<RouteDay>
  updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay>
  updateAttractions(dayIndex: number, attractions: DayAttraction[]): Promise<RouteDay>
  /** Atomically write the full RouteDay[] array. Returns the written array. */
  updateDays(days: RouteDay[]): Promise<RouteDay[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveRouteFilePath(): string {
  return path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
}

function resolveSeedFilePath(): string {
  return path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const serialized = JSON.stringify(value, null, 2)
  fs.writeFileSync(tempPath, serialized)
  fs.renameSync(tempPath, filePath)
}

// ── FileRouteStore ────────────────────────────────────────────────────────────

/** Local filesystem implementation — used in development and test environments. */
class FileRouteStore implements RouteStore {
  private readonly filePath: string
  private readonly seedFilePath: string

  constructor(filePath: string, seedFilePath: string) {
    this.filePath = filePath
    this.seedFilePath = seedFilePath
  }

  async getAll(): Promise<RouteDay[]> {
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
  }

  async updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].plan = plan
    writeJsonAtomic(this.filePath, data)
    return data[dayIndex]
  }

  async updateNote(dayIndex: number, note: string): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].note = note
    writeJsonAtomic(this.filePath, data)
    return data[dayIndex]
  }

  async updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].train = train
    writeJsonAtomic(this.filePath, data)
    return data[dayIndex]
  }

  async updateAttractions(dayIndex: number, attractions: DayAttraction[]): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].attractions = attractions
    writeJsonAtomic(this.filePath, data)
    return data[dayIndex]
  }

  async updateDays(days: RouteDay[]): Promise<RouteDay[]> {
    writeJsonAtomic(this.filePath, days)
    return days
  }
}

// ── UpstashRouteStore ─────────────────────────────────────────────────────────

/**
 * Upstash Redis implementation — used in production when Upstash env vars are set.
 * Self-seeds from the route data file on the first read if Redis is empty.
 * The Redis key and seed file path are injected via the constructor.
 */
class UpstashRouteStore implements RouteStore {
  private readonly redisKey: string
  private readonly seedFilePath: string

  constructor(redisKey: string, seedFilePath: string) {
    this.redisKey = redisKey
    this.seedFilePath = seedFilePath
  }

  async getAll(): Promise<RouteDay[]> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await redis.get<RouteDay[]>(this.redisKey)
    if (!data) {
      const seed = JSON.parse(fs.readFileSync(this.seedFilePath, 'utf-8')) as RouteDay[]
      await redis.set(this.redisKey, seed)
      return seed
    }
    return data
  }

  async updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].plan = plan
    await redis.set(this.redisKey, data)
    return data[dayIndex]
  }

  async updateNote(dayIndex: number, note: string): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].note = note
    await redis.set(this.redisKey, data)
    return data[dayIndex]
  }

  async updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].train = train
    await redis.set(this.redisKey, data)
    return data[dayIndex]
  }

  async updateAttractions(dayIndex: number, attractions: DayAttraction[]): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].attractions = attractions
    await redis.set(this.redisKey, data)
    return data[dayIndex]
  }

  async updateDays(days: RouteDay[]): Promise<RouteDay[]> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    await redis.set(this.redisKey, days)
    return days
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Returns the appropriate store based on the runtime environment. */
export function getRouteStore(): RouteStore {
  const hasKvRestApiUrl = Boolean(process.env.KV_REST_API_URL)
  const hasKvRestApiToken = Boolean(process.env.KV_REST_API_TOKEN)

  if (hasKvRestApiUrl && hasKvRestApiToken) {
    const redisKey = process.env.ROUTE_REDIS_KEY ?? 'route'
    const seedFilePath = resolveSeedFilePath()
    logger.info(
      { backend: 'upstash-redis', redisKey, hasKvRestApiUrl, hasKvRestApiToken },
      'RouteStore backend selected'
    )
    return new UpstashRouteStore(redisKey, seedFilePath)
  }

  if (hasKvRestApiUrl || hasKvRestApiToken) {
    logger.warn(
      { hasKvRestApiUrl, hasKvRestApiToken },
      'KV env is incomplete, falling back to FileRouteStore'
    )
  }

  const filePath = resolveRouteFilePath()
  const seedFilePath = resolveSeedFilePath()
  logger.info({ backend: 'local-file', routeFilePath: filePath }, 'RouteStore backend selected')
  return new FileRouteStore(filePath, seedFilePath)
}
