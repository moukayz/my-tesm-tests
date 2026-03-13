import fs from 'fs'
import path from 'path'
import type { RouteDay, PlanSections } from './itinerary'
import routeJson from '../../data/route.json'
import logger from './logger'

export interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
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
}

/**
 * Upstash Redis implementation — used in production when Upstash env vars are set.
 * Self-seeds from the bundled route.json on the first read if Redis is empty.
 */
class UpstashRouteStore implements RouteStore {
  async getAll(): Promise<RouteDay[]> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await redis.get<RouteDay[]>('route')
    if (!data) {
      const seed = routeJson as RouteDay[]
      await redis.set('route', seed)
      return seed
    }
    return data
  }

  async updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay> {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()
    const data = await this.getAll()
    data[dayIndex].plan = plan
    await redis.set('route', data)
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
