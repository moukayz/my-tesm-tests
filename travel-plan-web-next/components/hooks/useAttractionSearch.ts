'use client'

import { useState, useRef, useEffect } from 'react'
import { searchLocationSuggestions } from '../../app/lib/locations/search'
import type { StayLocationResolved } from '../../app/lib/itinerary-store/types'
import type { DayAttraction } from '../../app/lib/itinerary'

interface UseAttractionSearchProps {
  existingAttractionIds: string[]
  countryBias?: string
  onSelect: (attraction: DayAttraction) => void
}

export function useAttractionSearch({ existingAttractionIds, countryBias, onSelect }: UseAttractionSearchProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StayLocationResolved[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

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
    if (existingAttractionIds.includes(attraction.id)) {
      closeSearch()
      return
    }
    onSelect(attraction)
    closeSearch()
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

  return {
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
  }
}
