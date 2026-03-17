import fs from 'fs'
import path from 'path'
import type { RouteDay, PlanSections, TrainRoute } from './itinerary'
import logger from './logger'

export interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
  updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay>
}

function resolveRouteFilePath(): string {
  return path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
}

/** Local filesystem implementation — used in development and test environments. */
class FileRouteStore implements RouteStore {
  private readonly filePath: string

  constructor(filePath = resolveRouteFilePath()) {
    this.filePath = filePath
  }

  async getAll(): Promise<RouteDay[]> {
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
}

/**
 * Upstash Redis implementation — used in production when Upstash env vars are set.
 * Self-seeds from the route data file on the first read if Redis is empty.
 * The Redis key is configurable via ROUTE_REDIS_KEY (defaults to "route").
 * The seed file is configurable via ROUTE_DATA_PATH (defaults to "data/route.json").
 */
class UpstashRouteStore implements RouteStore {
  private get redisKey(): string {
    return process.env.ROUTE_REDIS_KEY ?? 'route'
  }

  async getAll(): Promise<RouteDay[]> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await redis.get<RouteDay[]>(this.redisKey)
    if (!data) {
      const routeFilePath = path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')
      const seed = JSON.parse(fs.readFileSync(routeFilePath, 'utf-8')) as RouteDay[]
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
}

/** Returns the appropriate store based on the runtime environment. */
export function getRouteStore(): RouteStore {
  const hasKvRestApiUrl = Boolean(process.env.KV_REST_API_URL)
  const hasKvRestApiToken = Boolean(process.env.KV_REST_API_TOKEN)

  if (hasKvRestApiUrl && hasKvRestApiToken) {
    logger.info(
      { backend: 'upstash-redis', hasKvRestApiUrl, hasKvRestApiToken },
      'RouteStore backend selected'
    )
    return new UpstashRouteStore()
  }

  if (hasKvRestApiUrl || hasKvRestApiToken) {
    logger.warn(
      { hasKvRestApiUrl, hasKvRestApiToken },
      'KV env is incomplete, falling back to FileRouteStore'
    )
  }

  const routeFilePath = resolveRouteFilePath()
  logger.info({ backend: 'local-file', routeFilePath }, 'RouteStore backend selected')
  return new FileRouteStore(routeFilePath)
}
