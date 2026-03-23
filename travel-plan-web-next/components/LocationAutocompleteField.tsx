'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { searchLocationSuggestions } from '../app/lib/locations/search'
import { buildCustomStayLocation } from '../app/lib/stayLocation'
import type { StayLocation, StayLocationResolved } from '../app/lib/itinerary-store/types'

interface LocationAutocompleteFieldProps {
  inputId?: string
  value: string
  selectedLocation: StayLocation
  disabled?: boolean
  onValueChange: (value: string) => void
  onSelectionChange: (location: StayLocation) => void
}

const LOOKUP_DEBOUNCE_MS = 300

function optionSuffix(option: StayLocation): string {
  if (option.kind === 'custom') return 'custom'
  if (option.kind === 'resolved') return option.place.placeId
  if (option.kind === 'mapbox') return option.place.mapboxId
  return String(option.place.geonameId)
}

function formatResolvedSecondaryText(option: StayLocationResolved): string | undefined {
  const parts = [option.place.locality, option.place.region, option.place.country].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
  if (parts.length === 0 && option.place.featureType) {
    return `Type: ${option.place.featureType}`
  }
  return parts.length > 0 ? parts.join(', ') : undefined
}

export default function LocationAutocompleteField({
  inputId,
  value,
  selectedLocation,
  disabled = false,
  onValueChange,
  onSelectionChange,
}: LocationAutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [results, setResults] = useState<StayLocationResolved[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const requestIdRef = useRef(0)
  const listboxId = useId()
  const statusId = useId()

  const trimmedValue = value.trim()

  const options = useMemo(() => {
    if (trimmedValue.length === 0) return []
    return [buildCustomStayLocation(value), ...results.slice(0, 5)]
  }, [results, trimmedValue.length, value])

  useEffect(() => {
    if (trimmedValue.length < 2) {
      setIsLoading(false)
      setLookupError(null)
      setResults([])
      return
    }

    setIsLoading(true)
    setLookupError(null)

    const nextRequestId = requestIdRef.current + 1
    requestIdRef.current = nextRequestId
    const controller = new AbortController()

    const timeoutId = window.setTimeout(() => {
      searchLocationSuggestions(value, { signal: controller.signal, limit: 5 })
        .then((searchResponse) => {
          if (requestIdRef.current !== nextRequestId) return
          setResults(searchResponse.results)
          if (searchResponse.degradedCode) {
            setLookupError('Place suggestions are unavailable right now. You can still save this location.')
          } else {
            setLookupError(null)
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestIdRef.current !== nextRequestId) return
          const code = error instanceof Error ? error.message : 'LOCATION_LOOKUP_UNAVAILABLE'
          if (code === 'LOCATION_QUERY_INVALID') {
            setLookupError(null)
          } else {
            setLookupError('Place suggestions are unavailable right now. You can still save this location.')
          }
          setResults([])
        })
        .finally(() => {
          if (requestIdRef.current === nextRequestId) {
            setIsLoading(false)
          }
        })
    }, LOOKUP_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [trimmedValue.length, value])

  function openDropdown() {
    setIsOpen(true)
    setActiveIndex(0)
  }

  function closeDropdown() {
    setIsOpen(false)
    setActiveIndex(0)
  }

  function applySelection(location: StayLocation) {
    onSelectionChange(location)
    onValueChange(location.label)
    closeDropdown()
  }

  const activeOption = isOpen ? options[activeIndex] : undefined

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">City</label>
      <div className="relative mt-1">
        <input
          id={inputId}
          name="city"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen && options.length > 0}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeOption
              ? `${listboxId}-${activeOption.kind}-${optionSuffix(activeOption)}`
              : undefined
          }
          value={value}
          disabled={disabled}
          onFocus={() => {
            if (trimmedValue.length > 0) openDropdown()
          }}
          onBlur={() => closeDropdown()}
          onChange={(event) => {
            const nextValue = event.target.value
            onValueChange(nextValue)

            if (selectedLocation.kind !== 'custom' && nextValue.trim() !== selectedLocation.label.trim()) {
              onSelectionChange(buildCustomStayLocation(nextValue))
            }

              if (nextValue.trim().length > 0) {
                openDropdown()
                return
              }
            closeDropdown()
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (!isOpen) {
                openDropdown()
                return
              }
              setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)))
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              if (!isOpen) {
                openDropdown()
                return
              }
              setActiveIndex((current) => Math.max(current - 1, 0))
              return
            }

            if (event.key === 'Escape') {
              closeDropdown()
              return
            }

            if (event.key === 'Enter') {
              const custom = buildCustomStayLocation(value)
              if (!isOpen) {
                onSelectionChange(custom)
                return
              }

              event.preventDefault()
              const nextSelection = options[activeIndex] ?? custom
              applySelection(nextSelection)
            }
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm pr-8"
        />
        {isLoading && (
          <span
            role="status"
            aria-label="Searching"
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center"
          >
            <svg
              className="h-4 w-4 animate-spin text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        )}
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        {isLoading ? 'Searching for places...' : lookupError}
      </p>

      {isOpen && options.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-sm"
        >
          {options.map((option, index) => {
            const optionId = `${listboxId}-${option.kind}-${optionSuffix(option)}`
            const isActive = index === activeIndex
            const secondaryText = option.kind === 'resolved' ? formatResolvedSecondaryText(option) : undefined

            return (
              <li
                key={optionId}
                id={optionId}
                role="option"
                aria-selected={isActive}
                onMouseDown={(event) => {
                  event.preventDefault()
                  applySelection(option)
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${isActive ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <p className="font-medium">
                  {option.kind === 'custom' ? `Use "${value}" as a custom location` : option.label}
                </p>
                {secondaryText && (
                  <p className="text-xs text-gray-500">{secondaryText}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
