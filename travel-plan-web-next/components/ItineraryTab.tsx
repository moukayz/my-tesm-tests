'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Sunrise, Sun, Moon, GripVertical, Pencil, Plus, Map as MapIcon, X } from 'lucide-react'
import {
  getCityColor,
  getCountryColor,
  getOvernightColor,
  processItinerary,
  findMatchingStation,
  normalizeTrainId,
  getRailwayFromTrainId,
  type RouteDay,
  type PlanSections,
  type DayAttraction,
} from '../app/lib/itinerary'
import { searchLocationSuggestions } from '../app/lib/locations/search'
import type { StayLocationResolved } from '../app/lib/itinerary-store/types'
import AttractionMiniMap from './AttractionMiniMap'
import { getStaysWithMeta, applyStayEditOptimistic } from '../app/lib/stayUtils'
import { formatTime } from '../app/lib/trainTimetable'
import { renderMarkdown } from '../app/lib/markdown'
import { buildMarkdownTable /*, buildPdfBlob — temporarily disabled */ } from '../app/lib/itineraryExport'
import { saveFile } from '../app/lib/fileSave'
import {
  createEmptyTrainScheduleDraftRow,
  moveDraftRow,
  parseTrainScheduleForDraft,
  serializeDraftRows,
  validateTrainScheduleDraftRows,
  type TrainScheduleDraftRow,
  type TrainScheduleDraftRowErrors,
} from '../app/lib/trainScheduleDraft'
import FloatingExportButton from './FloatingExportButton'
import ExportFormatPicker from './ExportFormatPicker'
import ExportSuccessToast from './ExportSuccessToast'
import StayEditControl from './StayEditControl'

interface TrainStopsResult {
  fromStation: string
  depTime: string
  toStation: string
  arrTime: string
}

interface TimetableRow {
  station_name: string
  station_num: number
  arrival_planned_time: string | null
  departure_planned_time: string | null
  ride_date: string | null
}

