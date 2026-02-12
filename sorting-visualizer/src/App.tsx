import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type AlgorithmId,
  type DatasetGenerationSettings,
  type HighlightState,
  type Metrics,
  type PatternId,
  type PlaybackStatus,
  type StepEvent,
  applyEvent,
  createEmptyMetrics,
  createSeed,
  generateDataset,
  generateEvents,
  validateEvents,
} from './engine'
import { HelpModal } from './ui/HelpModal'
import { MetricsPanel } from './ui/MetricsPanel'
import { ControlsPanel } from './ui/ControlsPanel'
import { Visualizer } from './ui/Visualizer'
import { usePrefersReducedMotion } from './ui/usePrefersReducedMotion'
import { useKeymap } from './ui/useKeymap'
import './app.css'

type AppViewState = {
  status: PlaybackStatus
  showAll: boolean
  algorithmId: AlgorithmId
  speedEps: number
  settings: DatasetGenerationSettings
  cursor: number
  totalEvents: number
  metrics: Metrics
  highlight: HighlightState
  error?: string
}

type RenderPatch = {
  kind: 'full' | 'patch'
  changedIndices: number[]
  sortedChangedIndices: number[]
  highlight: HighlightState
  valuesVersion: number
}

type Runtime = {
  values: number[]
  initialValues: number[]
  events: StepEvent[]
  cursor: number
  sorted: boolean[]
  metrics: Metrics
  highlight: HighlightState
  status: PlaybackStatus
  runId: string
  lastTickTs?: number
  accMs: number
}

type AlgoRuntime = {
  algorithmId: AlgorithmId
  values: number[]
  events: StepEvent[]
  cursor: number
  sorted: boolean[]
  metrics: Metrics
  highlight: HighlightState
  status: PlaybackStatus
}

type AllRuntime = {
  initialValues: number[]
  algos: Record<AlgorithmId, AlgoRuntime>
  status: PlaybackStatus
  runId: string
  lastTickTs?: number
  accMs: number
}

const DEFAULT_SETTINGS: DatasetGenerationSettings = {
  size: 60,
  pattern: 'random',
  seed: createSeed(),
  valueRange: { min: 5, max: 100 },
  uniqueValues: false,
  nearlySortedFactor: 0.1,
}

const DEFAULT_ALGO: AlgorithmId = 'bubble'
const DEFAULT_EPS = 120

