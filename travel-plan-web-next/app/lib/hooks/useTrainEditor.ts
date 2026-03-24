import { useRef, useState, useEffect } from 'react'
import {
  createEmptyTrainScheduleDraftRow,
  moveDraftRow,
  parseTrainScheduleForDraft,
  serializeDraftRows,
  validateTrainScheduleDraftRows,
  type TrainScheduleDraftRow,
  type TrainScheduleDraftRowErrors,
} from '../trainScheduleDraft'
import type { RouteDay } from '../itinerary'

interface UseTrainEditorOptions {
  trainOverrides: Record<number, RouteDay['train']>
  setTrainOverrides: React.Dispatch<React.SetStateAction<Record<number, RouteDay['train']>>>
}

export function useTrainEditor({ trainOverrides, setTrainOverrides }: UseTrainEditorOptions) {
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [rows, setRows] = useState<TrainScheduleDraftRow[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, TrainScheduleDraftRowErrors>>({})
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [dragSourceRowId, setDragSourceRowId] = useState<string | null>(null)
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const close = (force = false) => {
    if (saving && !force) return
    setDayIndex(null)
    setRows([])
    setRowErrors({})
    setLegacyError(null)
    setSaveError(null)
    setAnnouncement('')
    setDragSourceRowId(null)
    setDragOverRowId(null)
    setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const open = (index: number, trainData: RouteDay['train'], triggerButton: HTMLButtonElement) => {
    triggerRef.current = triggerButton
    const parsed = parseTrainScheduleForDraft(trainOverrides[index] ?? trainData)
    setDayIndex(index)
    setRowErrors({})
    setSaveError(null)
    setAnnouncement('')
    if (!parsed.ok) {
      setLegacyError(parsed.error)
      setRows([])
      return
    }
    setLegacyError(null)
    setRows(parsed.rows)
  }

  const setField = (rowId: string, field: 'trainId' | 'start' | 'end', value: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)))
    setSaveError(null)
    setRowErrors((prev) => {
      if (!prev[rowId]) return prev
      const errs = { ...prev[rowId] }
      if (field === 'trainId') delete errs.trainId
      if (field === 'start' || field === 'end') delete errs.stationPair
      const next = { ...prev }
      if (!errs.trainId && !errs.stationPair) delete next[rowId]
      else next[rowId] = errs
      return next
    })
  }

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyTrainScheduleDraftRow()])
    setSaveError(null)
  }

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setSaveError(null)
  }

  const handleDragStart = (rowId: string, e: React.DragEvent) => {
    setDragSourceRowId(rowId)
    setDragOverRowId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData?.('text/plain', rowId)
  }

  const handleDragOver = (rowId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!dragSourceRowId || dragSourceRowId === rowId) return
    setDragOverRowId(rowId)
  }

  const handleDrop = (targetRowId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!dragSourceRowId || dragSourceRowId === targetRowId) {
      setDragSourceRowId(null)
      setDragOverRowId(null)
      return
    }
    setRows((prev) => {
      const fromIndex = prev.findIndex((row) => row.id === dragSourceRowId)
      const toIndex = prev.findIndex((row) => row.id === targetRowId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev
      setAnnouncement(`Moved row ${fromIndex + 1} to position ${toIndex + 1}.`)
      return moveDraftRow(prev, fromIndex, toIndex)
    })
    setSaveError(null)
    setDragSourceRowId(null)
    setDragOverRowId(null)
  }

  const handleDragEnd = () => {
    setDragSourceRowId(null)
    setDragOverRowId(null)
  }

  const handleSave = async () => {
    if (dayIndex === null || legacyError) return

    const validation = validateTrainScheduleDraftRows(rows)
    setRowErrors(validation.errors)
    if (!validation.isValid) {
      if (validation.firstInvalidField) {
        const refKey = `${validation.firstInvalidField.rowId}:${validation.firstInvalidField.field}`
        inputRefs.current[refKey]?.focus()
      }
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch('/api/train-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayIndex,
          trainJson: serializeDraftRows(rows),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || 'Could not save train schedule. Your edits are still open.')
      } else {
        const updatedDay = await res.json()
        setTrainOverrides((prev) => ({ ...prev, [dayIndex]: updatedDay.train }))
        close(true)
      }
    } catch {
      setSaveError('Could not save train schedule. Your edits are still open.')
    } finally {
      setSaving(false)
    }
  }

  // Escape key handler
  useEffect(() => {
    if (dayIndex === null || saving) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dayIndex, saving])

  return {
    dayIndex,
    rows,
    rowErrors,
    legacyError,
    saving,
    saveError,
    announcement,
    dragSourceRowId,
    dragOverRowId,
    triggerRef,
    inputRefs,
    open,
    close,
    setField,
    addRow,
    removeRow,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleSave,
  }
}
