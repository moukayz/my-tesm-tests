import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useOutsideClick } from '../../app/lib/hooks/useOutsideClick'

describe('useOutsideClick', () => {
  it('calls handler when mousedown fires outside the ref element', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      useOutsideClick(ref, handler)
      return ref
    })

    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(handler).toHaveBeenCalledTimes(1)
    document.body.removeChild(outside)
    void result
  })

  it('does not call handler when mousedown fires inside the ref element', () => {
    const handler = jest.fn()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      useOutsideClick(ref, handler)
      return ref
    })

    const inner = document.createElement('span')
    result.current.current.appendChild(inner)
    inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(handler).not.toHaveBeenCalled()
  })

  it('removes the event listener on unmount', () => {
    const removeSpy = jest.spyOn(document, 'removeEventListener')
    const handler = jest.fn()

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      useOutsideClick(ref, handler)
      return ref
    })

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    removeSpy.mockRestore()
  })
})
