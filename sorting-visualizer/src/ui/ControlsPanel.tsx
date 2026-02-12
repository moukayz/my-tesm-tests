import type { AlgorithmId, DatasetGenerationSettings, PatternId, PlaybackStatus } from '../engine'
import './controls.css'

type Props = {
  showAll: boolean
  algorithmId: AlgorithmId
  speedEps: number
  settings: DatasetGenerationSettings
  maxSize: number
  status: PlaybackStatus
  canEditSetup: boolean
  canStart: boolean
  canPause: boolean
  canResume: boolean
  canStep: boolean
  onSetShowAll: (showAll: boolean) => void
  onSetAlgorithmId: (id: AlgorithmId) => void
  onSetSpeedEps: (eps: number) => void
  onSetSize: (size: number) => void
  onSetPattern: (pattern: PatternId) => void
  onSetSeed: (seed: string) => void
  onGenerate: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStep: () => void
  onReset: () => void
}

function fmtEps(eps: number) {
  if (eps < 60) return 'Slow'
  if (eps < 200) return 'Medium'
  if (eps < 600) return 'Fast'
  return 'Turbo'
}

export function ControlsPanel(props: Props) {
  return (
    <div className="controlsWrap">
      <div className="section">
        <div className="sectionTitle">Setup</div>

        <div className="setupRow">
          <label className="toggle inline">
            <input
              type="checkbox"
              checked={props.showAll}
              onChange={(e) => props.onSetShowAll(e.target.checked)}
              disabled={!props.canEditSetup}
            />
            <span className="toggleText">Show all</span>
          </label>

          <label className="field">
            <span className="label">Algorithm</span>
            <select
              value={props.algorithmId}
              onChange={(e) => props.onSetAlgorithmId(e.target.value as AlgorithmId)}
              disabled={!props.canEditSetup || props.showAll}
            >
              <option value="bubble">Bubble</option>
              <option value="selection">Selection</option>
              <option value="insertion">Insertion</option>
              <option value="quick">Quick</option>
              <option value="merge">Merge</option>
              <option value="heap">Heap</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Dataset</span>
            <select
              value={props.settings.pattern}
              onChange={(e) => props.onSetPattern(e.target.value as PatternId)}
              disabled={!props.canEditSetup}
            >
              <option value="random">Random</option>
              <option value="nearlySorted">Nearly sorted</option>
              <option value="reversed">Reversed</option>
            </select>
          </label>

        </div>

        <div className="sizeRow">
          <label className="field seed">
            <span className="labelRow">
              <span className="label">Seed</span>
              <span className="hint">repeatable runs</span>
            </span>
            <input
              type="text"
              value={props.settings.seed ?? ''}
              onChange={(e) => props.onSetSeed(e.target.value)}
              disabled={!props.canEditSetup}
              placeholder="seed"
            />
          </label>

          <label className="field size">
            <span className="labelRow">
              <span className="label">Size</span>
              <span className="hint">{Math.round(props.settings.size)} / {props.maxSize}</span>
            </span>
            <input
              type="range"
              min={2}
              max={props.maxSize}
              value={props.settings.size}
              onChange={(e) => props.onSetSize(Number(e.target.value))}
              disabled={!props.canEditSetup}
            />
          </label>
        </div>

        <div className="setupButtons">
          <div className="btnGroup">
            <button type="button" className="primary" onClick={props.onGenerate} disabled={!props.canEditSetup}>
              Generate
            </button>
            <button type="button" className="btn" onClick={props.onReset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="sectionTitle">Playback</div>

        <label className="field">
          <span className="labelRow">
            <span className="label">Speed</span>
            <span className="hint">{fmtEps(props.speedEps)} ({props.speedEps} eps)</span>
          </span>
          <input
            type="range"
            min={1}
            max={1200}
            value={props.speedEps}
            onChange={(e) => props.onSetSpeedEps(Number(e.target.value))}
          />
        </label>

        <div className="row playbackRow">
          <button type="button" className="primary" onClick={props.onStart} disabled={!props.canStart}>
            Start
          </button>
          <button type="button" className="btn" onClick={props.onPause} disabled={!props.canPause}>
            Pause
          </button>
          <button type="button" className="btn" onClick={props.onResume} disabled={!props.canResume}>
            Resume
          </button>
          <button type="button" className="btn" onClick={props.onStep} disabled={!props.canStep}>
            Step
          </button>
          <div className="pill" data-status={props.status}>
            <span className="pillDot" aria-hidden="true" />
            <span className="pillText">{props.status}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
