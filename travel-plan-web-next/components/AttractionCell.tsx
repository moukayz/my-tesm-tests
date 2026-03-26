'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Map as MapIcon, Image as ImageIcon } from 'lucide-react'
import type { RouteDay, DayAttraction } from '../app/lib/itinerary'
import AttractionMiniMap from './AttractionMiniMap'
import AttractionImageModal from './AttractionImageModal'
import AttractionImageViewer from './AttractionImageViewer'
import AttractionImageLightbox from './AttractionImageLightbox'
import { getAttractionColor } from '../app/lib/dayColors'
import { useAttractionSearch } from './hooks/useAttractionSearch'
import { useAttractionDrag } from './hooks/useAttractionDrag'

interface CityAnchorPoint {
  label: string
  lat: number
  lng: number
}

interface AttractionCellProps {
  dayIndex: number
  day: RouteDay
  processedDay: RouteDay
  itineraryId?: string
  cityAnchor?: CityAnchorPoint
  prevCityAnchor?: CityAnchorPoint
  variant?: 'table-cell' | 'card'
}

export default function AttractionCell({ dayIndex, day, processedDay, itineraryId, cityAnchor, prevCityAnchor, variant = 'table-cell' }: AttractionCellProps) {
  const [overrides, setOverrides] = useState<DayAttraction[] | null>(null)
  const [miniMapOpen, setMiniMapOpen] = useState(false)
  const [miniMapPos, setMiniMapPos] = useState<{ top: number; left: number } | null>(null)
  const [imageModalAttractionId, setImageModalAttractionId] = useState<string | null>(null)
  const [viewerState, setViewerState] = useState<{ id: string; rect: DOMRect } | null>(null)
  const [lightboxState, setLightboxState] = useState<{ attractionId: string; index: number } | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const miniMapButtonRef = useRef<HTMLButtonElement | null>(null)
  const hideViewerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const attractions = overrides ?? (day.attractions ?? [])

  const countryBias = processedDay?.location?.kind === 'resolved'
    ? processedDay.location?.place?.countryCode
    : undefined

  function scheduleHideViewer() {
    hideViewerTimer.current = setTimeout(() => setViewerState(null), 80)
  }
  function cancelHideViewer() {
    if (hideViewerTimer.current) { clearTimeout(hideViewerTimer.current); hideViewerTimer.current = null }
  }

  async function saveAttractions(next: DayAttraction[]) {
    if (itineraryId) {
      await fetch(`/api/itineraries/${itineraryId}/days/${dayIndex}/attractions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attractions: next }),
      })
    } else {
      await fetch('/api/attraction-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex, attractions: next }),
      })
    }
  }

  const {
    isAdding,
    query,
    results,
    searchLoading,
    searchOpen,
    activeIndex,
    inputRef,
    openSearch,
    closeSearch,
    setQuery,
    setActiveIndex,
    selectAttraction,
  } = useAttractionSearch({
    existingAttractionIds: attractions.map((a) => a.id),
    countryBias,
    onSelect: (attraction) => {
      const next = [...attractions, attraction]
      setOverrides(next)
      saveAttractions(next).catch(() => {})
    },
  })

  const {
    draggedId,
    isDraggingRef,
    setTagRef,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  } = useAttractionDrag({
    attractions,
    onReorder: (next) => setOverrides(next),
    onSave: (next) => saveAttractions(next).catch(() => {}),
    onDragStart: () => {
      cancelHideViewer()
      setViewerState(null)
    },
  })

  function removeAttraction(attractionId: string) {
    const next = attractions.filter((a) => a.id !== attractionId)
    setOverrides(next)
    saveAttractions(next).catch(() => {})
  }

  function handleImageDeleted(attractionId: string, imageIndex: number) {
    const next = attractions.map((a) =>
      a.id === attractionId
        ? { ...a, images: (a.images ?? []).filter((_, i) => i !== imageIndex) }
        : a
    )
    setOverrides(next)
    saveAttractions(next).catch(() => {})
  }

  function handleImagesUploaded(attractionId: string, newUrls: string[]) {
    const next = attractions.map((a) =>
      a.id === attractionId
        ? { ...a, images: [...(a.images ?? []), ...newUrls] }
        : a
    )
    setOverrides(next)
    setImageModalAttractionId(null)
    saveAttractions(next).catch(() => {})
  }

  function openMiniMap() {
    const rect = miniMapButtonRef.current?.getBoundingClientRect()
    if (rect) {
      setMiniMapPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      })
    }
    setMiniMapOpen(true)
  }

  function closeMiniMap() {
    setMiniMapOpen(false)
    setMiniMapPos(null)
  }

  // Close minimap on Escape
  useEffect(() => {
    if (!miniMapOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMiniMap()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [miniMapOpen])

  // Deselect tag when tapping outside
  const cellRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!selectedTagId) return
    function onPointerDown(e: PointerEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setSelectedTagId(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selectedTagId])

  const isCard = variant === 'card'
  const Outer = isCard ? 'div' : 'td'
  const outerClass = isCard
    ? 'py-2 group/attraction-cell relative'
    : 'px-4 py-6 border-b border-gray-200 align-middle group-last:border-b-0 min-w-[200px] max-w-[300px] group/attraction-cell relative'

  return (
    <Outer
      ref={cellRef as React.Ref<HTMLTableCellElement> & React.Ref<HTMLDivElement>}
      className={outerClass}
      {...(isCard ? { 'data-testid': 'attraction-card' } : {})}
    >
      <div className="flex flex-col gap-1">
        <div className="relative flex flex-col gap-1 items-start">
          {attractions.map((attraction) => {
            const color = getAttractionColor(attraction.id)
            const isDragged = draggedId === attraction.id
            const hasImages = (attraction.images?.length ?? 0) > 0
            const isSelected = isCard && selectedTagId === attraction.id
            return (
              <div
                key={attraction.id}
                ref={setTagRef(attraction.id)}
                className={`relative inline-flex items-center ${isDragged ? 'opacity-40' : ''} ${draggedId ? '' : 'group/tag'}`}
                draggable
                onDragStart={(e) => handleDragStart(e, attraction.id)}
                onDragOver={(e) => handleDragOver(e, attraction.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMouseEnter={(e) => {
                  if (isCard || isDraggingRef.current) return
                  if (hasImages) {
                    cancelHideViewer()
                    setViewerState({ id: attraction.id, rect: e.currentTarget.getBoundingClientRect() })
                  }
                }}
                onMouseLeave={() => { if (!isCard) scheduleHideViewer() }}
              >
                <span
                  aria-label="Drag to reorder"
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-grab active:cursor-grabbing ${color.bg} ${color.text} ${color.border}${isCard ? ' select-none' : ''}`}
                  {...(isCard ? { role: 'button', onClick: () => setSelectedTagId(isSelected ? null : attraction.id) } : {})}
                >
                  {attraction.label}
                </span>
                {/* Desktop: per-tag hover buttons */}
                {!isCard && (
                  <>
                    <button
                      type="button"
                      aria-label={`Add images for ${attraction.label}`}
                      className="ml-0.5 transition-opacity rounded-full hover:bg-black/10 p-0.5 opacity-0 group-hover/tag:opacity-100"
                      onClick={() => setImageModalAttractionId(attraction.id)}
                    >
                      <ImageIcon size={10} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${attraction.label}`}
                      className="ml-0.5 transition-opacity rounded-full hover:bg-black/10 p-0.5 opacity-0 group-hover/tag:opacity-100"
                      onClick={() => removeAttraction(attraction.id)}
                    >
                      <X size={10} aria-hidden="true" />
                    </button>
                  </>
                )}
                {/* Mobile: slide-in action buttons to the right of tag */}
                {isCard && (
                  <div
                    className={`inline-flex items-center overflow-hidden transition-all duration-200 ease-out ${isSelected ? 'max-w-[120px] opacity-100 ml-1' : 'max-w-0 opacity-0'}`}
                    data-testid={`tag-actions-${attraction.id}`}
                  >
                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                      <button
                        type="button"
                        aria-label={`View images for ${attraction.label}`}
                        disabled={!hasImages}
                        className={`inline-flex items-center gap-0.5 rounded-full p-1 ${hasImages ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
                        onClick={hasImages ? () => setLightboxState({ attractionId: attraction.id, index: 0 }) : undefined}
                      >
                        <ImageIcon size={12} aria-hidden="true" />
                        {hasImages && <span className="text-xs">{attraction.images!.length}</span>}
                      </button>
                      <button
                        type="button"
                        aria-label={`Add images for ${attraction.label}`}
                        className="rounded-full p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => setImageModalAttractionId(attraction.id)}
                      >
                        <Plus size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${attraction.label}`}
                        className="rounded-full p-1 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => { removeAttraction(attraction.id); setSelectedTagId(null) }}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Button row — absolute in table-cell (hover reveal), in-flow in card */}
          <div
            data-testid="attraction-buttons"
            className={isCard ? 'flex justify-start gap-2 pt-1' : 'absolute top-full left-0 flex justify-start gap-2 pt-1 transition-opacity opacity-0 group-hover/attraction-cell:opacity-100'}
          >
            {!isAdding && (
              <button
                type="button"
                aria-label={`Add attraction for day ${day.dayNum}`}
                title="Add attraction"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                onClick={openSearch}
              >
                <Plus size={10} aria-hidden="true" />
                Add
              </button>
            )}
            {attractions.length > 0 && (
              <button
                type="button"
                ref={miniMapButtonRef}
                aria-label={`Preview attractions map for day ${day.dayNum}`}
                title="Preview map"
                className="inline-flex items-center px-2 py-1 rounded-full text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                onClick={openMiniMap}
              >
                <MapIcon size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {isAdding && (
          <div className="relative w-full">
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Search attractions"
              aria-expanded={searchOpen}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { closeSearch(); return }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveIndex((i) => Math.min(i + 1, results.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveIndex((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter' && results[activeIndex]) {
                  e.preventDefault()
                  selectAttraction(results[activeIndex])
                }
              }}
              onBlur={() => { setTimeout(() => closeSearch(), 150) }}
              placeholder="Type to search…"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchLoading && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="h-3 w-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>
            )}
            {searchOpen && results.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-sm text-xs"
              >
                {results.map((result, rIdx) => (
                  <li
                    key={result.place.placeId}
                    role="option"
                    aria-selected={rIdx === activeIndex}
                    className={`cursor-pointer px-3 py-1.5 ${rIdx === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
                    onMouseDown={(e) => { e.preventDefault(); selectAttraction(result) }}
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
      </div>

      {/* Image viewer — portal so it escapes table stacking context */}
      {viewerState !== null && (() => {
        const a = attractions.find((x) => x.id === viewerState.id)
        if (!a || (a.images?.length ?? 0) === 0) return null
        return (
          <AttractionImageViewer
            images={a.images!}
            anchorRect={viewerState.rect}
            onDeleteImage={(idx) => handleImageDeleted(viewerState.id, idx)}
            onThumbnailClick={(idx) => setLightboxState({ attractionId: viewerState.id, index: idx })}
            onMouseEnter={cancelHideViewer}
            onMouseLeave={scheduleHideViewer}
          />
        )
      })()}

      {/* Image upload modal */}
      {imageModalAttractionId !== null && (() => {
        const attraction = attractions.find((a) => a.id === imageModalAttractionId)
        return attraction ? (
          <AttractionImageModal
            attractionLabel={attraction.label}
            onUploadComplete={(urls) => handleImagesUploaded(imageModalAttractionId, urls)}
            onClose={() => setImageModalAttractionId(null)}
          />
        ) : null
      })()}

      {/* Image lightbox — rendered independently so it outlives the viewer */}
      {lightboxState !== null && (() => {
        const a = attractions.find((x) => x.id === lightboxState.attractionId)
        return a?.images?.length ? (
          <AttractionImageLightbox
            images={a.images}
            initialIndex={lightboxState.index}
            onClose={() => setLightboxState(null)}
          />
        ) : null
      })()}

      {/* Attraction minimap modal — portal to document.body */}
      {typeof document !== 'undefined' && miniMapOpen && createPortal(
        <div
          data-testid="minimap-popover"
          className="fixed inset-0 z-[46] flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeMiniMap() }}
        >
          <div
            className="rounded-xl shadow-xl border border-gray-200 bg-white overflow-hidden w-full max-w-[632px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-600">Attractions map</span>
              <button
                type="button"
                aria-label="Close map"
                className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                onClick={closeMiniMap}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <AttractionMiniMap attractions={attractions} cityAnchor={cityAnchor} prevCityAnchor={prevCityAnchor} />
          </div>
        </div>,
        document.body
      )}
    </Outer>
  )
}
