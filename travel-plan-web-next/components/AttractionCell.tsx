'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Map as MapIcon } from 'lucide-react'
import { searchLocationSuggestions } from '../app/lib/locations/search'
import type { StayLocationResolved } from '../app/lib/itinerary-store/types'
import type { RouteDay, DayAttraction } from '../app/lib/itinerary'
import AttractionMiniMap from './AttractionMiniMap'

const TAG_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
]

interface AttractionCellProps {
  dayIndex: number
  day: RouteDay
  processedDay: RouteDay
  itineraryId?: string
}

export default function AttractionCell({ dayIndex, day, processedDay, itineraryId }: AttractionCellProps) {
  const [overrides, setOverrides] = useState<DayAttraction[] | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StayLocationResolved[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [miniMapOpen, setMiniMapOpen] = useState(false)
  const [miniMapRect, setMiniMapRect] = useState<DOMRect | null>(null)
  const searchRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const miniMapButtonRef = useRef<HTMLButtonElement | null>(null)

  const attractions = overrides ?? (day.attractions ?? [])

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

  function openSearch() {
    setIsAdding(true)
    setQuery('')
    setResults([])
    setSearchOpen(false)
    setActiveIndex(0)
  }

  function closeSearch() {
    setIsAdding(false)
    setQuery('')
    setResults([])
    setSearchOpen(false)
    searchRef.current?.abort()
  }

  function selectAttraction(result: StayLocationResolved) {
    const attraction: DayAttraction = {
      id: result.place.placeId,
      label: result.place.name,
      coordinates: result.coordinates,
    }
    if (attractions.some((a) => a.id === attraction.id)) {
      closeSearch()
      return
    }
    const next = [...attractions, attraction]
    setOverrides(next)
    closeSearch()
    saveAttractions(next).catch(() => {})
  }

  function removeAttraction(attractionId: string) {
    const next = attractions.filter((a) => a.id !== attractionId)
    setOverrides(next)
    saveAttractions(next).catch(() => {})
  }

  function openMiniMap() {
    const rect = miniMapButtonRef.current?.getBoundingClientRect() ?? null
    setMiniMapRect(rect)
    setMiniMapOpen(true)
  }

  function closeMiniMap() {
    setMiniMapOpen(false)
    setMiniMapRect(null)
  }

  // Debounced search
  useEffect(() => {
    if (!isAdding) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearchLoading(false)
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    searchRef.current?.abort()
    const controller = new AbortController()
    searchRef.current = controller
    const timer = window.setTimeout(() => {
      const countryBias = processedDay?.location?.kind === 'resolved'
        ? processedDay.location?.place?.countryCode
        : undefined
      searchLocationSuggestions(query, { signal: controller.signal, limit: 6, placeTypes: [], countryBias })
        .then((res) => {
          setResults(res.results)
          setSearchOpen(res.results.length > 0)
          setActiveIndex(0)
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => { window.clearTimeout(timer) }
  }, [query, isAdding])

  // Close minimap on Escape
  useEffect(() => {
    if (!miniMapOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMiniMap()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [miniMapOpen])

  return (
    <td className="px-4 py-3 border-b border-gray-200 align-middle group-last:border-b-0 min-w-[200px] max-w-[300px] group/attraction-cell">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-1 items-start">
          {attractions.map((attraction, aIdx) => {
            const color = TAG_COLORS[aIdx % TAG_COLORS.length]
            return (
              <div key={attraction.id} className="group/tag relative inline-flex items-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}>
                  {attraction.label}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${attraction.label}`}
                  className="absolute left-full ml-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/tag:opacity-100 transition-opacity rounded-full hover:bg-black/10 p-0.5"
                  onClick={() => removeAttraction(attraction.id)}
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

        {(attractions.length > 0 || !isAdding) && (
          <div className="flex justify-start gap-2 opacity-0 group-hover/attraction-cell:opacity-100 transition-opacity">
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
        )}
      </div>

      {/* Attraction minimap popover — portal to document.body */}
      {typeof document !== 'undefined' && miniMapOpen && createPortal(
        <div
          className="absolute z-[46]"
          style={{
            top: `${(miniMapRect?.bottom ?? 0) + (typeof window !== 'undefined' ? window.scrollY : 0) + 8}px`,
            left: `${(miniMapRect?.left ?? 0) + (typeof window !== 'undefined' ? window.scrollX : 0)}px`,
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
                onClick={closeMiniMap}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
            <AttractionMiniMap attractions={attractions} />
          </div>
        </div>,
        document.body
      )}
    </td>
  )
}
