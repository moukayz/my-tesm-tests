import { useEffect } from 'react'

type Keymap = {
  enabled: boolean
  onToggleRun: () => void
  onStep: () => void
  onReset: () => void
  onGenerate: () => void
  onHelp: () => void
}

function isTextInput(el: Element | null) {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}

export function useKeymap(map: Keymap) {
  useEffect(() => {
    if (!map.enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (isTextInput(document.activeElement)) return
      if (e.key === ' ') {
        e.preventDefault()
        map.onToggleRun()
      } else if (e.key === 'ArrowRight') {
        map.onStep()
      } else if (e.key.toLowerCase() === 'r') {
        map.onReset()
      } else if (e.key.toLowerCase() === 'g') {
        map.onGenerate()
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        map.onHelp()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [map])
}
