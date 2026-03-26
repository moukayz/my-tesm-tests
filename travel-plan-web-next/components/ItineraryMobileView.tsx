'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Sun, Cloud, Train, StickyNote, MapPin } from 'lucide-react'
import {
  getCityColor,
  getCountryColor,
  type RouteDay,
  type ProcessedDay,
} from '../app/lib/itinerary'
import type { StayWithMeta } from '../app/lib/stayUtils'
import { renderMarkdown } from '../app/lib/markdown'
import { DAY_COLORS } from '../app/lib/dayColors'
import AttractionCell from './AttractionCell'
import TrainScheduleDisplay, { type ScheduleEntry } from './TrainScheduleDisplay'
import WeatherForecastModal from './WeatherForecastModal'
import CloudForecastModal from './CloudForecastModal'
import type { useNoteEditor } from '../app/lib/hooks/useNoteEditor'
import type { useTrainEditor } from '../app/lib/hooks/useTrainEditor'
import type { StayLocation } from '../app/lib/itinerary-store/types'

interface ItineraryMobileViewProps {
  processedData: ProcessedDay[]
  stays: StayWithMeta[]
  days: RouteDay[]
  itineraryId?: string
  trainOverrides: Record<number, RouteDay['train']>
  trainSchedules: Record<string, ScheduleEntry | null>
  schedulesLoading: boolean
  noteEditor: ReturnType<typeof useNoteEditor>
  trainEditor: ReturnType<typeof useTrainEditor>
  isItineraryScopedStayEdit: boolean
  onRequestEditStay?: (stayIndex: number) => void
  onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
}

function getCityAnchor(location: StayLocation | undefined, fallback: string) {
  if (!location || location.kind === 'custom') return undefined
  const label = location.kind === 'resolved' ? location.place.name : fallback
  return { label, lat: location.coordinates.lat, lng: location.coordinates.lng }
}

