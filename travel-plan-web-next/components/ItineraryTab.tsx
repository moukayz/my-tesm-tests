'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Sun, Cloud } from 'lucide-react'
import {
  getCityColor,
  getCountryColor,
  getOvernightColor,
  processItinerary,
  normalizeTrainId,
  type RouteDay,
  type ProcessedDay,
} from '../app/lib/itinerary'
import { getStaysWithMeta } from '../app/lib/stayUtils'
import { renderMarkdown } from '../app/lib/markdown'
import { useTrainSchedules, buildScheduleKey } from '../app/lib/hooks/useTrainSchedules'
import { useTrainEditor } from '../app/lib/hooks/useTrainEditor'
import { useNoteEditor } from '../app/lib/hooks/useNoteEditor'
import { useStayEdit } from '../app/lib/hooks/useStayEdit'
import { useExport } from '../app/lib/hooks/useExport'
import TrainScheduleEditorModal from './TrainScheduleEditorModal'
import AttractionCell from './AttractionCell'
import FloatingExportButton from './FloatingExportButton'
import ExportFormatPicker from './ExportFormatPicker'
import ExportSuccessToast from './ExportSuccessToast'
import StayEditControl from './StayEditControl'
import WeatherForecastModal from './WeatherForecastModal'
import CloudForecastModal from './CloudForecastModal'
import { DAY_COLORS } from '../app/lib/dayColors'
import type { StayLocation } from '../app/lib/itinerary-store/types'

function getCityAnchor(location: StayLocation | undefined, fallback: string): { label: string; lat: number; lng: number } | undefined {
  if (!location || location.kind === 'custom') return undefined
  const label = location.kind === 'resolved' ? location.place.name : fallback
  return { label, lat: location.coordinates.lat, lng: location.coordinates.lng }
}

