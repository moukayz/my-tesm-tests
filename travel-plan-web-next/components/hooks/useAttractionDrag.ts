'use client'

import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import type { DayAttraction } from '../../app/lib/itinerary'

interface UseAttractionDragProps {
  attractions: DayAttraction[]
  onReorder: (next: DayAttraction[]) => void
  onSave: (next: DayAttraction[]) => void
  onDragStart?: () => void
}

export function useAttractionDrag({ attractions, onReorder, onSave, onDragStart }: UseAttractionDragProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const tagRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map())
  const animatingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const originalOrderRef = useRef<string[]>([])

  function capturePositions() {
    const rects = new Map<string, DOMRect>()
    tagRefs.current.forEach((el, id) => {
      rects.set(id, el.getBoundingClientRect())
    })
    prevRectsRef.current = rects
  }

  const handleDragStart = useCallback((e: React.DragEvent, attractionId: string) => {
    isDraggingRef.current = true
    onDragStart?.()
    capturePositions()
    originalOrderRef.current = attractions.map((a) => a.id)
    setDraggedId(attractionId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', attractionId)
    const el = tagRefs.current.get(attractionId)
    if (el) {
      const buttons = el.querySelectorAll<HTMLElement>('button')
      buttons.forEach((b) => { b.style.opacity = '0' })
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2)
      buttons.forEach((b) => { b.style.opacity = '' })
    }
  }, [onDragStart])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    if (!draggedId || draggedId === targetId || animatingRef.current) return

    const fromIdx = attractions.findIndex((a) => a.id === draggedId)
    const toIdx = attractions.findIndex((a) => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

    capturePositions()

    const next = [...attractions]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onReorder(next)
  }, [draggedId, attractions, onReorder])

  const handleDragEnd = useCallback(() => {
    if (draggedId) {
      const currentOrder = attractions.map((a) => a.id)
      const orderChanged = currentOrder.some((id, i) => id !== originalOrderRef.current[i])
      if (orderChanged) onSave(attractions)
    }
    setDraggedId(null)
    prevRectsRef.current.clear()
    setTimeout(() => { isDraggingRef.current = false }, 100)
  }, [draggedId, attractions, onSave])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // FLIP animation after reorder
  useLayoutEffect(() => {
    if (prevRectsRef.current.size === 0) return

    const prevRects = prevRectsRef.current
    let hasAnimation = false

    tagRefs.current.forEach((el, id) => {
      const prev = prevRects.get(id)
      if (!prev) return
      const curr = el.getBoundingClientRect()
      const dy = prev.top - curr.top
      if (Math.abs(dy) < 1) return

      hasAnimation = true
      el.style.transform = `translateY(${dy}px)`
      el.style.transition = 'none'
    })

    if (!hasAnimation) return

    animatingRef.current = true
    // Force a reflow so the initial transform is applied
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    document.body.offsetHeight

    tagRefs.current.forEach((el, id) => {
      const prev = prevRects.get(id)
      if (!prev) return
      el.style.transition = 'transform 200ms ease'
      el.style.transform = ''
    })

    const cleanup = setTimeout(() => {
      animatingRef.current = false
      prevRectsRef.current.clear()
    }, 200)

    return () => clearTimeout(cleanup)
  }, [attractions])

  const setTagRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      tagRefs.current.set(id, el)
    } else {
      tagRefs.current.delete(id)
    }
  }, [])

  return {
    draggedId,
    isDraggingRef,
    tagRefs,
    setTagRef,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  }
}
