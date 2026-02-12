export type AlgorithmId = 'bubble' | 'selection' | 'insertion' | 'quick' | 'merge' | 'heap'

export type PatternId = 'random' | 'nearlySorted' | 'reversed'

export type DatasetGenerationSettings = {
  size: number
  pattern: PatternId
  seed?: string
  valueRange?: { min: number; max: number }
  uniqueValues?: boolean
  nearlySortedFactor?: number
}

export type DatasetSnapshot = {
  values: number[]
  initialValues: number[]
  generation: DatasetGenerationSettings & { seed: string }
}

export type PlaybackStatus = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error'

export type HighlightKind = StepEvent['type'] | 'none'

export type HighlightState = {
  indices: number[]
  kind: HighlightKind
}

export type StepEventBase = {
  id: string | number
  runId?: string
  note?: string
}

export type CompareEvent = StepEventBase & {
  type: 'compare'
  i: number
  j: number
}

export type SwapEvent = StepEventBase & {
  type: 'swap'
  i: number
  j: number
}

export type WriteEvent = StepEventBase & {
  type: 'write'
  i: number
  value: number
  prevValue?: number
}

export type MarkSortedEvent = StepEventBase & {
  type: 'markSorted'
  i: number
}

export type DoneEvent = StepEventBase & {
  type: 'done'
}

export type StepEvent =
  | (CompareEvent & { type: 'compare' })
  | (SwapEvent & { type: 'swap' })
  | (WriteEvent & { type: 'write' })
  | (MarkSortedEvent & { type: 'markSorted' })
  | (DoneEvent & { type: 'done' })

export type Metrics = {
  comparisons: number
  swaps: number
  writes: number
  arrayAccesses: number
  appliedEvents: number
  elapsedMs: number
}
