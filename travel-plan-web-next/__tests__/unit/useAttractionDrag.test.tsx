import { renderHook, act } from '@testing-library/react'
import { useAttractionDrag } from '../../components/hooks/useAttractionDrag'
import type { DayAttraction } from '../../app/lib/itinerary'

const attractions: DayAttraction[] = [
  { id: 'a', label: 'Place A' },
  { id: 'b', label: 'Place B' },
  { id: 'c', label: 'Place C' },
]

function makeDragEvent(overrides?: Partial<React.DragEvent>): React.DragEvent {
  return {
    preventDefault: jest.fn(),
    dataTransfer: { effectAllowed: '', dropEffect: '', setData: jest.fn(), setDragImage: jest.fn() },
    currentTarget: { querySelectorAll: () => [] },
    ...overrides,
  } as unknown as React.DragEvent
}

describe('useAttractionDrag', () => {
  it('starts with draggedId null', () => {
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder: jest.fn(), onSave: jest.fn() })
    )
    expect(result.current.draggedId).toBeNull()
  })

  it('handleDragStart sets draggedId', () => {
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder: jest.fn(), onSave: jest.fn() })
    )
    act(() => result.current.handleDragStart(makeDragEvent(), 'b'))
    expect(result.current.draggedId).toBe('b')
  })

  it('handleDragOver reorders attractions and calls onReorder', () => {
    const onReorder = jest.fn()
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder, onSave: jest.fn() })
    )
    act(() => result.current.handleDragStart(makeDragEvent(), 'a'))
    act(() => result.current.handleDragOver(makeDragEvent(), 'b'))
    expect(onReorder).toHaveBeenCalledWith([
      { id: 'b', label: 'Place B' },
      { id: 'a', label: 'Place A' },
      { id: 'c', label: 'Place C' },
    ])
  })

  it('handleDragOver does not call onReorder when dragging over itself', () => {
    const onReorder = jest.fn()
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder, onSave: jest.fn() })
    )
    act(() => result.current.handleDragStart(makeDragEvent(), 'a'))
    act(() => result.current.handleDragOver(makeDragEvent(), 'a'))
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('handleDragEnd calls onSave and clears draggedId', () => {
    const onSave = jest.fn()
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder: jest.fn(), onSave })
    )
    act(() => result.current.handleDragStart(makeDragEvent(), 'b'))
    act(() => result.current.handleDragEnd())
    expect(onSave).toHaveBeenCalledWith(attractions)
    expect(result.current.draggedId).toBeNull()
  })

  it('handleDrop calls preventDefault', () => {
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder: jest.fn(), onSave: jest.fn() })
    )
    const e = makeDragEvent()
    act(() => result.current.handleDrop(e))
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('setTagRef registers and unregisters DOM elements', () => {
    const { result } = renderHook(() =>
      useAttractionDrag({ attractions, onReorder: jest.fn(), onSave: jest.fn() })
    )
    const el = document.createElement('div')
    act(() => { result.current.setTagRef('a')(el) })
    // No direct way to inspect tagRefs, but unregistering should not throw
    act(() => { result.current.setTagRef('a')(null) })
  })
})
