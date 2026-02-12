import { createRng, randInt } from './rng'
import type { DatasetGenerationSettings, DatasetSnapshot } from './types'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function createSeed() {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return `${buf[0].toString(36)}-${buf[1].toString(36)}`
}

function normalizeSettings(
  settings: DatasetGenerationSettings,
): DatasetGenerationSettings & {
  seed: string
  valueRange: { min: number; max: number }
  nearlySortedFactor: number
  uniqueValues: boolean
} {
  const seed = settings.seed && settings.seed.trim() ? settings.seed.trim() : createSeed()
  const size = clamp(Math.round(settings.size), 2, 150)
  const valueRange = settings.valueRange ?? { min: 5, max: 100 }
  const min = Math.min(valueRange.min, valueRange.max)
  const max = Math.max(valueRange.min, valueRange.max)
  const nearlySortedFactor = clamp(settings.nearlySortedFactor ?? 0.1, 0, 1)
  const uniqueValues = settings.uniqueValues ?? false
  return {
    ...settings,
    seed,
    size,
    valueRange: { min, max },
    nearlySortedFactor,
    uniqueValues,
  }
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}

export function generateDataset(settings: DatasetGenerationSettings): DatasetSnapshot {
  const gen = normalizeSettings(settings)
  const rng = createRng(gen.seed)
  const min = gen.valueRange.min
  const max = gen.valueRange.max
  const span = max - min + 1

  let values: number[]
  if (gen.uniqueValues && span >= gen.size) {
    const pool = Array.from({ length: span }, (_, i) => min + i)
    shuffleInPlace(pool, rng)
    values = pool.slice(0, gen.size)
  } else {
    values = Array.from({ length: gen.size }, () => randInt(rng, min, max))
  }

  if (gen.pattern === 'reversed') {
    values = values.slice().sort((a, b) => a - b).reverse()
  } else if (gen.pattern === 'nearlySorted') {
    values = values.slice().sort((a, b) => a - b)
    const k = Math.max(1, Math.floor(gen.size * (gen.nearlySortedFactor ?? 0.1)))
    for (let t = 0; t < k; t++) {
      const i = randInt(rng, 0, gen.size - 1)
      const j = randInt(rng, 0, gen.size - 1)
      if (i === j) continue
      const tmp = values[i]
      values[i] = values[j]
      values[j] = tmp
    }
  }

  const initialValues = values.slice()
  return { values: values.slice(), initialValues, generation: gen }
}