export default function ItineraryMobileView({
  processedData,
  stays,
  days,
  itineraryId,
  trainOverrides,
  trainSchedules,
  schedulesLoading,
  noteEditor,
  trainEditor,
  isItineraryScopedStayEdit,
  onRequestEditStay,
  onMoveStay,
}: ItineraryMobileViewProps) {
  const [modalState, setModalState] = useState<Record<number, { weather: boolean; cloud: boolean }>>({})

  const btnClass = 'inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div data-testid="itinerary-mobile-view" className="space-y-3 pb-8">
      {stays.map((stay) => {
        const stayDay = processedData[stay.firstDayIndex]
        if (!stayDay) return null

        const cityName = stayDay.location?.kind === 'resolved'
          ? stayDay.location.place.name
          : stayDay.overnight
        const countryName = stayDay.location?.kind === 'resolved'
          ? (stayDay.location.place.country ?? null)
          : null
        const coords = stayDay.location?.kind === 'resolved'
          ? stayDay.location.coordinates
          : null
        const bgColor = getCityColor(
          stayDay.location?.kind === 'resolved' ? stayDay.location.place.name : stayDay.overnight,
          stayDay.location?.kind === 'resolved' ? (stayDay.location.place.country ?? '') : ''
        )
        const ms = modalState[stay.stayIndex]

        return (
          <section
            key={stay.stayIndex}
            data-testid={`stay-section-${stay.stayIndex}`}
            className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
          >
            {/* City header */}
            <div
              className="flex items-center gap-2 px-4 py-3 flex-wrap"
              style={{ backgroundColor: bgColor }}
            >
              {/* City name */}
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 truncate">{cityName}</span>
                {countryName && (
                  <span
                    className="shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium text-gray-600 border border-gray-300/60"
                    style={{ backgroundColor: getCountryColor(countryName) }}
                  >
                    {countryName}
                  </span>
                )}
                <span className="shrink-0 text-xs text-gray-500">{stay.nights} nights</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {isItineraryScopedStayEdit && (
                  <>
                    <button
                      type="button"
                      className={btnClass}
                      onClick={() => onRequestEditStay?.(stay.stayIndex)}
                      aria-label={`Edit stay for ${cityName}`}
                      title={`Edit stay for ${cityName}`}
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    {stay.stayIndex > 0 && (
                      <button
                        type="button"
                        className={btnClass}
                        onClick={() => onMoveStay?.(stay.stayIndex, 'up')}
                        aria-label={`Move ${cityName} up`}
                        title={`Move ${cityName} up`}
                      >
                        ▲
                      </button>
                    )}
                    {!stay.isLast && (
                      <button
                        type="button"
                        className={btnClass}
                        onClick={() => onMoveStay?.(stay.stayIndex, 'down')}
                        aria-label={`Move ${cityName} down`}
                        title={`Move ${cityName} down`}
                      >
                        ▼
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className={btnClass}
                  disabled={!coords}
                  onClick={coords ? () => setModalState((s) => ({ ...s, [stay.stayIndex]: { weather: true, cloud: s[stay.stayIndex]?.cloud ?? false } })) : undefined}
                  aria-label={`Weather forecast for ${cityName}`}
                  title={coords ? `Weather forecast for ${cityName}` : 'No coordinates available'}
                >
                  <Sun size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={btnClass}
                  disabled={!coords}
                  onClick={coords ? () => setModalState((s) => ({ ...s, [stay.stayIndex]: { weather: s[stay.stayIndex]?.weather ?? false, cloud: true } })) : undefined}
                  aria-label={`Cloud forecast for ${cityName}`}
                  title={coords ? `Cloud forecast for ${cityName}` : 'No coordinates available'}
                >
                  <Cloud size={13} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Day cards */}
            {Array.from({ length: stay.nights }, (_, i) => {
              const dayIndex = stay.firstDayIndex + i
              const day = processedData[dayIndex]
              const rawDay = days[dayIndex]
              if (!day || !rawDay) return null

              const dayNum = typeof day.dayNum === 'number' && Number.isFinite(day.dayNum) ? day.dayNum : dayIndex + 1
              const dayColor = DAY_COLORS[(dayNum - 1) % DAY_COLORS.length]
              const noteValue = noteEditor.noteOverrides[dayIndex] ?? rawDay.note ?? ''

              return (
                <div
                  key={dayIndex}
                  data-testid={`day-card-${dayIndex}`}
                  className="border-t border-gray-200 px-4 py-3 space-y-2 bg-white"
                >
                  {/* Date row */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-semibold border ${dayColor.bg} ${dayColor.text} ${dayColor.border}`}
                    >
                      {dayNum}
                    </span>
                    <span data-testid="itinerary-date" className="text-gray-600 text-sm">{day.date}</span>
                    <span className="text-sm text-gray-400">{day.weekDay}</span>
                  </div>

                  {/* Attractions */}
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
                    <MapPin size={14} className="shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <AttractionCell
                        variant="card"
                        dayIndex={dayIndex}
                        day={rawDay}
                        processedDay={day}
                        itineraryId={itineraryId}
                        cityAnchor={getCityAnchor(day.location, day.overnight)}
                        prevCityAnchor={
                          dayIndex > 0 && day.overnightRowSpan > 0
                            ? getCityAnchor(processedData[dayIndex - 1]?.location, processedData[dayIndex - 1]?.overnight ?? '')
                            : undefined
                        }
                      />
                    </div>
                  </div>

                  {/* Train schedule */}
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
                    <Train size={14} className="shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <TrainScheduleDisplay
                        dayIndex={dayIndex}
                        train={trainOverrides[dayIndex] ?? day.train}
                        trainSchedules={trainSchedules}
                        schedulesLoading={schedulesLoading}
                        onEdit={(triggerButton) => trainEditor.open(dayIndex, day.train, triggerButton)}
                        alwaysShowEdit
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
                    <StickyNote size={14} className="shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      {noteEditor.editingNoteIndex === dayIndex ? (
                        <textarea
                          autoFocus
                          value={noteEditor.noteEditingValue}
                          onChange={(e) => noteEditor.setNoteEditingValue(e.target.value)}
                          onBlur={() => noteEditor.handleNoteBlur(dayIndex)}
                          onKeyDown={(e) => noteEditor.handleNoteKeyDown(e, dayIndex)}
                          rows={4}
                          className="w-full px-1 py-0.5 border border-blue-400 rounded text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 text-sm text-gray-700">
                            {noteValue ? renderMarkdown(noteValue) : <span className="text-gray-300 text-xs">No note</span>}
                          </div>
                          <button
                            type="button"
                            aria-label="Edit note"
                            onClick={() => noteEditor.handleNoteEdit(dayIndex, noteValue)}
                            className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      {/* Weather/Cloud modals — portals per stay */}
      {typeof document !== 'undefined' && stays.map((stay) => {
        const stayDay = processedData[stay.firstDayIndex]
        if (!stayDay) return null
        const cityName = stayDay.location?.kind === 'resolved'
          ? stayDay.location.place.name
          : stayDay.overnight
        const coords = stayDay.location?.kind === 'resolved'
          ? stayDay.location.coordinates
          : null
        const ms = modalState[stay.stayIndex]
        return (
          <React.Fragment key={stay.stayIndex}>
            {ms?.weather && coords && createPortal(
              <WeatherForecastModal
                cityName={cityName}
                lat={coords.lat}
                lng={coords.lng}
                onClose={() => setModalState((s) => ({ ...s, [stay.stayIndex]: { ...s[stay.stayIndex], weather: false } }))}
              />,
              document.body
            )}
            {ms?.cloud && coords && createPortal(
              <CloudForecastModal
                cityName={cityName}
                lat={coords.lat}
                lng={coords.lng}
                onClose={() => setModalState((s) => ({ ...s, [stay.stayIndex]: { ...s[stay.stayIndex], cloud: false } }))}
              />,
              document.body
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
