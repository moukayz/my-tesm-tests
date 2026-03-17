'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Sunrise, Sun, Moon, GripVertical, Pencil } from 'lucide-react'
import {
  getOvernightColor,
  processItinerary,
  findMatchingStation,
  normalizeTrainId,
  getRailwayFromTrainId,
  type RouteDay,
  type PlanSections,
} from '../app/lib/itinerary'
import { formatTime } from '../app/lib/trainTimetable'
import { renderMarkdown } from '../app/lib/markdown'

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
}

export default function ItineraryTab({ initialData }: ItineraryTabProps) {
  const processedData = useMemo(() => processItinerary(initialData), [initialData])
  const [trainSchedules, setTrainSchedules] = useState<Record<string, TrainStopsResult | null>>({})
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [planOverrides, setPlanOverrides] = useState<Record<number, PlanSections>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingDndDayIndex, setSavingDndDayIndex] = useState<number | null>(null)
  const [dndError, setDndError] = useState<Record<number, string>>({})
  const [trainJsonModal, setTrainJsonModal] = useState<{ dayIndex: number; json: string } | null>(null)
  const [trainJsonEditValue, setTrainJsonEditValue] = useState('')
  const [trainJsonSaving, setTrainJsonSaving] = useState(false)
  const [trainJsonError, setTrainJsonError] = useState<string | null>(null)
  const [trainOverrides, setTrainOverrides] = useState<Record<number, RouteDay['train']>>({})

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
      const response = await fetch('/api/plan-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex, plan: newPlan }),
      })

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

    // Optimistic update
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
      const response = await fetch('/api/plan-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex, plan: newPlan }),
      })

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

  const handleTrainJsonSave = async () => {
    if (!trainJsonModal) return
    setTrainJsonSaving(true)
    setTrainJsonError(null)
    try {
      const res = await fetch('/api/train-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex: trainJsonModal.dayIndex, trainJson: trainJsonEditValue }),
      })
      if (!res.ok) {
        const data = await res.json()
        setTrainJsonError(data.error || 'Failed to save')
      } else {
        const updatedDay = await res.json()
        setTrainOverrides((prev) => ({ ...prev, [trainJsonModal.dayIndex]: updatedDay.train }))
        setTrainJsonModal(null)
      }
    } catch {
      setTrainJsonError('Network error. Please try again.')
    } finally {
      setTrainJsonSaving(false)
    }
  }

  const openTrainJsonModal = (index: number, trainData: RouteDay['train']) => {
    const json = JSON.stringify(trainOverrides[index] ?? trainData, null, 2)
    setTrainJsonModal({ dayIndex: index, json })
    setTrainJsonEditValue(json)
    setTrainJsonError(null)
  }

  // Close modal on Escape key
  useEffect(() => {
    if (!trainJsonModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTrainJsonModal(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trainJsonModal])

  // Fetch train schedules for DB trains
  useEffect(() => {
    const fetchSchedules = async () => {
      setSchedulesLoading(true)
      const schedules: Record<string, TrainStopsResult | null> = {}

      for (const day of initialData) {
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
  }, [initialData])

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden w-full border border-gray-200">
      <table className="w-full border-collapse text-left">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            {['Date', 'Weekday', 'Day', 'Overnight', 'Plan', 'Train Schedule'].map((h) => (
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
          {processedData.map((day, index) => (
            <tr key={index} className="group hover:bg-gray-50">
              <td className="px-6 py-4 border-b border-gray-200 align-middle whitespace-nowrap tabular-nums text-gray-600 group-last:border-b-0">
                {day.date}
              </td>
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-gray-500 text-sm group-last:border-b-0">
                {day.weekDay}
              </td>
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-center font-bold text-blue-500 group-last:border-b-0">
                {day.dayNum}
              </td>

              {day.overnightRowSpan > 0 && (
                <td
                  rowSpan={day.overnightRowSpan}
                  className="px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
                  style={{ backgroundColor: getOvernightColor(day.overnight) }}
                >
                  {day.overnight}
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
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-sm text-gray-600 group-last:border-b-0 relative">
                <button
                  data-testid={`train-json-edit-btn-${index}`}
                  onClick={() => openTrainJsonModal(index, day.train)}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                  aria-label="View train JSON"
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
                          {/* Train number: badge for DB trains, plain text for informal entries */}
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

                          {/* Schedule details */}
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
          ))}
        </tbody>
      </table>

      {trainJsonModal !== null && (
        <div
          data-testid="train-json-modal"
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        >
          <div
            role="dialog"
            aria-label="Train schedule JSON"
            className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Train Schedule JSON</h2>
            <textarea
              data-testid="train-json-content"
              value={trainJsonEditValue}
              onChange={(e) => { setTrainJsonEditValue(e.target.value); setTrainJsonError(null) }}
              rows={10}
              className="w-full text-xs font-mono bg-gray-50 rounded p-3 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
            />
            {trainJsonError && (
              <p data-testid="train-json-error" className="text-red-600 text-xs mt-1">{trainJsonError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                data-testid="train-json-close"
                onClick={() => setTrainJsonModal(null)}
                disabled={trainJsonSaving}
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                data-testid="train-json-save"
                onClick={handleTrainJsonSave}
                disabled={trainJsonSaving}
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {trainJsonSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
