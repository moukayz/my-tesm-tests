import type { AlgorithmId, StepEvent } from './types'

function done(id: number, runId?: string): StepEvent {
  return { id, runId, type: 'done' }
}

export function generateEvents(initialValues: number[], algorithmId: AlgorithmId, runId?: string): StepEvent[] {
  if (algorithmId === 'bubble') return bubble(initialValues, runId)
  if (algorithmId === 'selection') return selection(initialValues, runId)
  if (algorithmId === 'insertion') return insertion(initialValues, runId)
  if (algorithmId === 'quick') return quick(initialValues, runId)
  if (algorithmId === 'merge') return merge(initialValues, runId)
  if (algorithmId === 'heap') return heap(initialValues, runId)
  return bubble(initialValues, runId)
}

function markAllSorted(n: number, startId: number, runId?: string) {
  const events: StepEvent[] = []
  let id = startId
  for (let i = 0; i < n; i++) events.push({ id: id++, runId, type: 'markSorted', i })
  return { events, nextId: id }
}

function bubble(initialValues: number[], runId?: string): StepEvent[] {
  const a = initialValues.slice()
  const events: StepEvent[] = []
  let id = 0
  const n = a.length
  for (let end = n - 1; end > 0; end--) {
    for (let j = 0; j < end; j++) {
      events.push({ id: id++, runId, type: 'compare', i: j, j: j + 1 })
      if (a[j] > a[j + 1]) {
        events.push({ id: id++, runId, type: 'swap', i: j, j: j + 1 })
        const tmp = a[j]
        a[j] = a[j + 1]
        a[j + 1] = tmp
      }
    }
    events.push({ id: id++, runId, type: 'markSorted', i: end })
  }
  events.push({ id: id++, runId, type: 'markSorted', i: 0 })
  events.push(done(id++, runId))
  return events
}

function selection(initialValues: number[], runId?: string): StepEvent[] {
  const a = initialValues.slice()
  const events: StepEvent[] = []
  let id = 0
  const n = a.length
  for (let i = 0; i < n; i++) {
    let minIdx = i
    for (let j = i + 1; j < n; j++) {
      events.push({ id: id++, runId, type: 'compare', i: minIdx, j })
      if (a[j] < a[minIdx]) minIdx = j
    }
    if (minIdx !== i) {
      events.push({ id: id++, runId, type: 'swap', i, j: minIdx })
      const tmp = a[i]
      a[i] = a[minIdx]
      a[minIdx] = tmp
    }
    events.push({ id: id++, runId, type: 'markSorted', i })
  }
  events.push(done(id++, runId))
  return events
}

function insertion(initialValues: number[], runId?: string): StepEvent[] {
  const a = initialValues.slice()
  const events: StepEvent[] = []
  let id = 0
  const n = a.length

  // Insertion sort expressed via adjacent swaps (stable, contract-friendly).
  for (let i = 1; i < n; i++) {
    let j = i
    while (j > 0) {
      events.push({ id: id++, runId, type: 'compare', i: j - 1, j })
      if (a[j - 1] > a[j]) {
        events.push({ id: id++, runId, type: 'swap', i: j - 1, j })
        const tmp = a[j - 1]
        a[j - 1] = a[j]
        a[j] = tmp
        j -= 1
      } else {
        break
      }
    }
  }

  for (let i = 0; i < n; i++) events.push({ id: id++, runId, type: 'markSorted', i })
  events.push(done(id++, runId))
  return events
}

function quick(initialValues: number[], runId?: string): StepEvent[] {
  const a = initialValues.slice()
  const events: StepEvent[] = []
  let id = 0

  function pushCompare(i: number, j: number) {
    if (i === j) return
    events.push({ id: id++, runId, type: 'compare', i, j })
  }
  function pushSwap(i: number, j: number) {
    if (i === j) return
    events.push({ id: id++, runId, type: 'swap', i, j })
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }

  function partition(lo: number, hi: number) {
    const pivot = a[hi]
    let i = lo
    for (let j = lo; j < hi; j++) {
      pushCompare(j, hi)
      if (a[j] < pivot) {
        pushSwap(i, j)
        i += 1
      }
    }
    pushSwap(i, hi)
    return i
  }

  const stack: Array<[number, number]> = [[0, a.length - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    if (lo >= hi) continue
    const p = partition(lo, hi)

    // push larger segment first to keep stack shallow
    const leftSize = p - 1 - lo
    const rightSize = hi - (p + 1)
    if (leftSize > rightSize) {
      stack.push([lo, p - 1])
      stack.push([p + 1, hi])
    } else {
      stack.push([p + 1, hi])
      stack.push([lo, p - 1])
    }
  }

  const ms = markAllSorted(a.length, id, runId)
  events.push(...ms.events)
  id = ms.nextId
  events.push(done(id++, runId))
  return events
}

function merge(initialValues: number[], runId?: string): StepEvent[] {
  const n = initialValues.length
  let src = initialValues.slice()
  let dst = new Array<number>(n)

  const events: StepEvent[] = []
  let id = 0

  function pushCompare(i: number, j: number) {
    if (i === j) return
    events.push({ id: id++, runId, type: 'compare', i, j })
  }

  function pushWrite(i: number, value: number) {
    events.push({ id: id++, runId, type: 'write', i, value })
  }

  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n)
      const hi = Math.min(lo + 2 * width, n)
      let i = lo
      let j = mid
      for (let k = lo; k < hi; k++) {
        if (i >= mid) {
          const v = src[j]
          dst[k] = v
          pushWrite(k, v)
          j += 1
        } else if (j >= hi) {
          const v = src[i]
          dst[k] = v
          pushWrite(k, v)
          i += 1
        } else {
          pushCompare(i, j)
          if (src[i] <= src[j]) {
            const v = src[i]
            dst[k] = v
            pushWrite(k, v)
            i += 1
          } else {
            const v = src[j]
            dst[k] = v
            pushWrite(k, v)
            j += 1
          }
        }
      }
    }
    const tmp = src
    src = dst
    dst = tmp
  }

  // If the final data ended in `src` which is not the original array reference,
  // the emitted writes already updated the visual array to match the last merge pass.
  const ms = markAllSorted(n, id, runId)
  events.push(...ms.events)
  id = ms.nextId
  events.push(done(id++, runId))
  return events
}

function heap(initialValues: number[], runId?: string): StepEvent[] {
  const a = initialValues.slice()
  const events: StepEvent[] = []
  let id = 0

  function pushCompare(i: number, j: number) {
    if (i === j) return
    events.push({ id: id++, runId, type: 'compare', i, j })
  }
  function pushSwap(i: number, j: number) {
    if (i === j) return
    events.push({ id: id++, runId, type: 'swap', i, j })
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }

  function siftDown(start: number, end: number) {
    let root = start
    while (true) {
      const left = root * 2 + 1
      if (left > end) return
      const right = left + 1
      let child = left
      if (right <= end) {
        pushCompare(left, right)
        if (a[right] > a[left]) child = right
      }
      pushCompare(root, child)
      if (a[child] > a[root]) {
        pushSwap(root, child)
        root = child
      } else {
        return
      }
    }
  }

  const n = a.length
  // heapify
  for (let start = Math.floor((n - 2) / 2); start >= 0; start--) {
    siftDown(start, n - 1)
  }

  for (let end = n - 1; end > 0; end--) {
    pushSwap(0, end)
    events.push({ id: id++, runId, type: 'markSorted', i: end })
    siftDown(0, end - 1)
  }
  events.push({ id: id++, runId, type: 'markSorted', i: 0 })
  events.push(done(id++, runId))
  return events
}
