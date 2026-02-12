import type { StepEvent } from './types'

export type ValidationResult = { ok: true } | { ok: false; message: string }

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

export function validateEvents(size: number, events: StepEvent[]): ValidationResult {
  if (!Array.isArray(events) || !events.length) return { ok: false, message: 'No events generated.' }

  let doneCount = 0
  for (let idx = 0; idx < events.length; idx++) {
    const ev = events[idx]
    if (!ev || typeof ev !== 'object') return { ok: false, message: 'Invalid event.' }
    if (ev.type === 'compare' || ev.type === 'swap') {
      if (!isInt(ev.i) || !isInt(ev.j)) return { ok: false, message: `Event ${idx}: invalid indices.` }
      if (ev.i < 0 || ev.j < 0 || ev.i >= size || ev.j >= size) return { ok: false, message: `Event ${idx}: index out of bounds.` }
      if (ev.i === ev.j) return { ok: false, message: `Event ${idx}: i and j must differ.` }
    } else if (ev.type === 'write') {
      if (!isInt(ev.i)) return { ok: false, message: `Event ${idx}: invalid index.` }
      if (ev.i < 0 || ev.i >= size) return { ok: false, message: `Event ${idx}: index out of bounds.` }
      if (typeof ev.value !== 'number' || !Number.isFinite(ev.value)) return { ok: false, message: `Event ${idx}: invalid write value.` }
      if (ev.prevValue != null && (typeof ev.prevValue !== 'number' || !Number.isFinite(ev.prevValue))) {
        return { ok: false, message: `Event ${idx}: invalid prevValue.` }
      }
    } else if (ev.type === 'markSorted') {
      if (!isInt(ev.i)) return { ok: false, message: `Event ${idx}: invalid index.` }
      if (ev.i < 0 || ev.i >= size) return { ok: false, message: `Event ${idx}: index out of bounds.` }
    } else if (ev.type === 'done') {
      doneCount += 1
      if (idx !== events.length - 1) return { ok: false, message: '`done` must be the final event.' }
    } else {
      const t = (ev as { type?: unknown }).type
      return { ok: false, message: `Unknown event type: ${String(t)}` }
    }
  }

  if (doneCount !== 1) return { ok: false, message: 'Event list must contain exactly one `done`.' }
  return { ok: true }
}
