import type { HighlightState, Metrics, StepEvent } from './types'

export function createEmptyMetrics(): Metrics {
  return {
    comparisons: 0,
    swaps: 0,
    writes: 0,
    arrayAccesses: 0,
    appliedEvents: 0,
    elapsedMs: 0,
  }
}

export type ApplyResult = {
  changedIndices: number[]
  sortedChangedIndices: number[]
  highlight: HighlightState
}

export type ApplyTarget = {
  values: number[]
  sorted: boolean[]
  metrics: Metrics
  highlight: HighlightState
  status: 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error'
}

function bumpApplied(m: Metrics) {
  m.appliedEvents += 1
}

export function applyEvent(target: ApplyTarget, ev: StepEvent): ApplyResult {
  const values = target.values
  const sorted = target.sorted
  const m = target.metrics

  if (ev.type === 'compare') {
    m.comparisons += 1
    m.arrayAccesses += 2
    bumpApplied(m)
    target.highlight = { indices: [ev.i, ev.j], kind: 'compare' }
    return { changedIndices: [], sortedChangedIndices: [], highlight: target.highlight }
  }

  if (ev.type === 'swap') {
    const i = ev.i
    const j = ev.j
    const tmp = values[i]
    values[i] = values[j]
    values[j] = tmp
    m.swaps += 1
    m.writes += 2
    m.arrayAccesses += 4
    bumpApplied(m)
    target.highlight = { indices: [i, j], kind: 'swap' }
    return { changedIndices: [i, j], sortedChangedIndices: [], highlight: target.highlight }
  }

  if (ev.type === 'write') {
    const i = ev.i
    const prev = values[i]
    if (ev.prevValue != null && ev.prevValue !== prev) {
      target.status = 'error'
      target.highlight = { indices: [], kind: 'none' }
      return { changedIndices: [], sortedChangedIndices: [], highlight: target.highlight }
    }
    values[i] = ev.value
    m.writes += 1
    m.arrayAccesses += 2
    bumpApplied(m)
    target.highlight = { indices: [i], kind: 'write' }
    return { changedIndices: [i], sortedChangedIndices: [], highlight: target.highlight }
  }

  if (ev.type === 'markSorted') {
    sorted[ev.i] = true
    bumpApplied(m)
    target.highlight = { indices: [ev.i], kind: 'markSorted' }
    return { changedIndices: [], sortedChangedIndices: [ev.i], highlight: target.highlight }
  }

  if (ev.type === 'done') {
    bumpApplied(m)
    target.status = 'done'
    target.highlight = { indices: [], kind: 'none' }
    return { changedIndices: [], sortedChangedIndices: [], highlight: target.highlight }
  }

  target.status = 'error'
  target.highlight = { indices: [], kind: 'none' }
  return { changedIndices: [], sortedChangedIndices: [], highlight: target.highlight }
}
