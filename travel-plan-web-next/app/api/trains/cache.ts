type TrainRow = {
  train_name: string
  train_type: string
  railway: 'german' | 'french' | 'eurostar'
}

type TrainsCacheEntry = {
  expiresAt: number
  rows: TrainRow[]
}

const TRAINS_CACHE_TTL_MS = 60_000

let combinedTrainsCache: TrainsCacheEntry | null = null
let germanTrainsCache: TrainsCacheEntry | null = null

function cloneRows(rows: TrainRow[]): TrainRow[] {
  return rows.map((row) => ({ ...row }))
}

function isCacheFresh(entry: TrainsCacheEntry | null): entry is TrainsCacheEntry {
  return Boolean(entry && entry.expiresAt > Date.now())
}

export function readTrainsCache(cacheType: 'combined' | 'german'): TrainRow[] | null {
  const entry = cacheType === 'combined' ? combinedTrainsCache : germanTrainsCache
  if (!isCacheFresh(entry)) {
    return null
  }

  return cloneRows(entry.rows)
}

export function writeTrainsCache(cacheType: 'combined' | 'german', rows: TrainRow[]): void {
  const entry: TrainsCacheEntry = {
    expiresAt: Date.now() + TRAINS_CACHE_TTL_MS,
    rows: cloneRows(rows),
  }

  if (cacheType === 'combined') {
    combinedTrainsCache = entry
  } else {
    germanTrainsCache = entry
  }
}

export function resetTrainsCacheForTests(): void {
  combinedTrainsCache = null
  germanTrainsCache = null
}
