import type { AlgorithmId, Metrics, PlaybackStatus } from '../engine'
import './metrics.css'

type Props = {
  status: PlaybackStatus
  algorithmId: AlgorithmId
  metrics: Metrics
  cursor: number
  totalEvents: number
  error?: string
  seed?: string
}

function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function MetricsPanel(props: Props) {
  const pct = props.totalEvents ? Math.round((100 * props.cursor) / props.totalEvents) : 0
  return (
    <div className="metricsWrap">
      <div className="sectionTitle">Metrics</div>
      <div className="kvs">
        <div className="kv"><span className="k">Algorithm</span><span className="v">{props.algorithmId}</span></div>
        <div className="kv"><span className="k">Status</span><span className="v cap">{props.status}</span></div>
        <div className="kv"><span className="k">Progress</span><span className="v">{pct}%</span></div>
        <div className="kv"><span className="k">Elapsed</span><span className="v">{fmtMs(props.metrics.elapsedMs)}</span></div>
      </div>

      <div className="rule" />

      <div className="kvs">
        <div className="kv"><span className="k">Comparisons</span><span className="v">{props.metrics.comparisons}</span></div>
        <div className="kv"><span className="k">Swaps</span><span className="v">{props.metrics.swaps}</span></div>
        <div className="kv"><span className="k">Writes</span><span className="v">{props.metrics.writes}</span></div>
        <div className="kv"><span className="k">Array accesses</span><span className="v">{props.metrics.arrayAccesses}</span></div>
        <div className="kv"><span className="k">Applied events</span><span className="v">{props.metrics.appliedEvents}</span></div>
      </div>

      <div className="rule" />

      <div className="seedBox">
        <div className="seedLabel">Seed</div>
        <div className="seedValue">{props.seed ?? '-'}</div>
      </div>

      {props.status === 'error' && (
        <div className="errorBox" role="alert">
          <div className="errorTitle">Error</div>
          <div className="errorText">{props.error ?? 'Unexpected error.'}</div>
        </div>
      )}
    </div>
  )
}
