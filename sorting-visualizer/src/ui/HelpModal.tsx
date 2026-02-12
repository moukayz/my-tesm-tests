import { useEffect, useRef } from 'react'
import './help.css'

type Props = {
  open: boolean
  onClose: () => void
}

export function HelpModal(props: Props) {
  const { open, onClose } = props
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const lastActiveRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastActiveRef.current = document.activeElement as HTMLElement
    closeBtnRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      lastActiveRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Help">
      <div className="modal">
        <div className="modalTop">
          <div className="modalTitle">How this works</div>
          <button ref={closeBtnRef} className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modalBody">
          <p>
            This visualizer animates sorting as a sequence of atomic steps: <b>compare</b>, <b>swap</b>, and <b>write</b>.
            Use <b>Step</b> to advance exactly one event.
          </p>

          <p>
            Enable <b>Show all algorithms</b> to run every algorithm on the same dataset with the same playback controls.
          </p>

          <div className="helpGrid">
            <div className="helpCard">
              <div className="helpHead">Keyboard</div>
              <div className="helpRow"><span>Space</span><span>Start / Pause / Resume</span></div>
              <div className="helpRow"><span>Right</span><span>Step (when paused/ready)</span></div>
              <div className="helpRow"><span>R</span><span>Reset</span></div>
              <div className="helpRow"><span>G</span><span>Generate</span></div>
              <div className="helpRow"><span>?</span><span>Open help</span></div>
            </div>
            <div className="helpCard">
              <div className="helpHead">Algorithms</div>
              <div className="helpSmall">Bubble: repeatedly bubbles the largest item to the end.</div>
              <div className="helpSmall">Selection: selects the minimum and fixes it in place.</div>
              <div className="helpSmall">Insertion: inserts each item into a growing sorted prefix.</div>
              <div className="helpSmall">Quick: partitions around a pivot, sorting both sides.</div>
              <div className="helpSmall">Merge: repeatedly merges sorted runs using writes.</div>
              <div className="helpSmall">Heap: builds a max heap and extracts to the end.</div>
            </div>
          </div>

          <p className="helpNote">
            Reduced motion is respected via your OS setting; transitions shorten or disable automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
