import type { AlgorithmId, Metrics, PlaybackStatus } from '../engine'
import './all-metrics.css'

export type AlgoSummary = {
  algorithmId: AlgorithmId
  status: PlaybackStatus
  cursor: number
  totalEvents: number
  metrics: Metrics
}

type Props = {
  items: AlgoSummary[]
  seed?: string
  globalStatus: PlaybackStatus
}

function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function pct(cursor: number, total: number) {
  if (!total) return 0
  return Math.round((100 * cursor) / total)
}

export function AllMetricsPanel(props: Props) {
  const doneCount = props.items.filter((i) => i.status === 'done').length
  return (
    <div className="allMetricsWrap">
      <div className="head">
        <div className="title">All algorithms</div>
        <div className="sub">
          <span className="cap">{props.globalStatus}</span>
          <span className="sep" aria-hidden="true">•</span>
          <span>{doneCount}/{props.items.length} done</span>
        </div>
      </div>

      <div className="seedBox">
        <div className="seedLabel">Seed</div>
        <div className="seedValue">{props.seed ?? '-'}</div>
      </div>

      <div className="table" role="table" aria-label="Algorithm metrics">
        <div className="tr th" role="row">
          <div className="td" role="columnheader">Algorithm</div>
          <div className="td" role="columnheader">Status</div>
          <div className="td" role="columnheader">Progress</div>
          <div className="td" role="columnheader">Comparisons</div>
          <div className="td" role="columnheader">Swaps</div>
          <div className="td" role="columnheader">Writes</div>
          <div className="td" role="columnheader">Accesses</div>
          <div className="td" role="columnheader">Elapsed</div>
        </div>

        {props.items.map((it) => (
          <div className="tr" role="row" key={it.algorithmId} data-status={it.status}>
            <div className="td algo" role="cell">{it.algorithmId}</div>
            <div className="td cap" role="cell">{it.status}</div>
            <div className="td" role="cell">{pct(it.cursor, it.totalEvents)}%</div>
            <div className="td num" role="cell">{it.metrics.comparisons}</div>
            <div className="td num" role="cell">{it.metrics.swaps}</div>
            <div className="td num" role="cell">{it.metrics.writes}</div>
            <div className="td num" role="cell">{it.metrics.arrayAccesses}</div>
            <div className="td" role="cell">{fmtMs(it.metrics.elapsedMs)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