interface ItineraryTabProps {
  initialData: RouteDay[]
  itineraryId?: string
  onRequestAddStay?: () => void
  onRequestEditStay?: (stayIndex: number) => void
  onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryTab({
  initialData,
  itineraryId,
  onRequestAddStay,
  onRequestEditStay,
  onMoveStay,
  onDirtyStateChange,
}: ItineraryTabProps) {
  // ── Days state ──────────────────────────────────────────────────────────────
  const [days, setDays] = useState<RouteDay[]>(() => initialData)
  const processedData = useMemo(() => processItinerary(days), [days])

  useEffect(() => { setDays(initialData) }, [initialData])

  // ── Train overrides (shared between editor and display) ─────────────────────
  const [trainOverrides, setTrainOverrides] = useState<Record<number, RouteDay['train']>>({})

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const { trainSchedules, schedulesLoading } = useTrainSchedules(days)
  const trainEditor = useTrainEditor({ trainOverrides, setTrainOverrides })
  const noteEditor = useNoteEditor({ days, itineraryId })
  const stayEdit = useStayEdit({ days, itineraryId, setDays })

  const getEffectiveData = useCallback((): RouteDay[] => {
    return days.map((day, i) => ({
      ...day,
      note: noteEditor.noteOverrides[i] ?? day.note,
      train: trainOverrides[i] ?? day.train,
    }))
  }, [days, noteEditor.noteOverrides, trainOverrides])

  const exportState = useExport({ getEffectiveData })

  // ── Derived ─────────────────────────────────────────────────────────────────
  const stays = useMemo(() => getStaysWithMeta(days), [days])
  const isItineraryScopedStayEdit = Boolean(itineraryId && onRequestEditStay)

  // ── Stay action panel (outside table, left side) ────────────────────────
  const [actionPanel, setActionPanel] = useState<{
    stay: ReturnType<typeof getStaysWithMeta>[number]
    day: ProcessedDay
    top: number
    height: number
    color: string
  } | null>(null)
  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})
  const stayIndexByDayIndex = useMemo(() => {
    const map: Record<number, number> = {}
    stays.forEach((s) => {
      for (let i = s.firstDayIndex; i < s.firstDayIndex + s.nights; i++) {
        map[i] = s.stayIndex
      }
    })
    return map
  }, [stays])

  // ── Dirty state notification ────────────────────────────────────────────────
  useEffect(() => {
    onDirtyStateChange?.(noteEditor.editingNoteIndex !== null || stayEdit.stayEditingIndex !== null)
  }, [noteEditor.editingNoteIndex, onDirtyStateChange, stayEdit.stayEditingIndex])

  return (
    <div data-testid="itinerary-tab" className="w-full">
      <div className="relative">
        {/* Sticky floating buttons */}
        <div className="sticky top-0 z-20 h-0 pointer-events-none">
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
              isPickerOpen={exportState.floatingPickerOpen}
              onOpen={exportState.openFloatingPicker}
              buttonRef={exportState.floatingButtonRef}
            />
          </div>
        </div>

        <div
          ref={tableWrapperRef}
          className="relative pl-10 -ml-10"
          onMouseLeave={() => setActionPanel(null)}
        >
          {/* Stay action panels — one per stay, always in DOM, visible only on hover */}
          {isItineraryScopedStayEdit && stays.map((s) => {
            const isActive = actionPanel?.stay.stayIndex === s.stayIndex
            const stayDay = processedData[s.firstDayIndex]
            return (
              <StayActionPanel
                key={s.stayIndex}
                isActive={isActive}
                top={isActive && actionPanel ? actionPanel.top : 0}
                height={isActive && actionPanel ? actionPanel.height : 0}
                color={isActive && actionPanel ? actionPanel.color : 'transparent'}
                stay={s}
                day={stayDay}
                onRequestEditStay={onRequestEditStay}
                onMoveStay={onMoveStay}
                onActivate={() => {
                  if (!tableWrapperRef.current) return
                  const firstRow = rowRefs.current[s.firstDayIndex]
                  const lastRow = rowRefs.current[s.firstDayIndex + s.nights - 1]
                  if (!firstRow || !lastRow) return
                  const containerRect = tableWrapperRef.current.getBoundingClientRect()
                  const top = firstRow.getBoundingClientRect().top - containerRect.top
                  const height = lastRow.getBoundingClientRect().bottom - firstRow.getBoundingClientRect().top
                  const color = getCityColor(
                    stayDay.location?.kind === 'resolved' ? stayDay.location.place.name : stayDay.overnight,
                    stayDay.location?.kind === 'resolved' ? (stayDay.location.place.country ?? '') : ''
                  )
                  setActionPanel({ stay: s, day: stayDay, top, height, color })
                }}
              />
            )
          })}

          <div className="bg-white rounded-xl shadow-lg overflow-x-auto border border-gray-200">
          <table className="w-full border-collapse text-left">
            <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                {(['Overnight', 'Date', 'Attractions', 'Train Schedule', 'Note'] as const).map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider${h === 'Train Schedule' ? ' border-r border-gray-200' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processedData.map((day, index) => {
                const stay = day.overnightRowSpan > 0
                  ? stays.find((s) => s.firstDayIndex === index)
                  : undefined
                const dayNum = typeof day.dayNum === 'number' && Number.isFinite(day.dayNum) ? day.dayNum : index + 1
                const dayColor = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length]

                return (
                  <tr
                    key={index}
                    ref={(el) => { rowRefs.current[index] = el }}
                    className="group hover:bg-gray-50"
                    onMouseEnter={() => {
                      if (!isItineraryScopedStayEdit || !tableWrapperRef.current) return
                      const si = stayIndexByDayIndex[index]
                      if (si === undefined) return
                      const hoveredStay = stays[si]
                      if (!hoveredStay) return
                      const firstRow = rowRefs.current[hoveredStay.firstDayIndex]
                      const lastRow = rowRefs.current[hoveredStay.firstDayIndex + hoveredStay.nights - 1]
                      if (!firstRow || !lastRow) return
                      const containerRect = tableWrapperRef.current.getBoundingClientRect()
                      const top = firstRow.getBoundingClientRect().top - containerRect.top
                      const height = lastRow.getBoundingClientRect().bottom - firstRow.getBoundingClientRect().top
                      const stayDay = processedData[hoveredStay.firstDayIndex]
                      const color = getCityColor(
                        stayDay.location?.kind === 'resolved' ? stayDay.location.place.name : stayDay.overnight,
                        stayDay.location?.kind === 'resolved' ? (stayDay.location.place.country ?? '') : ''
                      )
                      setActionPanel({ stay: hoveredStay, day: stayDay, top, height, color })
                    }}
                  >
                    {/* ── Overnight cell ─────────────────────────────── */}
                    {day.overnightRowSpan > 0 && (
                      <OvernightCell
                        day={day}
                        stay={stay}
                        isItineraryScopedStayEdit={isItineraryScopedStayEdit}
                        stayEditSaving={stayEdit.stayEditSaving}
                        stays={stays}
                        onStayConfirm={stayEdit.handleStayConfirm}
                        onStayCancel={stayEdit.handleStayCancel}
                      />
                    )}

                    {/* ── Date cell ──────────────────────────────────── */}
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

                    {/* ── Attractions cell ────────────────────────────── */}
                    <AttractionCell
                      dayIndex={index}
                      day={day}
                      processedDay={processedData[index]}
                      itineraryId={itineraryId}
                      cityAnchor={getCityAnchor(day.location, day.overnight)}
                      prevCityAnchor={
                        index > 0 && day.overnightRowSpan > 0
                          ? getCityAnchor(processedData[index - 1].location, processedData[index - 1].overnight)
                          : undefined
                      }
                    />

                    {/* ── Train Schedule cell ────────────────────────── */}
                    <td className="px-6 py-4 border-b border-r border-gray-200 align-middle text-sm text-gray-600 group-last:border-b-0 group/train-cell">
                      <TrainScheduleDisplay
                        dayIndex={index}
                        train={trainOverrides[index] ?? day.train}
                        trainSchedules={trainSchedules}
                        schedulesLoading={schedulesLoading}
                        onEdit={(triggerButton) => trainEditor.open(index, day.train, triggerButton)}
                      />
                    </td>

                    {/* ── Note cell ───────────────────────────────────── */}
                    <td
                      data-testid={`note-cell-${index}`}
                      className="px-4 py-3 border-b border-gray-200 align-middle group-last:border-b-0 min-w-[180px] max-w-[280px] group/note-cell"
                    >
                      {noteEditor.editingNoteIndex === index ? (
                        <textarea
                          autoFocus
                          value={noteEditor.noteEditingValue}
                          onChange={(e) => noteEditor.setNoteEditingValue(e.target.value)}
                          onBlur={() => noteEditor.handleNoteBlur(index)}
                          onKeyDown={(e) => noteEditor.handleNoteKeyDown(e, index)}
                          rows={4}
                          className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const noteValue = noteEditor.noteOverrides[index] ?? day.note ?? ''
                            return noteValue ? (
                              <div className="flex-1 text-sm text-gray-700">{renderMarkdown(noteValue)}</div>
                            ) : null
                          })()}
                          <button
                            type="button"
                            aria-label="Edit note"
                            onClick={() => noteEditor.handleNoteEdit(index, noteEditor.noteOverrides[index] ?? day.note ?? '')}
                            className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/note-cell:opacity-100"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>{/* end bg-white table box */}
        </div>{/* end relative ml-10 tableWrapperRef */}
      </div>

      {/* Train editor modal */}
      <TrainScheduleEditorModal editor={trainEditor} processedData={processedData} />

      {/* Export format picker portal */}
      {typeof document !== 'undefined' && exportState.floatingPickerOpen && exportState.pickerAnchorRect && createPortal(
        <div
          className="fixed z-[45]"
          style={{
            top: `${exportState.pickerAnchorRect.top}px`,
            right: `${window.innerWidth - exportState.pickerAnchorRect.left + 8}px`,
          }}
        >
          <ExportFormatPicker
            onExportMarkdown={exportState.handleExportMarkdown}
            onExportPdf={exportState.handleExportPdf}
            onClose={exportState.closeFloatingPicker}
            exportError={exportState.exportError}
            isPdfGenerating={exportState.isPdfGenerating}
          />
        </div>,
        document.body
      )}

      {/* Export success toast */}
      {exportState.exportSuccess && (
        <ExportSuccessToast
          message="Itinerary exported!"
          onDismiss={() => exportState.setExportSuccess(false)}
          autoDismissMs={3000}
        />
      )}

      {/* Stay edit error toast */}
      {stayEdit.stayEditError && (
        <div
          data-testid="stay-edit-error-toast"
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-red-200
                     bg-white px-4 py-3 shadow-lg text-sm text-gray-800"
        >
          <span className="text-red-500">⚠</span>
          <span>{stayEdit.stayEditError}</span>
          <button
            aria-label="Dismiss error"
            className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={() => stayEdit.setStayEditError(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Inline sub-components ──────────────────────────────────────────────────

interface OvernightCellProps {
  day: ProcessedDay
  stay: ReturnType<typeof getStaysWithMeta>[number] | undefined
  isItineraryScopedStayEdit: boolean
  stayEditSaving: boolean
  stays: ReturnType<typeof getStaysWithMeta>
  onStayConfirm: (stayIndex: number, newNights: number) => void
  onStayCancel: () => void
}

function OvernightCell({
  day,
  stay,
  isItineraryScopedStayEdit,
  stayEditSaving,
  stays,
  onStayConfirm,
  onStayCancel,
}: OvernightCellProps) {
  const cityName = day.location?.kind === 'resolved' ? day.location.place.name : day.overnight
  const countryName = day.location?.kind === 'resolved'
    ? (day.location.place.country ?? day.location.place.countryCode ?? null)
    : null

  const countryTag = countryName ? (
    <span
      className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-gray-600 border border-gray-300/60"
      style={{ backgroundColor: getCountryColor(countryName) }}
    >
      {countryName}
    </span>
  ) : null

  return (
    <td
      rowSpan={day.overnightRowSpan}
      className="relative px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
      style={{ backgroundColor: getCityColor(
        day.location?.kind === 'resolved' ? day.location.place.name : day.overnight,
        day.location?.kind === 'resolved' ? (day.location.place.country ?? '') : ''
      ) }}
    >
      {!isItineraryScopedStayEdit && stay && !stay.isLast ? (
        <div className="space-y-1">
          <StayEditControl
            stayIndex={stay.stayIndex}
            city={cityName}
            currentNights={stay.nights}
            maxAdditionalNights={(stays[stay.stayIndex + 1]?.nights ?? 1) - 1}
            isLast={false}
            isSaving={stayEditSaving}
            onConfirm={onStayConfirm}
            onCancel={onStayCancel}
          />
          {countryTag}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <span>{cityName}</span>
          {countryTag}
        </div>
      )}
    </td>
  )
}

interface StayActionPanelProps {
  isActive: boolean
  top: number
  height: number
  color: string
  stay: ReturnType<typeof getStaysWithMeta>[number]
  day: ProcessedDay
  onRequestEditStay?: (stayIndex: number) => void
  onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
  onActivate?: () => void
}

function StayActionPanel({ isActive, top, height, color, stay, day, onRequestEditStay, onMoveStay, onActivate }: StayActionPanelProps) {
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [cloudOpen, setCloudOpen] = useState(false)

  // Remember last active position so it stays in place during fade-out animation
  const lastPosRef = useRef({ top, height, color })
  if (isActive) {
    lastPosRef.current = { top, height, color }
  }
  const displayTop = isActive ? top : lastPosRef.current.top
  const displayHeight = isActive ? height : lastPosRef.current.height
  const displayColor = isActive ? color : lastPosRef.current.color

  const cityName = day.location?.kind === 'resolved' ? day.location.place.name : day.overnight
  const coords = day.location && day.location.kind !== 'custom'
    ? (day.location as { coordinates: { lat: number; lng: number } }).coordinates
    : null

  const btnClass = 'inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

  return (
    <>
      <div
        style={{ top: displayTop, height: displayHeight, left: 2, width: 36 }}
        className={`absolute z-20 flex flex-col items-center transition-opacity duration-200 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onFocus={onActivate}
      >
        {/* Line above buttons */}
        <div className="w-1 flex-1 min-h-2 rounded-full" style={{ backgroundColor: displayColor }} />
        {/* Buttons */}
        <div className="flex flex-col gap-0.5 py-3">
          <button
            type="button"
            className={btnClass}
            onClick={() => onRequestEditStay?.(stay.stayIndex)}
            aria-label={`Edit stay for ${stay.overnight}`}
            title={`Edit stay for ${stay.overnight}`}
          >
            <Pencil size={12} aria-hidden="true" />
          </button>
          {onMoveStay && stay.stayIndex > 0 && (
            <button
              type="button"
              className={btnClass}
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
              className={btnClass}
              onClick={() => onMoveStay(stay.stayIndex, 'down')}
              aria-label={`Move ${stay.overnight} down`}
              title={`Move ${stay.overnight} down`}
            >
              ▼
            </button>
          )}
          <button
            type="button"
            className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={coords ? () => setWeatherOpen(true) : undefined}
            disabled={!coords}
            aria-label={`Weather forecast for ${cityName}`}
            title={coords ? `Weather forecast for ${cityName}` : 'No coordinates available'}
          >
            <Sun size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={coords ? () => setCloudOpen(true) : undefined}
            disabled={!coords}
            aria-label={`Cloud forecast for ${cityName}`}
            title={coords ? `Cloud forecast for ${cityName}` : 'No coordinates available'}
          >
            <Cloud size={12} aria-hidden="true" />
          </button>
        </div>
        {/* Line below buttons */}
        <div className="w-1 flex-1 min-h-2 rounded-full" style={{ backgroundColor: displayColor }} />
      </div>
      {weatherOpen && coords && typeof document !== 'undefined' && createPortal(
        <WeatherForecastModal
          cityName={cityName}
          lat={coords.lat}
          lng={coords.lng}
          onClose={() => setWeatherOpen(false)}
        />,
        document.body
      )}
      {cloudOpen && coords && typeof document !== 'undefined' && createPortal(
        <CloudForecastModal
          cityName={cityName}
          lat={coords.lat}
          lng={coords.lng}
          onClose={() => setCloudOpen(false)}
        />,
        document.body
      )}
    </>
  )
}

interface TrainScheduleDisplayProps {
  dayIndex: number
  train: RouteDay['train']
  trainSchedules: Record<string, { fromStation: string; depTime: string; toStation: string; arrTime: string } | null>
  schedulesLoading: boolean
  onEdit: (triggerButton: HTMLButtonElement) => void
}

function TrainScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 pl-1"
    >
      <div className="h-4 rounded bg-gray-200 animate-pulse w-28" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-8" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-20" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-8" />
    </div>
  )
}

function TrainScheduleDisplay({ dayIndex, train, trainSchedules, schedulesLoading, onEdit }: TrainScheduleDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      {train && train.length > 0 ? (
        <div className="flex-1 space-y-2">
          {train.map((item, i) => {
            const trainId = normalizeTrainId(item.train_id)
            const isDbTrain = !!(item.start && item.end)
            const scheduleKey = isDbTrain ? buildScheduleKey(trainId, item.start, item.end) : null
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
                    <span data-testid="invalid-train-dash" className="text-gray-400 italic">—</span>
                    <span data-testid="invalid-train-comment" className="text-xs text-gray-400 italic">({trainId})</span>
                  </>
                )}

                {isLoading ? (
                  <TrainScheduleSkeleton />
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
      ) : null}
      <button
        data-testid={`train-json-edit-btn-${dayIndex}`}
        onClick={(e) => onEdit(e.currentTarget)}
        className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/train-cell:opacity-100"
        aria-label="Edit train schedule"
      >
        <Pencil size={14} />
      </button>
    </div>
  )
}
