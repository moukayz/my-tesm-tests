import fs from 'fs'
import path from 'path'
import type { RouteDay, PlanSections, TrainRoute } from './itinerary'
import logger from './logger'

// ── TabKey ────────────────────────────────────────────────────────────────────

export type TabKey = 'route' | 'route-test'
export const VALID_TAB_KEYS: readonly TabKey[] = ['route', 'route-test']

// ── RouteStore interface ──────────────────────────────────────────────────────

export interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
  updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay>
  /** Atomically write the full RouteDay[] array. Returns the written array. */
  updateDays(days: RouteDay[]): Promise<RouteDay[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveRouteFilePath(tabKey: TabKey): string {
  if (tabKey === 'route-test') {
    return path.join(
      process.cwd(),
      process.env.ROUTE_TEST_DATA_PATH ?? 'data/route-test.json'
    )
  }
  return path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
}

function resolveSeedFilePath(): string {
  return path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
}

// ── FileRouteStore ────────────────────────────────────────────────────────────

/** Local filesystem implementation — used in development and test environments. */
class FileRouteStore implements RouteStore {
  private readonly filePath: string
  private readonly seedFilePath: string
  private readonly isTestTab: boolean

  constructor(filePath: string, seedFilePath: string, isTestTab = false) {
    this.filePath = filePath
    this.seedFilePath = seedFilePath
    this.isTestTab = isTestTab
  }

  async getAll(): Promise<RouteDay[]> {
    // Auto-seed for the test tab if the test file does not exist yet
    if (this.isTestTab && !fs.existsSync(this.filePath)) {
      const seed = fs.readFileSync(this.seedFilePath, 'utf-8')
      fs.writeFileSync(this.filePath, seed)
    }
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
  }

  async updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].plan = plan
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
    return data[dayIndex]
  }

  async updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay> {
    const data = await this.getAll()
    data[dayIndex].train = train
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
    return data[dayIndex]
  }

  async updateDays(days: RouteDay[]): Promise<RouteDay[]> {
    fs.writeFileSync(this.filePath, JSON.stringify(days, null, 2))
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

  async updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].train = train
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

/** Returns the appropriate store based on the runtime environment and tabKey. */
export function getRouteStore(tabKey: TabKey = 'route'): RouteStore {
  const hasKvRestApiUrl = Boolean(process.env.KV_REST_API_URL)
  const hasKvRestApiToken = Boolean(process.env.KV_REST_API_TOKEN)

  if (hasKvRestApiUrl && hasKvRestApiToken) {
    const redisKey =
      tabKey === 'route-test'
        ? (process.env.ROUTE_TEST_REDIS_KEY ?? 'route-test')
        : (process.env.ROUTE_REDIS_KEY ?? 'route')

    const seedFilePath = resolveSeedFilePath()

    logger.info(
      { backend: 'upstash-redis', tabKey, redisKey, hasKvRestApiUrl, hasKvRestApiToken },
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

  const filePath = resolveRouteFilePath(tabKey)
  const seedFilePath = resolveSeedFilePath()
  const isTestTab = tabKey === 'route-test'

  logger.info({ backend: 'local-file', tabKey, routeFilePath: filePath }, 'RouteStore backend selected')
  return new FileRouteStore(filePath, seedFilePath, isTestTab)
}
