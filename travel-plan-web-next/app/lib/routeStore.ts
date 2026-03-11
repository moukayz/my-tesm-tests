import fs from 'fs'
import path from 'path'
import type { RouteDay, PlanSections } from './itinerary'
import routeJson from '../../data/route.json'

export interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
}

/** Local filesystem implementation — used in development and test environments. */
class FileRouteStore implements RouteStore {
  private readonly filePath: string

  constructor(filePath = path.join(process.cwd(), process.env.ROUTE_DATA_PATH ?? 'data/route.json')) {
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
 * Vercel KV implementation — used in production when KV_REST_API_URL is set.
 * Self-seeds from the bundled route.json on the first read if KV is empty.
 */
class KvRouteStore implements RouteStore {
  async getAll(): Promise<RouteDay[]> {
    const { kv } = await import('@vercel/kv')
    const data = await kv.get<RouteDay[]>('route')
    if (!data) {
      const seed = routeJson as RouteDay[]
      await kv.set('route', seed)
      return seed
    }
    return data
  }

  async updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay> {
    const { kv } = await import('@vercel/kv')
    const data = await this.getAll()
    data[dayIndex].plan = plan
    await kv.set('route', data)
    return data[dayIndex]
  }
}

/** Returns the appropriate store based on the runtime environment. */
export function getRouteStore(): RouteStore {
  if (process.env.KV_REST_API_URL) {
    return new KvRouteStore()
  }
  return new FileRouteStore()
}
