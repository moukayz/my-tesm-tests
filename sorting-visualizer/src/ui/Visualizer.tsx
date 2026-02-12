import { type CSSProperties, useLayoutEffect, useMemo, useRef } from 'react'
import type { HighlightState } from '../engine'
import './visualizer.css'

type Patch = {
  kind: 'full' | 'patch'
  changedIndices: number[]
  sortedChangedIndices: number[]
  highlight: HighlightState
  valuesVersion: number
}

type Props = {
  size: number
  valueRange: { min: number; max: number }
  values: number[]
  sorted: boolean[]
  patch: Patch
  reducedMotion: boolean
  compact?: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function scaleFor(value: number, range: { min: number; max: number }) {
  const min = range.min
  const max = range.max
  if (max <= min) return 1
  const t = (value - min) / (max - min)
  return clamp(0.06 + t * 0.94, 0.06, 1)
}

export function Visualizer(props: Props) {
  const barRefs = useRef<Array<HTMLDivElement | null>>([])
  const prevHighlight = useRef<HighlightState>({ indices: [], kind: 'none' })

  const widthStyle = useMemo(() => {
    const s = props.size
    const gap = s >= 120 ? 1 : s >= 80 ? 2 : 3
    return { '--bar-gap': `${gap}px` } as CSSProperties
  }, [props.size])

  useLayoutEffect(() => {
    const range = props.valueRange
    const changed = props.patch.kind === 'full' ? Array.from({ length: props.size }, (_, i) => i) : props.patch.changedIndices

    for (const i of changed) {
      const el = barRefs.current[i]
      if (!el) continue
      const v = props.values[i]
      const s = scaleFor(v, range)
      el.style.setProperty('--bar-scale', String(s))
      el.dataset.v = String(v)
    }

    // Sorted changes
    const sortedChanged = props.patch.kind === 'full'
      ? Array.from({ length: props.size }, (_, i) => i)
      : props.patch.sortedChangedIndices

    for (const i of sortedChanged) {
      const el = barRefs.current[i]
      if (!el) continue
      el.classList.toggle('is-sorted', !!props.sorted[i])
    }

    // Highlight changes
    const prev = prevHighlight.current
    for (const i of prev.indices) {
      const el = barRefs.current[i]
      if (!el) continue
      el.classList.remove('is-compare', 'is-swap', 'is-write', 'is-markSorted')
    }
    const next = props.patch.highlight
    const cls =
      next.kind === 'compare'
        ? 'is-compare'
        : next.kind === 'swap'
          ? 'is-swap'
          : next.kind === 'write'
            ? 'is-write'
            : next.kind === 'markSorted'
              ? 'is-markSorted'
              : null
    if (cls) {
      for (const i of next.indices) {
        const el = barRefs.current[i]
        if (!el) continue
        el.classList.add(cls)
      }
    }
    prevHighlight.current = next
  }, [props.patch.valuesVersion, props.size, props.valueRange, props.values, props.sorted, props.patch])

  return (
    <div className="viz" data-reduced={props.reducedMotion ? 'y' : 'n'} data-compact={props.compact ? 'y' : 'n'}>
      <figure className="vizFrame" style={widthStyle}>
        <figcaption className="vizCaption">
          Bars animate through atomic steps: compare, swap, write. Green indicates a confirmed final position.
        </figcaption>
        <div className="bars" role="img" aria-label="Sorting visualizer bars">
          {Array.from({ length: props.size }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                barRefs.current[i] = el
              }}
              className="bar"
              style={{ '--bar-scale': '0.2' } as CSSProperties}
            />
          ))}
        </div>
        <div className="legend" aria-label="Legend">
          <span className="lg"><i className="sw" /> swap</span>
          <span className="lg"><i className="cp" /> compare</span>
          <span className="lg"><i className="wr" /> write</span>
          <span className="lg"><i className="sd" /> sorted</span>
        </div>
      </figure>
    </div>
  )
}