const ALL_ALGOS: AlgorithmId[] = ['bubble', 'selection', 'insertion', 'quick', 'merge', 'heap']

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function copy(values: number[]) {
  return values.slice()
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion()
  const rafRef = useRef<number | null>(null)
  const speedRef = useRef(DEFAULT_EPS)
  const reducedMotionRef = useRef(false)
  const valuesVersionRef = useRef(1)
  const runtimeRef = useRef<Runtime>({
    values: [],
    initialValues: [],
    events: [],
    cursor: 0,
    sorted: [],
    metrics: createEmptyMetrics(),
    highlight: { indices: [], kind: 'none' },
    status: 'idle',
    runId: 'init',
    accMs: 0,
  })

  const allRef = useRef<AllRuntime>({
    initialValues: [],
    algos: Object.create(null) as Record<AlgorithmId, AlgoRuntime>,
    status: 'idle',
    runId: 'all_init',
    accMs: 0,
  })

  const [helpOpen, setHelpOpen] = useState(false)
  const [patch, setPatch] = useState<RenderPatch>(() => ({
    kind: 'full',
    changedIndices: [],
    sortedChangedIndices: [],
    highlight: { indices: [], kind: 'none' },
    valuesVersion: valuesVersionRef.current,
  }))

  const [allPatches, setAllPatches] = useState<Record<AlgorithmId, RenderPatch>>(() => {
    const blank: RenderPatch = {
      kind: 'full',
      changedIndices: [],
      sortedChangedIndices: [],
      highlight: { indices: [], kind: 'none' },
      valuesVersion: valuesVersionRef.current,
    }
    const rec = Object.create(null) as Record<AlgorithmId, RenderPatch>
    for (const a of ALL_ALGOS) rec[a] = blank
    return rec
  })

  const [view, setView] = useState<AppViewState>(() => ({
    status: 'idle',
    showAll: false,
    algorithmId: DEFAULT_ALGO,
    speedEps: DEFAULT_EPS,
    settings: DEFAULT_SETTINGS,
    cursor: 0,
    totalEvents: 0,
    metrics: createEmptyMetrics(),
    highlight: { indices: [], kind: 'none' },
  }))

  const maxSize = 150

  useEffect(() => {
    speedRef.current = view.speedEps
  }, [view.speedEps])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  const canEditSetup = view.status === 'idle' || view.status === 'ready' || view.status === 'done' || view.status === 'error'
  const canStart = view.status === 'ready' || view.status === 'done'
  const canPause = view.status === 'running'
  const canResume = view.status === 'paused'
  const canStep = view.status === 'paused' || view.status === 'ready'

  const datasetLabel = useMemo(() => {
    const p = view.settings.pattern
    if (p === 'random') return 'Random'
    if (p === 'nearlySorted') return 'Nearly sorted'
    return 'Reversed'
  }, [view.settings.pattern])

  function stopRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function initAllFromInitial(initialValues: number[], seed: string) {
    const ar = allRef.current
    ar.initialValues = copy(initialValues)
    ar.status = initialValues.length ? 'ready' : 'idle'
    ar.runId = `all_${seed}`
    ar.lastTickTs = undefined
    ar.accMs = 0

    const algos = Object.create(null) as Record<AlgorithmId, AlgoRuntime>
    for (const algorithmId of ALL_ALGOS) {
      algos[algorithmId] = {
        algorithmId,
        values: copy(initialValues),
        events: [],
        cursor: 0,
        sorted: Array.from({ length: initialValues.length }, () => false),
        metrics: createEmptyMetrics(),
        highlight: { indices: [], kind: 'none' },
        status: ar.status,
      }
    }
    ar.algos = algos

    valuesVersionRef.current += 1
    setAllPatches(() => {
      const rec = Object.create(null) as Record<AlgorithmId, RenderPatch>
      for (const algorithmId of ALL_ALGOS) {
        rec[algorithmId] = {
          kind: 'full',
          changedIndices: [],
          sortedChangedIndices: [],
          highlight: { indices: [], kind: 'none' },
          valuesVersion: valuesVersionRef.current,
        }
      }
      return rec
    })
  }

  function syncViewFromRuntime(extra?: Partial<AppViewState>) {
    const rt = runtimeRef.current
    setView((prev) => ({
      ...prev,
      status: rt.status,
      cursor: rt.cursor,
      totalEvents: rt.events.length,
      metrics: { ...rt.metrics },
      highlight: rt.highlight,
      error: rt.status === 'error' ? (prev.error ?? 'Something went wrong.') : undefined,
      ...extra,
    }))
  }

  function fullRender() {
    valuesVersionRef.current += 1
    const rt = runtimeRef.current
    setPatch({
      kind: 'full',
      changedIndices: [],
      sortedChangedIndices: [],
      highlight: rt.highlight,
      valuesVersion: valuesVersionRef.current,
    })
  }

  function fullRenderAll() {
    valuesVersionRef.current += 1
    const ar = allRef.current
    setAllPatches(() => {
      const rec = Object.create(null) as Record<AlgorithmId, RenderPatch>
      for (const algorithmId of ALL_ALGOS) {
        rec[algorithmId] = {
          kind: 'full',
          changedIndices: [],
          sortedChangedIndices: [],
          highlight: ar.algos[algorithmId]?.highlight ?? { indices: [], kind: 'none' },
          valuesVersion: valuesVersionRef.current,
        }
      }
      return rec
    })
  }

  function pushPatch(changed: Set<number>, sortedChanged: Set<number>, highlight: HighlightState) {
    valuesVersionRef.current += 1
    setPatch({
      kind: 'patch',
      changedIndices: Array.from(changed),
      sortedChangedIndices: Array.from(sortedChanged),
      highlight,
      valuesVersion: valuesVersionRef.current,
    })
  }

  function resetToInitial(nextStatus: PlaybackStatus) {
    stopRaf()
    const rt = runtimeRef.current
    rt.values = copy(rt.initialValues)
    rt.events = []
    rt.cursor = 0
    rt.metrics = createEmptyMetrics()
    rt.highlight = { indices: [], kind: 'none' }
    rt.sorted = Array.from({ length: rt.values.length }, () => false)
    rt.status = nextStatus
    rt.lastTickTs = undefined
    rt.accMs = 0
    syncViewFromRuntime({ error: undefined })
    fullRender()
  }

  function resetAllToInitial(nextStatus: PlaybackStatus) {
    stopRaf()
    const ar = allRef.current
    ar.status = nextStatus
    ar.lastTickTs = undefined
    ar.accMs = 0
    for (const algorithmId of ALL_ALGOS) {
      const rt = ar.algos[algorithmId]
      rt.values = copy(ar.initialValues)
      rt.events = []
      rt.cursor = 0
      rt.metrics = createEmptyMetrics()
      rt.highlight = { indices: [], kind: 'none' }
      rt.sorted = Array.from({ length: rt.values.length }, () => false)
      rt.status = nextStatus
    }
    setView((prev) => ({
      ...prev,
      status: nextStatus,
      cursor: 0,
      totalEvents: 0,
      metrics: createEmptyMetrics(),
      highlight: { indices: [], kind: 'none' },
      error: undefined,
    }))
    fullRenderAll()
  }

  function doGenerate(settings: DatasetGenerationSettings) {
    stopRaf()
    const bounded: DatasetGenerationSettings = {
      ...settings,
      size: clamp(Math.round(settings.size), 2, maxSize),
      seed: settings.seed && settings.seed.trim() ? settings.seed : createSeed(),
      valueRange: settings.valueRange ?? DEFAULT_SETTINGS.valueRange,
      nearlySortedFactor: settings.nearlySortedFactor ?? DEFAULT_SETTINGS.nearlySortedFactor,
      uniqueValues: settings.uniqueValues ?? false,
    }
    const ds = generateDataset(bounded)

    const rt = runtimeRef.current
    rt.initialValues = copy(ds.initialValues)
    rt.values = copy(ds.initialValues)
    rt.sorted = Array.from({ length: rt.values.length }, () => false)
    rt.events = []
    rt.cursor = 0
    rt.metrics = createEmptyMetrics()
    rt.highlight = { indices: [], kind: 'none' }
    rt.status = 'ready'
    rt.runId = `run_${ds.generation.seed}`
    rt.lastTickTs = undefined
    rt.accMs = 0

    setView((prev) => ({
      ...prev,
      settings: ds.generation,
      status: 'ready',
      cursor: 0,
      totalEvents: 0,
      metrics: createEmptyMetrics(),
      highlight: { indices: [], kind: 'none' },
      error: undefined,
    }))
    fullRender()

    initAllFromInitial(ds.initialValues, ds.generation.seed)
  }

  function ensureEvents() {
    const rt = runtimeRef.current
    if (rt.events.length) return
    const events = generateEvents(rt.initialValues, view.algorithmId, rt.runId)
    const v = validateEvents(rt.initialValues.length, events)
    if (!v.ok) {
      rt.status = 'error'
      syncViewFromRuntime({ error: v.message })
      return
    }
    rt.events = events
    rt.cursor = 0
    rt.metrics = createEmptyMetrics()
    rt.highlight = { indices: [], kind: 'none' }
    rt.sorted = Array.from({ length: rt.values.length }, () => false)
    syncViewFromRuntime({ totalEvents: events.length })
  }

  function ensureAllEvents(): boolean {
    const ar = allRef.current
    for (const algorithmId of ALL_ALGOS) {
      const rt = ar.algos[algorithmId]
      if (rt.events.length) continue
      const events = generateEvents(ar.initialValues, algorithmId, ar.runId)
      const v = validateEvents(ar.initialValues.length, events)
      if (!v.ok) {
        ar.status = 'error'
        rt.status = 'error'
        setView((prev) => ({ ...prev, status: 'error', error: v.message }))
        return false
      }
      rt.events = events
      rt.cursor = 0
      rt.metrics = createEmptyMetrics()
      rt.highlight = { indices: [], kind: 'none' }
      rt.sorted = Array.from({ length: rt.values.length }, () => false)
      rt.status = ar.status
    }

    return true
  }

  function applyN(n: number) {
    const rt = runtimeRef.current
    const changed = new Set<number>()
    const sortedChanged = new Set<number>()
    let lastHighlight = rt.highlight

    for (let k = 0; k < n; k++) {
      const ev = rt.events[rt.cursor]
      if (!ev) break
      const res = applyEvent(rt, ev)
      for (const idx of res.changedIndices) changed.add(idx)
      for (const idx of res.sortedChangedIndices) sortedChanged.add(idx)
      lastHighlight = res.highlight
      rt.cursor += 1
      if (rt.status === 'done' || rt.status === 'error') break
    }

    rt.highlight = lastHighlight
    pushPatch(changed, sortedChanged, lastHighlight)
    syncViewFromRuntime()
  }

  function applyNAll(n: number) {
    const ar = allRef.current
    const changedByAlgo = Object.create(null) as Record<AlgorithmId, Set<number>>
    const sortedChangedByAlgo = Object.create(null) as Record<AlgorithmId, Set<number>>
    const highlightByAlgo = Object.create(null) as Record<AlgorithmId, HighlightState>

    for (const algorithmId of ALL_ALGOS) {
      changedByAlgo[algorithmId] = new Set<number>()
      sortedChangedByAlgo[algorithmId] = new Set<number>()
      highlightByAlgo[algorithmId] = ar.algos[algorithmId].highlight
    }

    for (const algorithmId of ALL_ALGOS) {
      const rt = ar.algos[algorithmId]
      if (rt.status === 'done' || rt.status === 'error') continue
      let lastHighlight = rt.highlight
      for (let k = 0; k < n; k++) {
        const ev = rt.events[rt.cursor]
        if (!ev) break
        const res = applyEvent(rt, ev)
        for (const idx of res.changedIndices) changedByAlgo[algorithmId].add(idx)
        for (const idx of res.sortedChangedIndices) sortedChangedByAlgo[algorithmId].add(idx)
        lastHighlight = res.highlight
        rt.cursor += 1
        if (ev.type === 'done') break
        const s = (rt as { status: PlaybackStatus }).status
        if (s === 'done' || s === 'error') break
      }
      rt.highlight = lastHighlight
      highlightByAlgo[algorithmId] = lastHighlight
    }

    valuesVersionRef.current += 1
    setAllPatches(() => {
      const rec = Object.create(null) as Record<AlgorithmId, RenderPatch>
      for (const algorithmId of ALL_ALGOS) {
        rec[algorithmId] = {
          kind: 'patch',
          changedIndices: Array.from(changedByAlgo[algorithmId]),
          sortedChangedIndices: Array.from(sortedChangedByAlgo[algorithmId]),
          highlight: highlightByAlgo[algorithmId],
          valuesVersion: valuesVersionRef.current,
        }
      }
      return rec
    })

    const allDone = ALL_ALGOS.every((a) => ar.algos[a].status === 'done')
    if (allDone) {
      ar.status = 'done'
      for (const a of ALL_ALGOS) {
        if (ar.algos[a].status !== 'error') ar.algos[a].status = 'done'
      }
    }

    setView((prev) => ({ ...prev, status: ar.status }))
  }

  function tick(ts: number) {
    const rt = runtimeRef.current
    if (rt.status !== 'running') return

    if (rt.lastTickTs == null) rt.lastTickTs = ts
    const dt = Math.min(80, ts - rt.lastTickTs)
    rt.lastTickTs = ts
    rt.metrics.elapsedMs += dt

    const eps = clamp(speedRef.current, 1, 2000)
    const msPerEvent = 1000 / eps
    rt.accMs += dt

    const MAX_EVENTS_PER_FRAME = reducedMotionRef.current ? 500 : 220
    let budget = Math.floor(rt.accMs / msPerEvent)
    budget = clamp(budget, 0, MAX_EVENTS_PER_FRAME)

    if (budget > 0) {
      rt.accMs -= budget * msPerEvent
      applyN(budget)
    } else {
      // keep highlight visible even when no events are applied
      syncViewFromRuntime()
    }

    if (rt.status === 'running') {
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  function tickAll(ts: number) {
    const ar = allRef.current
    if (ar.status !== 'running') return

    if (ar.lastTickTs == null) ar.lastTickTs = ts
    const dt = Math.min(80, ts - ar.lastTickTs)
    ar.lastTickTs = ts
    for (const algorithmId of ALL_ALGOS) {
      const rt = ar.algos[algorithmId]
      if (rt.status === 'running') rt.metrics.elapsedMs += dt
    }

    const eps = clamp(speedRef.current, 1, 2000)
    const msPerEvent = 1000 / eps
    ar.accMs += dt

    const MAX_EVENTS_PER_FRAME_PER_LANE = reducedMotionRef.current ? 160 : 90
    let budget = Math.floor(ar.accMs / msPerEvent)
    budget = clamp(budget, 0, MAX_EVENTS_PER_FRAME_PER_LANE)

    if (budget > 0) {
      ar.accMs -= budget * msPerEvent
      applyNAll(budget)
    }

    if (ar.status === 'running') {
      rafRef.current = requestAnimationFrame(tickAll)
    }
  }

  function start() {
    if (view.showAll) {
      const ar = allRef.current
      if (!(ar.status === 'ready' || ar.status === 'done')) return

      ar.runId = `all_${view.settings.seed}_${Date.now().toString(36)}`
      ar.status = 'running'
      ar.lastTickTs = undefined
      ar.accMs = 0

      for (const algorithmId of ALL_ALGOS) {
        const rt = ar.algos[algorithmId]
        rt.values = copy(ar.initialValues)
        rt.cursor = 0
        rt.metrics = createEmptyMetrics()
        rt.sorted = Array.from({ length: rt.values.length }, () => false)
        rt.highlight = { indices: [], kind: 'none' }
        rt.status = 'running'

        const events = generateEvents(ar.initialValues, algorithmId, ar.runId)
        const v = validateEvents(ar.initialValues.length, events)
        if (!v.ok) {
          ar.status = 'error'
          rt.status = 'error'
          setView((prev) => ({ ...prev, status: 'error', error: v.message }))
          return
        }
        rt.events = events
      }

      setView((prev) => ({ ...prev, status: 'running', error: undefined }))
      fullRenderAll()
      rafRef.current = requestAnimationFrame(tickAll)
      return
    }

    const rt = runtimeRef.current
    if (!(rt.status === 'ready' || rt.status === 'done')) return

    // Always start from initial snapshot
    rt.values = copy(rt.initialValues)
    rt.cursor = 0
    rt.metrics = createEmptyMetrics()
    rt.sorted = Array.from({ length: rt.values.length }, () => false)
    rt.highlight = { indices: [], kind: 'none' }

    rt.runId = `run_${view.settings.seed}_${Date.now().toString(36)}`
    const events = generateEvents(rt.initialValues, view.algorithmId, rt.runId)
    const v = validateEvents(rt.initialValues.length, events)
    if (!v.ok) {
      rt.status = 'error'
      syncViewFromRuntime({ error: v.message })
      return
    }
    rt.events = events
    rt.status = 'running'
    rt.lastTickTs = undefined
    rt.accMs = 0

    syncViewFromRuntime({ totalEvents: events.length, error: undefined })
    fullRender()
    rafRef.current = requestAnimationFrame(tick)
  }

  function pause() {
    if (view.showAll) {
      const ar = allRef.current
      if (ar.status !== 'running') return
      stopRaf()
      ar.status = 'paused'
      ar.lastTickTs = undefined
      for (const algorithmId of ALL_ALGOS) {
        const rt = ar.algos[algorithmId]
        if (rt.status === 'running') rt.status = 'paused'
      }
      setView((prev) => ({ ...prev, status: 'paused' }))
      return
    }

    const rt = runtimeRef.current
    if (rt.status !== 'running') return
    stopRaf()
    rt.status = 'paused'
    rt.lastTickTs = undefined
    syncViewFromRuntime()
  }

  function resume() {
    if (view.showAll) {
      const ar = allRef.current
      if (ar.status !== 'paused') return
      ar.status = 'running'
      ar.lastTickTs = undefined
      for (const algorithmId of ALL_ALGOS) {
        const rt = ar.algos[algorithmId]
        if (rt.status === 'paused') rt.status = 'running'
      }
      setView((prev) => ({ ...prev, status: 'running' }))
      rafRef.current = requestAnimationFrame(tickAll)
      return
    }

    const rt = runtimeRef.current
    if (rt.status !== 'paused') return
    rt.status = 'running'
    rt.lastTickTs = undefined
    syncViewFromRuntime()
    rafRef.current = requestAnimationFrame(tick)
  }

  function step() {
    if (view.showAll) {
      const ar = allRef.current
      if (!(ar.status === 'paused' || ar.status === 'ready')) return
      stopRaf()
      if (ar.status === 'ready') ar.status = 'paused'
      if (!ensureAllEvents()) return
      for (const algorithmId of ALL_ALGOS) {
        const rt = ar.algos[algorithmId]
        if (rt.status === 'ready') rt.status = 'paused'
      }
      setView((prev) => ({ ...prev, status: 'paused', error: undefined }))
      applyNAll(1)
      return
    }

    const rt = runtimeRef.current
    if (!(rt.status === 'paused' || rt.status === 'ready')) return
    stopRaf()
    ensureEvents()
    if (!rt.events.length) return
    if (rt.status === 'ready') rt.status = 'paused'
    applyN(1)
  }

  function reset() {
    if (view.showAll) {
      const ar = allRef.current
      const next = ar.initialValues.length ? 'ready' : 'idle'
      resetAllToInitial(next)
      return
    }

    const rt = runtimeRef.current
    const next = rt.initialValues.length ? 'ready' : 'idle'
    resetToInitial(next)
  }

  function setShowAll(showAll: boolean) {
    if (!canEditSetup) return
    stopRaf()
    setView((prev) => ({
      ...prev,
      showAll,
      status: showAll ? allRef.current.status : runtimeRef.current.status,
      error: undefined,
    }))
    if (showAll) {
      initAllFromInitial(runtimeRef.current.initialValues, view.settings.seed ?? 'seed')
      fullRenderAll()
    } else {
      const rt = runtimeRef.current
      rt.values = copy(rt.initialValues)
      rt.events = []
      rt.cursor = 0
      rt.metrics = createEmptyMetrics()
      rt.highlight = { indices: [], kind: 'none' }
      rt.sorted = Array.from({ length: rt.values.length }, () => false)
      rt.status = rt.initialValues.length ? 'ready' : 'idle'
      rt.lastTickTs = undefined
      rt.accMs = 0
      syncViewFromRuntime({ error: undefined })
      fullRender()
    }
  }

  function setAlgo(algorithmId: AlgorithmId) {
    if (view.showAll) return
    if (!canEditSetup) return
    const rt = runtimeRef.current
    rt.values = copy(rt.initialValues)
    rt.events = []
    rt.cursor = 0
    rt.metrics = createEmptyMetrics()
    rt.highlight = { indices: [], kind: 'none' }
    rt.sorted = Array.from({ length: rt.values.length }, () => false)
    rt.status = 'ready'
    rt.lastTickTs = undefined
    rt.accMs = 0
    setView((prev) => ({
      ...prev,
      algorithmId,
      status: 'ready',
      cursor: 0,
      totalEvents: 0,
      metrics: createEmptyMetrics(),
      highlight: { indices: [], kind: 'none' },
      error: undefined,
    }))
    fullRender()
  }

  function setSpeed(eps: number) {
    const next = clamp(eps, 1, 2000)
    speedRef.current = next
    setView((prev) => ({ ...prev, speedEps: next }))
  }

  function setSize(size: number) {
    if (!canEditSetup) return
    setView((prev) => ({ ...prev, settings: { ...prev.settings, size } }))
  }

  function setPattern(pattern: PatternId) {
    if (!canEditSetup) return
    setView((prev) => ({ ...prev, settings: { ...prev.settings, pattern } }))
  }

  function setSeed(seed: string) {
    if (!canEditSetup) return
    setView((prev) => ({ ...prev, settings: { ...prev.settings, seed } }))
  }

  function generate() {
    if (!canEditSetup) return
    doGenerate(view.settings)
  }

  useEffect(() => {
    // initial dataset
    doGenerate(DEFAULT_SETTINGS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useKeymap({
    enabled: true,
    onHelp: () => setHelpOpen(true),
    onToggleRun: () => {
      if (view.status === 'running') pause()
      else if (view.status === 'paused') resume()
      else if (view.status === 'ready' || view.status === 'done') start()
    },
    onStep: () => {
      if (view.status === 'paused' || view.status === 'ready') step()
    },
    onReset: () => reset(),
    onGenerate: () => generate(),
  })

  const progressPct = view.totalEvents ? Math.round((100 * view.cursor) / view.totalEvents) : 0

  const allProgressPct = (() => {
    const ar = allRef.current
    let sum = 0
    for (const algorithmId of ALL_ALGOS) {
      const rt = ar.algos[algorithmId]
      const total = rt?.events?.length ?? 0
      if (!total) {
        sum += rt?.status === 'done' ? 100 : 0
      } else {
        sum += Math.round((100 * (rt.cursor ?? 0)) / total)
      }
    }
    return Math.round(sum / ALL_ALGOS.length)
  })()

  const subtitle = useMemo(() => {
    const s = view.settings.size
    if (view.showAll) return `${datasetLabel} • ${s} items • all algorithms`
    const algo = view.algorithmId
    return `${datasetLabel} • ${s} items • ${algo}`
  }, [datasetLabel, view.settings.size, view.algorithmId, view.showAll])

  return (
    <div className="app" data-mode={view.showAll ? 'all' : 'single'}>
      <header className="top">
        <div className="brand">
          <div className="badge" aria-hidden="true">
            <span />
          </div>
          <div>
            <div className="title">Sort Studio</div>
            <div className="subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="topRight">
          <div className="statusPill" data-status={view.status}>
            <span className="dot" aria-hidden="true" />
            <span className="label">{view.status}</span>
            <span className="sep" aria-hidden="true">•</span>
            <span className="label">{view.showAll ? allProgressPct : progressPct}%</span>
          </div>
          <button className="ghost" type="button" onClick={() => setHelpOpen(true)}>
            Help
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel controls" aria-label="Controls">
          <ControlsPanel
            showAll={view.showAll}
            algorithmId={view.algorithmId}
            speedEps={view.speedEps}
            settings={view.settings}
            maxSize={maxSize}
            canEditSetup={canEditSetup}
            canStart={canStart}
            canPause={canPause}
            canResume={canResume}
            canStep={canStep}
            status={view.status}
            onSetShowAll={setShowAll}
            onSetAlgorithmId={setAlgo}
            onSetSpeedEps={setSpeed}
            onSetSize={setSize}
            onSetPattern={setPattern}
            onSetSeed={setSeed}
            onGenerate={generate}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onStep={step}
            onReset={reset}
          />
        </section>

        <section className="panel visual" aria-label="Visualizer">
          {view.showAll ? (
            <div className="visualGrid">
              {ALL_ALGOS.map((algorithmId) => {
                const rt = allRef.current.algos[algorithmId]
                const total = rt.events.length
                const pct = total ? Math.round((100 * rt.cursor) / total) : 0
                return (
                  <div className="algoCard" key={algorithmId} data-status={rt.status}>
                    <div className="algoTop">
                      <div className="algoName">{algorithmId}</div>
                      <div className="algoMeta">
                        <span className="cap">{rt.status}</span>
                        <span className="sep" aria-hidden="true">•</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                    <Visualizer
                      size={view.settings.size}
                      valueRange={view.settings.valueRange ?? DEFAULT_SETTINGS.valueRange!}
                      values={rt.values}
                      sorted={rt.sorted}
                      patch={allPatches[algorithmId]}
                      reducedMotion={reducedMotion}
                      compact
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <Visualizer
              size={view.settings.size}
              valueRange={view.settings.valueRange ?? DEFAULT_SETTINGS.valueRange!}
              values={runtimeRef.current.values}
              sorted={runtimeRef.current.sorted}
              patch={patch}
              reducedMotion={reducedMotion}
            />
          )}
        </section>

        {!view.showAll && (
          <section className="panel metrics" aria-label="Metrics">
            <MetricsPanel
              status={view.status}
              algorithmId={view.algorithmId}
              metrics={view.metrics}
              cursor={view.cursor}
              totalEvents={view.totalEvents}
              error={view.error}
              seed={view.settings.seed}
            />
          </section>
        )}
      </main>

      <footer className="foot">
        <div className="footInner">
          <span className="footText">Keyboard: Space run/pause, Right step, R reset, G generate, ? help</span>
          <a className="footLink" href="https://en.wikipedia.org/wiki/Sorting_algorithm" target="_blank" rel="noreferrer">
            Learn more about sorting
          </a>
        </div>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