interface ItineraryTabProps {
  initialData: RouteDay[]
  tabKey?: 'route' | 'route-test'
  itineraryId?: string
  onRequestAddStay?: () => void
  onRequestEditStay?: (stayIndex: number) => void
  onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryTab({
  initialData,
  tabKey = 'route',
  itineraryId,
  onRequestAddStay,
  onRequestEditStay,
  onMoveStay,
  onDirtyStateChange,
}: ItineraryTabProps) {
  // ── Days state (mutable copy for stay edits) ─────────────────────────────
  const [days, setDays] = useState<RouteDay[]>(() => initialData)
  const processedData = useMemo(() => processItinerary(days), [days])

  useEffect(() => {
    setDays(initialData)
  }, [initialData])

  // ── Stay edit state ───────────────────────────────────────────────────────
  const [stayEditingIndex, setStayEditingIndex] = useState<number | null>(null)
  const [stayEditSnapshot, setStayEditSnapshot] = useState<RouteDay[] | null>(null)
  const [stayEditError, setStayEditError] = useState<string | null>(null)
  const [stayEditSaving, setStayEditSaving] = useState(false)

  const [trainSchedules, setTrainSchedules] = useState<Record<string, TrainStopsResult | null>>({})
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [planOverrides, setPlanOverrides] = useState<Record<number, PlanSections>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingDndDayIndex, setSavingDndDayIndex] = useState<number | null>(null)
  const [dndError, setDndError] = useState<Record<number, string>>({})
  const [trainEditorDayIndex, setTrainEditorDayIndex] = useState<number | null>(null)
  const [trainEditorRows, setTrainEditorRows] = useState<TrainScheduleDraftRow[]>([])
  const [trainEditorRowErrors, setTrainEditorRowErrors] = useState<Record<string, TrainScheduleDraftRowErrors>>({})
  const [trainEditorLegacyError, setTrainEditorLegacyError] = useState<string | null>(null)
  const [trainEditorSaving, setTrainEditorSaving] = useState(false)
  const [trainEditorSaveError, setTrainEditorSaveError] = useState<string | null>(null)
  const [trainEditorAnnouncement, setTrainEditorAnnouncement] = useState('')
  const [trainEditorDragSourceRowId, setTrainEditorDragSourceRowId] = useState<string | null>(null)
  const [trainEditorDragOverRowId, setTrainEditorDragOverRowId] = useState<string | null>(null)
  const [trainOverrides, setTrainOverrides] = useState<Record<number, RouteDay['train']>>({})
  const trainEditorTriggerRef = useRef<HTMLButtonElement | null>(null)
  const trainEditorInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Attraction state ─────────────────────────────────────────────────────────
  const [attractionOverrides, setAttractionOverrides] = useState<Map<number, DayAttraction[]>>(new Map())
  const [addingAttractionDayIndex, setAddingAttractionDayIndex] = useState<number | null>(null)
  const [attractionQuery, setAttractionQuery] = useState('')
  const [attractionResults, setAttractionResults] = useState<StayLocationResolved[]>([])
  const [attractionSearchLoading, setAttractionSearchLoading] = useState(false)
  const [attractionSearchOpen, setAttractionSearchOpen] = useState(false)
  const [attractionActiveIndex, setAttractionActiveIndex] = useState(0)
  const [attractionMiniMapDayIndex, setAttractionMiniMapDayIndex] = useState<number | null>(null)
  const [attractionMiniMapRect, setAttractionMiniMapRect] = useState<DOMRect | null>(null)
  const attractionSearchRef = useRef<AbortController | null>(null)
  const attractionInputRef = useRef<HTMLInputElement | null>(null)
  const attractionMiniMapButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})

  function getAttractionsForDay(day: RouteDay, dayIndex: number): DayAttraction[] {
    return attractionOverrides.has(dayIndex) ? (attractionOverrides.get(dayIndex) ?? []) : (day.attractions ?? [])
  }

  async function saveAttractions(dayIndex: number, attractions: DayAttraction[]) {
    if (itineraryId) {
      await fetch(`/api/itineraries/${itineraryId}/days/${dayIndex}/attractions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attractions }),
      })
    } else {
      await fetch('/api/attraction-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex, attractions, tabKey }),
      })
    }
  }

  function openAttractionSearch(dayIndex: number) {
    setAddingAttractionDayIndex(dayIndex)
    setAttractionQuery('')
    setAttractionResults([])
    setAttractionSearchOpen(false)
    setAttractionActiveIndex(0)
  }

  function closeAttractionSearch() {
    setAddingAttractionDayIndex(null)
    setAttractionQuery('')
    setAttractionResults([])
    setAttractionSearchOpen(false)
    attractionSearchRef.current?.abort()
  }

  function selectAttraction(dayIndex: number, result: StayLocationResolved) {
    const attraction: DayAttraction = {
      id: result.place.placeId,
      label: result.place.name,
      coordinates: result.coordinates,
    }
    const current = getAttractionsForDay(days[dayIndex], dayIndex)
    if (current.some((a) => a.id === attraction.id)) {
      closeAttractionSearch()
      return
    }
    const next = [...current, attraction]
    setAttractionOverrides((prev) => new Map(prev).set(dayIndex, next))
    closeAttractionSearch()
    saveAttractions(dayIndex, next).catch(() => {})
  }

  function removeAttraction(dayIndex: number, attractionId: string) {
    const current = getAttractionsForDay(days[dayIndex], dayIndex)
    const next = current.filter((a) => a.id !== attractionId)
    setAttractionOverrides((prev) => new Map(prev).set(dayIndex, next))
    saveAttractions(dayIndex, next).catch(() => {})
  }

  function openAttractionMiniMap(dayIndex: number, buttonEl: HTMLButtonElement | null) {
    const rect = buttonEl?.getBoundingClientRect() ?? null
    setAttractionMiniMapDayIndex(dayIndex)
    setAttractionMiniMapRect(rect)
  }

  function closeAttractionMiniMap() {
    setAttractionMiniMapDayIndex(null)
    setAttractionMiniMapRect(null)
  }

  // Debounced attraction search
  useEffect(() => {
    if (addingAttractionDayIndex === null) return
    const trimmed = attractionQuery.trim()
    if (trimmed.length < 2) {
      setAttractionResults([])
      setAttractionSearchLoading(false)
      setAttractionSearchOpen(false)
      return
    }
    setAttractionSearchLoading(true)
    attractionSearchRef.current?.abort()
    const controller = new AbortController()
    attractionSearchRef.current = controller
    const timer = window.setTimeout(() => {
      const countryBias = addingAttractionDayIndex !== null && processedData[addingAttractionDayIndex]?.location?.kind === 'resolved'
        ? processedData[addingAttractionDayIndex].location?.place?.countryCode
        : undefined
      searchLocationSuggestions(attractionQuery, { signal: controller.signal, limit: 6, placeTypes: [], countryBias })
        .then((res) => {
          setAttractionResults(res.results)
          setAttractionSearchOpen(res.results.length > 0)
          setAttractionActiveIndex(0)
        })
        .catch(() => {})
        .finally(() => setAttractionSearchLoading(false))
    }, 300)
    return () => {
      window.clearTimeout(timer)
    }
  }, [attractionQuery, addingAttractionDayIndex])

  // Close minimap on Escape
  useEffect(() => {
    if (attractionMiniMapDayIndex === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAttractionMiniMap()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [attractionMiniMapDayIndex])

  const ATTRACTION_TAG_COLORS = [
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  ]

  // ── Export state ────────────────────────────────────────────────────────────
  const [floatingPickerOpen, setFloatingPickerOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null)
  const floatingButtonRef = useRef<HTMLButtonElement>(null)

  // ── Derived stays (for stay edit controls) ────────────────────────────────
  const stays = useMemo(() => getStaysWithMeta(days), [days])
  const isItineraryScopedStayEdit = Boolean(itineraryId && onRequestEditStay)

  // ── Country column spans ──────────────────────────────────────────────────
  const countrySpans = useMemo(() => {
    const spans = new Array<number>(processedData.length).fill(0)
    let spanStart = -1
    let currentCountry: string | null = null
    for (let i = 0; i <= processedData.length; i++) {
      const day = processedData[i]
      const country =
        day?.location?.kind === 'resolved'
          ? (day.location.place.country ?? day.location.place.countryCode ?? '—')
          : '—'
      if (i === processedData.length || country !== currentCountry) {
        if (spanStart !== -1) spans[spanStart] = i - spanStart
        if (i < processedData.length) {
          currentCountry = country
          spanStart = i
        }
      }
    }
    return spans
  }, [processedData])

  // ── Stay edit handlers ────────────────────────────────────────────────────

  const handleStayConfirm = async (stayIndex: number, newNights: number) => {
    // Take snapshot before optimistic update
    const snapshot = [...days]
    setStayEditSnapshot(snapshot)

    // Optimistic update
    const optimisticDays = applyStayEditOptimistic(days, stayIndex, newNights)
    setDays(optimisticDays)
    setStayEditingIndex(null)
    setStayEditSaving(true)

    try {
      const response = itineraryId
        ? await fetch(`/api/itineraries/${itineraryId}/stays/${stayIndex}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ nights: newNights }),
          })
        : await fetch('/api/stay-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ tabKey, stayIndex, newNights }),
          })

      if (!response.ok) {
        // Revert optimistic update
        setDays(snapshot)
        setStayEditError('Could not save changes. Your edit has been reverted.')
      } else {
        const data = await response.json()
        // Replace state with authoritative server response
        const nextDays = (data.updatedDays ?? data.days) as RouteDay[] | undefined
        if (nextDays) setDays(nextDays)
        setStayEditSnapshot(null)
      }
    } catch {
      // Network error — revert
      setDays(snapshot)
      setStayEditError('Could not save changes. Your edit has been reverted.')
    } finally {
      setStayEditSaving(false)
    }
  }

  const handleStayCancel = () => {
    setStayEditingIndex(null)
  }

  const savePlanUpdate = async (dayIndex: number, plan: PlanSections) => {
    if (itineraryId) {
      return fetch(`/api/itineraries/${itineraryId}/days/${dayIndex}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
    }
    return fetch('/api/plan-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayIndex, plan, tabKey }),
    })
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  function getEffectiveData(): RouteDay[] {
    return days.map((day, i) => ({
      ...day,
      plan: planOverrides[i] ?? day.plan,
      train: trainOverrides[i] ?? day.train,
    }))
  }

  function openFloatingPicker() {
    if (floatingButtonRef.current) {
      setPickerAnchorRect(floatingButtonRef.current.getBoundingClientRect())
    }
    setFloatingPickerOpen(true)
    setExportError(null)
  }

  function closeFloatingPicker() {
    setFloatingPickerOpen(false)
    setExportError(null)
    setIsPdfGenerating(false)
    setTimeout(() => floatingButtonRef.current?.focus(), 0)
  }

  async function handleExportMarkdown() {
    try {
      const content = buildMarkdownTable(getEffectiveData())
      await saveFile({ content, filename: 'itinerary.md', mimeType: 'text/markdown' })
      closeFloatingPicker()
      setExportSuccess(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        closeFloatingPicker()
      }
    }
  }

  function handleExportPdf() {
    // PDF export is temporarily disabled — this is a no-op stub.
  }

  const buildScheduleKey = (trainId: string, start?: string, end?: string) =>
    `${trainId}|${start ?? ''}|${end ?? ''}`

  const planSections = [
    { label: 'Morning',   key: 'morning',   icon: <Sunrise size={16} /> },
    { label: 'Afternoon', key: 'afternoon', icon: <Sun     size={16} /> },
    { label: 'Evening',   key: 'evening',   icon: <Moon    size={16} /> },
  ] as { label: string; key: 'morning' | 'afternoon' | 'evening'; icon: React.ReactNode }[]

  const handleRowDoubleClick = (dayIndex: number, sectionKey: string, currentValue: string) => {
    setEditingRowId(`${dayIndex}|${sectionKey}`)
    setEditingValue(currentValue)
    setDndError((prev) => { const next = { ...prev }; delete next[dayIndex]; return next })
  }

  const handleEditBlur = async (dayIndex: number, sectionKey: string, day: typeof processedData[0]) => {
    setEditingRowId(null)

    const currentPlan = planOverrides[dayIndex] ?? day.plan
    if (editingValue === currentPlan[sectionKey as keyof PlanSections]) return

    const newPlan: PlanSections = { ...currentPlan, [sectionKey]: editingValue }
    setPlanOverrides((prev) => ({ ...prev, [dayIndex]: newPlan }))

    try {
      const response = await savePlanUpdate(dayIndex, newPlan)

      if (!response.ok) {
        const errorData = await response.json()
        setPlanOverrides((prev) => ({ ...prev, [dayIndex]: currentPlan }))
        setDndError((prev) => ({ ...prev, [dayIndex]: errorData.error || 'Failed to save' }))
      }
    } catch {
      setPlanOverrides((prev) => ({ ...prev, [dayIndex]: currentPlan }))
      setDndError((prev) => ({ ...prev, [dayIndex]: 'Error saving plan. Please try again.' }))
    }
  }

  const handleDragStart = (dayIndex: number, sectionKey: string, e: React.DragEvent) => {
    if ((e.target as HTMLElement).dataset.noDrag) {
      e.preventDefault()
      return
    }
    setDragSourceId(`${dayIndex}|${sectionKey}`)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (dayIndex: number, sectionKey: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!dragSourceId) return
    const sourceDayIndex = parseInt(dragSourceId.split('|')[0], 10)
    if (sourceDayIndex !== dayIndex) return
    setDragOverId(`${dayIndex}|${sectionKey}`)
  }

  const handleDrop = (dayIndex: number, targetKey: string, e: React.DragEvent, day: typeof processedData[0]) => {
    e.preventDefault()
    if (!dragSourceId) return
    const [sourceDayStr, sourceKey] = dragSourceId.split('|')
    const sourceDayIndex = parseInt(sourceDayStr, 10)
    if (sourceDayIndex !== dayIndex || sourceKey === targetKey) {
      setDragSourceId(null)
      setDragOverId(null)
      return
    }

    const currentPlan = planOverrides[dayIndex] ?? day.plan
    const newPlan: PlanSections = {
      ...currentPlan,
      [sourceKey]: currentPlan[targetKey as keyof PlanSections],
      [targetKey]: currentPlan[sourceKey as keyof PlanSections],
    }

    setPlanOverrides((prev) => ({ ...prev, [dayIndex]: newPlan }))
    setDragSourceId(null)
    setDragOverId(null)

    autoSavePlan(dayIndex, newPlan, currentPlan)
  }

  const handleDragEnd = () => {
    setDragSourceId(null)
    setDragOverId(null)
  }

  const autoSavePlan = async (dayIndex: number, newPlan: PlanSections, originalPlan: PlanSections) => {
    setSavingDndDayIndex(dayIndex)
    setDndError((prev) => {
      const next = { ...prev }
      delete next[dayIndex]
      return next
    })

    try {
      const response = await savePlanUpdate(dayIndex, newPlan)

      if (!response.ok) {
        const errorData = await response.json()
        setPlanOverrides((prev) => ({ ...prev, [dayIndex]: originalPlan }))
        setDndError((prev) => ({ ...prev, [dayIndex]: errorData.error || 'Failed to save' }))
      }
    } catch {
      setPlanOverrides((prev) => ({ ...prev, [dayIndex]: originalPlan }))
      setDndError((prev) => ({ ...prev, [dayIndex]: 'Error saving plan. Please try again.' }))
    } finally {
      setSavingDndDayIndex(null)
    }
  }

  const closeTrainEditor = (force = false) => {
    if (trainEditorSaving && !force) return
    setTrainEditorDayIndex(null)
    setTrainEditorRows([])
    setTrainEditorRowErrors({})
    setTrainEditorLegacyError(null)
    setTrainEditorSaveError(null)
    setTrainEditorAnnouncement('')
    setTrainEditorDragSourceRowId(null)
    setTrainEditorDragOverRowId(null)
    setTimeout(() => trainEditorTriggerRef.current?.focus(), 0)
  }

  const openTrainEditor = (
    index: number,
    trainData: RouteDay['train'],
    triggerButton: HTMLButtonElement
  ) => {
    trainEditorTriggerRef.current = triggerButton
    const parsed = parseTrainScheduleForDraft(trainOverrides[index] ?? trainData)
    setTrainEditorDayIndex(index)
    setTrainEditorRowErrors({})
    setTrainEditorSaveError(null)
    setTrainEditorAnnouncement('')

    if (!parsed.ok) {
      setTrainEditorLegacyError(parsed.error)
      setTrainEditorRows([])
      return
    }

    setTrainEditorLegacyError(null)
    setTrainEditorRows(parsed.rows)
  }

  const setTrainEditorField = (
    rowId: string,
    field: 'trainId' | 'start' | 'end',
    value: string
  ) => {
    setTrainEditorRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)))
    setTrainEditorSaveError(null)
    setTrainEditorRowErrors((prev) => {
      if (!prev[rowId]) return prev
      const rowErrors = { ...prev[rowId] }
      if (field === 'trainId') {
        delete rowErrors.trainId
      }
      if (field === 'start' || field === 'end') {
        delete rowErrors.stationPair
      }
      const next = { ...prev }
      if (!rowErrors.trainId && !rowErrors.stationPair) {
        delete next[rowId]
      } else {
        next[rowId] = rowErrors
      }
      return next
    })
  }

  const addTrainEditorRow = () => {
    setTrainEditorRows((prev) => [...prev, createEmptyTrainScheduleDraftRow()])
    setTrainEditorSaveError(null)
  }

  const removeTrainEditorRow = (rowId: string) => {
    setTrainEditorRows((prev) => prev.filter((row) => row.id !== rowId))
    setTrainEditorRowErrors((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setTrainEditorSaveError(null)
  }

  const handleTrainEditorRowDragStart = (rowId: string, e: React.DragEvent) => {
    setTrainEditorDragSourceRowId(rowId)
    setTrainEditorDragOverRowId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData?.('text/plain', rowId)
  }

  const handleTrainEditorRowDragOver = (rowId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!trainEditorDragSourceRowId || trainEditorDragSourceRowId === rowId) return
    setTrainEditorDragOverRowId(rowId)
  }

  const handleTrainEditorRowDrop = (targetRowId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!trainEditorDragSourceRowId || trainEditorDragSourceRowId === targetRowId) {
      setTrainEditorDragSourceRowId(null)
      setTrainEditorDragOverRowId(null)
      return
    }

    setTrainEditorRows((prev) => {
      const fromIndex = prev.findIndex((row) => row.id === trainEditorDragSourceRowId)
      const toIndex = prev.findIndex((row) => row.id === targetRowId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev
      }
      setTrainEditorAnnouncement(`Moved row ${fromIndex + 1} to position ${toIndex + 1}.`)
      return moveDraftRow(prev, fromIndex, toIndex)
    })
    setTrainEditorSaveError(null)
    setTrainEditorDragSourceRowId(null)
    setTrainEditorDragOverRowId(null)
  }

  const handleTrainEditorRowDragEnd = () => {
    setTrainEditorDragSourceRowId(null)
    setTrainEditorDragOverRowId(null)
  }

  const handleTrainEditorSave = async () => {
    if (trainEditorDayIndex === null || trainEditorLegacyError) return

    const validation = validateTrainScheduleDraftRows(trainEditorRows)
    setTrainEditorRowErrors(validation.errors)
    if (!validation.isValid) {
      if (validation.firstInvalidField) {
        const refKey = `${validation.firstInvalidField.rowId}:${validation.firstInvalidField.field}`
        trainEditorInputRefs.current[refKey]?.focus()
      }
      return
    }

    setTrainEditorSaving(true)
    setTrainEditorSaveError(null)

    try {
      const res = await fetch('/api/train-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayIndex: trainEditorDayIndex,
          trainJson: serializeDraftRows(trainEditorRows),
          tabKey,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setTrainEditorSaveError(data.error || 'Could not save train schedule. Your edits are still open.')
      } else {
        const updatedDay = await res.json()
        setTrainOverrides((prev) => ({ ...prev, [trainEditorDayIndex]: updatedDay.train }))
        closeTrainEditor(true)
      }
    } catch {
      setTrainEditorSaveError('Could not save train schedule. Your edits are still open.')
    } finally {
      setTrainEditorSaving(false)
    }
  }

  useEffect(() => {
    if (trainEditorDayIndex === null || trainEditorSaving) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTrainEditorDayIndex(null)
        setTrainEditorRows([])
        setTrainEditorRowErrors({})
        setTrainEditorLegacyError(null)
        setTrainEditorSaveError(null)
        setTrainEditorAnnouncement('')
        setTrainEditorDragSourceRowId(null)
        setTrainEditorDragOverRowId(null)
        setTimeout(() => trainEditorTriggerRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trainEditorDayIndex, trainEditorSaving])

  useEffect(() => {
    onDirtyStateChange?.(editingRowId !== null || stayEditingIndex !== null)
  }, [editingRowId, onDirtyStateChange, stayEditingIndex])

  // Fetch train schedules for DB trains
  useEffect(() => {
    const fetchSchedules = async () => {
      setSchedulesLoading(true)
      const schedules: Record<string, TrainStopsResult | null> = {}

      for (const day of days) {
        for (const trainEntry of day.train) {
          if (!('start' in trainEntry) || !trainEntry.start || !trainEntry.end) continue

          const trainId = normalizeTrainId(trainEntry.train_id)
          const key = buildScheduleKey(trainId, trainEntry.start as string, trainEntry.end as string)
          if (key in schedules) continue

          try {
            const railway = getRailwayFromTrainId(trainEntry.train_id)
            const url = `/api/timetable?train=${encodeURIComponent(trainId)}${railway ? `&railway=${railway}` : ''}`
            const res = await fetch(url)
            const rows = (await res.json()) as TimetableRow[]
            if (!rows || rows.length === 0) {
              schedules[key] = null
              continue
            }

            let fromStation = null as TimetableRow | null
            let toStation = null as TimetableRow | null

            fromStation = findMatchingStation(rows as unknown as Array<{ station_name: string; [key: string]: unknown }>, trainEntry.start as string, 'from') as TimetableRow | null
            toStation = findMatchingStation(rows as unknown as Array<{ station_name: string; [key: string]: unknown }>, trainEntry.end as string, 'to') as TimetableRow | null

            if (!fromStation || !toStation) {
              schedules[key] = null
              continue
            }

            schedules[key] = {
              fromStation: fromStation.station_name,
              depTime: formatTime(fromStation.departure_planned_time),
              toStation: toStation.station_name,
              arrTime: formatTime(toStation.arrival_planned_time),
            }
          } catch {
            schedules[key] = null
          }
        }
      }

      setTrainSchedules(schedules)
      setSchedulesLoading(false)
    }

    fetchSchedules()
  }, [days])

  return (
    <div
      data-testid={tabKey === 'route-test' ? 'itinerary-test-tab' : 'itinerary-tab'}
      className="w-full"
    >
      {/* Relative wrapper so the zero-height sticky anchor is contained */}
      <div className="relative">
        {/* Zero-height sticky anchor — stays at top-0 while scrolling, doesn't occupy layout height */}
        <div className="sticky top-0 z-20 h-0 pointer-events-none">
          {/* Buttons: absolute at left:100% so they sit outside the table's right edge */}
          <div className="absolute top-2 left-full ml-2 flex flex-col gap-1 pointer-events-auto">
            {onRequestAddStay && (
              <button
                type="button"
                onClick={onRequestAddStay}
                aria-label="Add next stay"
                title="Add next stay"
                className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-shadow"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            )}
            <FloatingExportButton
              hasData={days.length > 0}
              isPickerOpen={floatingPickerOpen}
              onOpen={openFloatingPicker}
              buttonRef={floatingButtonRef}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-x-auto border border-gray-200">
      <table className="w-full border-collapse text-left">
        <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
          <tr>
            {['Date', 'Country', 'Overnight', 'Plan', 'Attractions', 'Train Schedule'].map((h) => (
              <th
                key={h}
                className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.map((day, index) => {
            // Find the stay for this overnight cell (only relevant when overnightRowSpan > 0)
            const stay = day.overnightRowSpan > 0
              ? stays.find((s) => s.firstDayIndex === index)
              : undefined
            const dayNum = typeof day.dayNum === 'number' && Number.isFinite(day.dayNum) ? day.dayNum : index + 1
            const dayColor = ATTRACTION_TAG_COLORS[(dayNum - 1) % ATTRACTION_TAG_COLORS.length]

            return (
              <tr key={index} className="group hover:bg-gray-50">
                <td className="px-6 py-4 border-b border-gray-200 align-middle whitespace-nowrap tabular-nums group-last:border-b-0">
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 leading-tight items-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-semibold border ${dayColor.bg} ${dayColor.text} ${dayColor.border}`}
                    >
                      {dayNum}
                    </span>
                    <span data-testid="itinerary-date" className="text-gray-600">{day.date}</span>
                    <span className="col-start-2 text-sm text-gray-500">{day.weekDay}</span>
                  </div>
                </td>

                {countrySpans[index] > 0 && (() => {
                  const countryValue = day.location?.kind === 'resolved'
                    ? (day.location.place.country ?? day.location.place.countryCode ?? '—')
                    : '—'
                  return (
                    <td
                      rowSpan={countrySpans[index]}
                      className="px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
                      style={{ backgroundColor: getCountryColor(countryValue) }}
                    >
                      {countryValue}
                    </td>
                  )
                })()}

                {day.overnightRowSpan > 0 && (
                  <td
                    rowSpan={day.overnightRowSpan}
                    className="relative group px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
                    style={{ backgroundColor: getCityColor(
                      day.location?.kind === 'resolved' ? day.location.place.name : day.overnight,
                      day.location?.kind === 'resolved' ? (day.location.place.country ?? '') : ''
                    ) }}
                  >
                    {stay && isItineraryScopedStayEdit ? (
                      <>
                        <div className="relative inline-block">
                          <span>{day.location?.kind === 'resolved' ? day.location.place.name : day.overnight}</span>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-row gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white/90 text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            onClick={() => onRequestEditStay?.(stay.stayIndex)}
                            aria-label={`Edit stay for ${stay.overnight}`}
                            title={`Edit stay for ${stay.overnight}`}
                          >
                            <Pencil size={12} aria-hidden="true" />
                          </button>
                          {onMoveStay && stay.stayIndex > 0 && (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white/90 text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              onClick={() => onMoveStay(stay.stayIndex, 'up')}
                              aria-label={`Move ${stay.overnight} up`}
                              title={`Move ${stay.overnight} up`}
                            >
                              ▲
                            </button>
                          )}
                          {onMoveStay && !stay.isLast && (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white/90 text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              onClick={() => onMoveStay(stay.stayIndex, 'down')}
                              aria-label={`Move ${stay.overnight} down`}
                              title={`Move ${stay.overnight} down`}
                            >
                              ▼
                            </button>
                          )}
                          </div>
                        </div>
                      </>
                    ) : stay && !stay.isLast ? (
                      <div className="space-y-2">
                        <StayEditControl
                          stayIndex={stay.stayIndex}
                          city={day.location?.kind === 'resolved' ? day.location.place.name : day.overnight}
                          currentNights={stay.nights}
                          maxAdditionalNights={
                            (stays[stay.stayIndex + 1]?.nights ?? 1) - 1
                          }
                          isLast={false}
                          isSaving={stayEditSaving}
                          onConfirm={handleStayConfirm}
                          onCancel={handleStayCancel}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span>{day.location?.kind === 'resolved' ? day.location.place.name : day.overnight}</span>
                      </div>
                    )}
                  </td>
                )}

                <td className="px-6 py-4 border-b border-gray-200 align-middle min-w-[280px] group-last:border-b-0">
                  <div className="space-y-1 text-sm text-gray-700">
                    {dndError[index] && (
                      <div className="text-red-600 text-xs font-semibold mb-1">{dndError[index]}</div>
                    )}
                    {planSections.map((section, sectionIndex) => {
                      const rowId = `${index}|${section.key}`
                      const isEditing = editingRowId === rowId
                      const value = (planOverrides[index] ?? day.plan)[section.key].trim()

                      if (isEditing) {
                        return (
                          <React.Fragment key={section.key}>
                            {sectionIndex > 0 && <hr className="border-gray-100" />}
                          <div className="flex gap-2 items-start rounded">
                            <span className="shrink-0 text-gray-400 mt-0.5" title={section.label}>
                              {section.icon}
                            </span>
                            <textarea
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur() }}
                              onBlur={() => handleEditBlur(index, section.key, day)}
                              autoFocus
                              rows={2}
                              className="flex-1 px-1 py-0.5 border border-blue-400 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          </React.Fragment>
                        )
                      }

                      return (
                        <React.Fragment key={section.key}>
                          {sectionIndex > 0 && <hr className="border-gray-100" />}
                        <div
                          key={section.key}
                          data-testid={`plan-row-${index}-${section.key}`}
                          draggable={savingDndDayIndex !== index}
                          onDoubleClick={() => handleRowDoubleClick(index, section.key, value)}
                          onDragStart={(e) => handleDragStart(index, section.key, e)}
                          onDragOver={(e) => handleDragOver(index, section.key, e)}
                          onDrop={(e) => handleDrop(index, section.key, e, day)}
                          onDragEnd={handleDragEnd}
                          className={`flex gap-2 items-center rounded cursor-grab select-none
                            ${dragSourceId === rowId ? 'opacity-40' : ''}
                            ${dragOverId === rowId ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                            ${savingDndDayIndex === index ? 'cursor-wait' : ''}
                          `}
                        >
                          <span data-no-drag="true" className="shrink-0 text-gray-400 cursor-default" title={section.label}>
                            {section.icon}
                          </span>
                          <span className={`flex-1 ${value ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                            {value ? renderMarkdown(value) : '—'}
                          </span>
                          <span aria-label="Drag to reorder" className="text-gray-300 shrink-0">
                            <GripVertical size={14} />
                          </span>
                        </div>
                        </React.Fragment>
                      )
                    })}
                  </div>
                </td>

                {/* ── Attractions cell ─────────────────────────────────── */}
                <td className="px-4 py-3 border-b border-gray-200 align-top group-last:border-b-0 min-w-[200px] max-w-[300px]">
                  {(() => {
                    const attractions = getAttractionsForDay(day, index)
                    const isAdding = addingAttractionDayIndex === index

                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-col gap-1 items-start">
                          {attractions.map((attraction, aIdx) => {
                            const color = ATTRACTION_TAG_COLORS[aIdx % ATTRACTION_TAG_COLORS.length]
                            return (
                              <div
                                key={attraction.id}
                                className="group/tag relative inline-flex items-center"
                              >
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}>
                                  {attraction.label}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${attraction.label}`}
                                  className="absolute left-full ml-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/tag:opacity-100 transition-opacity rounded-full hover:bg-black/10 p-0.5"
                                  onClick={() => removeAttraction(index, attraction.id)}
                                >
                                  <X size={10} aria-hidden="true" />
                                </button>
                              </div>
                            )
                          })}
                        </div>

                        {isAdding && (
                          <div className="relative w-full">
                            <input
                              ref={attractionInputRef}
                              role="combobox"
                              aria-label="Search attractions"
                              aria-expanded={attractionSearchOpen}
                              autoFocus
                              value={attractionQuery}
                              onChange={(e) => {
                                setAttractionQuery(e.target.value)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') { closeAttractionSearch(); return }
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault()
                                  setAttractionActiveIndex((i) => Math.min(i + 1, attractionResults.length - 1))
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault()
                                  setAttractionActiveIndex((i) => Math.max(i - 1, 0))
                                } else if (e.key === 'Enter' && attractionResults[attractionActiveIndex]) {
                                  e.preventDefault()
                                  selectAttraction(index, attractionResults[attractionActiveIndex])
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => closeAttractionSearch(), 150)
                              }}
                              placeholder="Type to search…"
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {attractionSearchLoading && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                                <svg className="h-3 w-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                              </span>
                            )}
                            {attractionSearchOpen && attractionResults.length > 0 && (
                              <ul
                                role="listbox"
                                className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-sm text-xs"
                              >
                                {attractionResults.map((result, rIdx) => (
                                  <li
                                    key={result.place.placeId}
                                    role="option"
                                    aria-selected={rIdx === attractionActiveIndex}
                                    className={`cursor-pointer px-3 py-1.5 ${rIdx === attractionActiveIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      selectAttraction(index, result)
                                    }}
                                  >
                                    <p className="font-medium">{result.place.name}</p>
                                    {result.place.country && (
                                      <p className="text-gray-400">{[result.place.locality, result.place.region, result.place.country].filter(Boolean).join(', ')}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {(attractions.length > 0 || !isAdding) && (
                          <div className="w-full flex justify-start gap-2">
                            {!isAdding && (
                              <button
                                type="button"
                                aria-label={`Add attraction for day ${day.dayNum}`}
                                title="Add attraction"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                onClick={() => openAttractionSearch(index)}
                              >
                                <Plus size={10} aria-hidden="true" />
                                Add
                              </button>
                            )}

                            {attractions.length > 0 && (
                              <button
                                type="button"
                                ref={(el) => { attractionMiniMapButtonRefs.current[index] = el }}
                                aria-label={`Preview attractions map for day ${day.dayNum}`}
                                title="Preview map"
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                onClick={() => openAttractionMiniMap(index, attractionMiniMapButtonRefs.current[index] ?? null)}
                              >
                                <MapIcon size={12} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </td>

                <td className="px-6 py-4 border-b border-gray-200 align-middle text-sm text-gray-600 group-last:border-b-0 relative">
                  <button
                    data-testid={`train-json-edit-btn-${index}`}
                    onClick={(e) => openTrainEditor(index, day.train, e.currentTarget)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                    aria-label="Edit train schedule"
                  >
                    <Pencil size={14} />
                  </button>
                  {(() => {
                    const effectiveTrain = trainOverrides[index] ?? day.train
                    return effectiveTrain && effectiveTrain.length > 0 ? (
                    <div className="space-y-2">
                      {effectiveTrain.map((item, i) => {
                        const trainId = normalizeTrainId(item.train_id)
                        const isDbTrain = !!(item.start && item.end)
                        const scheduleKey = isDbTrain
                          ? buildScheduleKey(trainId, item.start, item.end)
                          : null
                        const schedule = scheduleKey ? trainSchedules[scheduleKey] : null
                        const isLoading = scheduleKey && schedulesLoading && !(scheduleKey in trainSchedules)

                        return (
                          <div key={i} className="flex flex-col gap-0.5">
                            {isDbTrain ? (
                              <div>
                                <span
                                  data-testid="train-tag"
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"
                                >
                                  {trainId}
                                </span>
                              </div>
                            ) : (
                              <>
                                <span
                                  data-testid="invalid-train-dash"
                                  className="text-gray-400 italic"
                                >
                                  —
                                </span>
                                <span
                                  data-testid="invalid-train-comment"
                                  className="text-xs text-gray-400 italic"
                                >
                                  ({trainId})
                                </span>
                              </>
                            )}

                            {isLoading ? (
                              <span
                                role="status"
                                aria-label="Loading"
                                className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin align-middle"
                              />
                            ) : schedule ? (
                              <div
                                data-testid="schedule-grid"
                                className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-xs text-gray-500 pl-1 items-baseline"
                              >
                                <span className="truncate">{schedule.fromStation}</span>
                                <span className="tabular-nums text-right">{schedule.depTime}</span>
                                <span className="truncate">{schedule.toStation}</span>
                                <span className="tabular-nums text-right">{schedule.arrTime}</span>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">—</span>
                  )
                  })()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
        </div>{/* end table card */}
      </div>{/* end relative wrapper */}

      {trainEditorDayIndex !== null && (
        <div
          data-testid="train-schedule-editor-modal"
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit train schedule"
            className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-auto"
          >
            <h2 className="text-lg font-semibold text-gray-900">Edit train schedule</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Day {processedData[trainEditorDayIndex].dayNum} · {processedData[trainEditorDayIndex].date}
            </p>

            {trainEditorLegacyError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {trainEditorLegacyError}
              </div>
            ) : (
              <>
                <div className="sr-only" aria-live="polite">{trainEditorAnnouncement}</div>

                {trainEditorRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 space-y-3">
                    <p>No trains added for this day yet.</p>
                    <button
                      type="button"
                      data-testid="train-editor-add-row"
                      onClick={addTrainEditorRow}
                      disabled={trainEditorSaving}
                      className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add train
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainEditorRows.map((row, rowIndex) => (
                      <div
                        key={row.id}
                        data-testid={`train-editor-row-${rowIndex + 1}`}
                        draggable={!trainEditorSaving}
                        onDragStart={(e) => handleTrainEditorRowDragStart(row.id, e)}
                        onDragOver={(e) => handleTrainEditorRowDragOver(row.id, e)}
                        onDrop={(e) => handleTrainEditorRowDrop(row.id, e)}
                        onDragEnd={handleTrainEditorRowDragEnd}
                        className={`rounded-lg border border-gray-200 p-3 space-y-2 cursor-grab
                          ${trainEditorDragSourceRowId === row.id ? 'opacity-40' : ''}
                          ${trainEditorDragOverRowId === row.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                          ${trainEditorSaving ? 'cursor-wait' : ''}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">Train {rowIndex + 1}</p>
                          <span aria-label="Drag to reorder trains" className="text-gray-300 shrink-0">
                            <GripVertical size={14} />
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
                          <div>
                            <label htmlFor={`train-id-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                              Train ID
                            </label>
                            <input
                              id={`train-id-${row.id}`}
                              type="text"
                              aria-label={`Train ID for row ${rowIndex + 1}`}
                              value={row.trainId}
                              onChange={(e) => setTrainEditorField(row.id, 'trainId', e.target.value)}
                              disabled={trainEditorSaving}
                              ref={(el) => { trainEditorInputRefs.current[`${row.id}:trainId`] = el }}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus={rowIndex === 0}
                            />
                            {trainEditorRowErrors[row.id]?.trainId && (
                              <p className="text-xs text-red-600 mt-1">{trainEditorRowErrors[row.id].trainId}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor={`train-start-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                              Start station
                            </label>
                            <input
                              id={`train-start-${row.id}`}
                              type="text"
                              aria-label={`Start station for row ${rowIndex + 1}`}
                              value={row.start}
                              onChange={(e) => setTrainEditorField(row.id, 'start', e.target.value)}
                              disabled={trainEditorSaving}
                              ref={(el) => { trainEditorInputRefs.current[`${row.id}:start`] = el }}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label htmlFor={`train-end-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                              End station
                            </label>
                            <input
                              id={`train-end-${row.id}`}
                              type="text"
                              aria-label={`End station for row ${rowIndex + 1}`}
                              value={row.end}
                              onChange={(e) => setTrainEditorField(row.id, 'end', e.target.value)}
                              disabled={trainEditorSaving}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <button
                              type="button"
                              data-testid={`train-editor-delete-${rowIndex + 1}`}
                              onClick={() => removeTrainEditorRow(row.id)}
                              disabled={trainEditorSaving}
                              className="h-[34px] px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                              aria-label={`Delete row ${rowIndex + 1}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {trainEditorRowErrors[row.id]?.stationPair && (
                          <p className="text-xs text-red-600">{trainEditorRowErrors[row.id].stationPair}</p>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      data-testid="train-editor-add-row"
                      onClick={addTrainEditorRow}
                      disabled={trainEditorSaving}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Add train
                    </button>
                  </div>
                )}

                {trainEditorSaveError && (
                  <p data-testid="train-editor-save-error" role="alert" className="text-sm text-red-600 mt-3">
                    {trainEditorSaveError}
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                data-testid="train-editor-cancel"
                onClick={() => closeTrainEditor()}
                disabled={trainEditorSaving}
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {trainEditorLegacyError ? 'Close' : 'Cancel'}
              </button>
              {!trainEditorLegacyError && (
                <button
                  data-testid="train-editor-save"
                  onClick={handleTrainEditorSave}
                  disabled={trainEditorSaving}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {trainEditorSaving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export format picker — portal to document.body, positioned to the left of the export button */}
      {typeof document !== 'undefined' && floatingPickerOpen && pickerAnchorRect && createPortal(
        <div
          className="fixed z-[45]"
          style={{
            top: `${pickerAnchorRect.top}px`,
            right: `${window.innerWidth - pickerAnchorRect.left + 8}px`,
          }}
        >
          <ExportFormatPicker
            onExportMarkdown={handleExportMarkdown}
            onExportPdf={handleExportPdf}
            onClose={closeFloatingPicker}
            exportError={exportError}
            isPdfGenerating={isPdfGenerating}
          />
        </div>,
        document.body
      )}

      {/* Attraction minimap popover — portal to document.body */}
      {typeof document !== 'undefined' && attractionMiniMapDayIndex !== null && createPortal(
        <div
          className="fixed z-[46]"
          style={{
            top: `${(attractionMiniMapRect?.bottom ?? 0) + 8}px`,
            left: `${attractionMiniMapRect?.left ?? 0}px`,
          }}
        >
          <div
            className="rounded-xl shadow-xl border border-gray-200 bg-white overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-600">Attractions map</span>
              <button
                type="button"
                aria-label="Close map"
                className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                onClick={closeAttractionMiniMap}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <AttractionMiniMap
              attractions={getAttractionsForDay(days[attractionMiniMapDayIndex], attractionMiniMapDayIndex)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Export success toast */}
      {exportSuccess && (
        <ExportSuccessToast
          message="Itinerary exported!"
          onDismiss={() => setExportSuccess(false)}
          autoDismissMs={3000}
        />
      )}

      {/* Stay edit error toast */}
      {stayEditError && (
        <div
          data-testid="stay-edit-error-toast"
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-red-200
                     bg-white px-4 py-3 shadow-lg text-sm text-gray-800"
        >
          <span className="text-red-500">⚠</span>
          <span>{stayEditError}</span>
          <button
            aria-label="Dismiss error"
            className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={() => setStayEditError(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
