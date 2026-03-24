'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus } from 'lucide-react'
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
import { DAY_COLORS } from '../app/lib/dayColors'

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
                  <tr key={index} className="group hover:bg-gray-50">
                    {/* ── Overnight cell ─────────────────────────────── */}
                    {day.overnightRowSpan > 0 && (
                      <OvernightCell
                        day={day}
                        stay={stay}
                        isItineraryScopedStayEdit={isItineraryScopedStayEdit}
                        stayEditSaving={stayEdit.stayEditSaving}
                        stays={stays}
                        onRequestEditStay={onRequestEditStay}
                        onMoveStay={onMoveStay}
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
        </div>
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
  onRequestEditStay?: (stayIndex: number) => void
  onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
  onStayConfirm: (stayIndex: number, newNights: number) => void
  onStayCancel: () => void
}

function OvernightCell({
  day,
  stay,
  isItineraryScopedStayEdit,
  stayEditSaving,
  stays,
  onRequestEditStay,
  onMoveStay,
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
      className="relative group px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
      style={{ backgroundColor: getCityColor(
        day.location?.kind === 'resolved' ? day.location.place.name : day.overnight,
        day.location?.kind === 'resolved' ? (day.location.place.country ?? '') : ''
      ) }}
    >
      {stay && isItineraryScopedStayEdit ? (
        <div className="relative inline-block">
          <div><span>{cityName}</span>{countryTag && <div>{countryTag}</div>}</div>
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
      ) : stay && !stay.isLast ? (
        <div className="space-y-2">
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
        <div className="space-y-2">
          <span>{cityName}</span>
          {countryTag}
        </div>
      )}
    </td>
  )
}

interface TrainScheduleDisplayProps {
  dayIndex: number
  train: RouteDay['train']
  trainSchedules: Record<string, { fromStation: string; depTime: string; toStation: string; arrTime: string } | null>
  schedulesLoading: boolean
  onEdit: (triggerButton: HTMLButtonElement) => void
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
