import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Calls `handler` whenever a mousedown event fires outside `ref`.
 * Pass a stable `handler` reference (e.g. a React state setter or useCallback)
 * to avoid re-registering the listener on every render.
 */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, handler: () => void): void {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }
    document.addEventListener('mousedown', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
    }
  }, [ref, handler])
}
