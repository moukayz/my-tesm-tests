'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { ItineraryWorkspace as ItineraryWorkspaceType, StayLocation } from '../app/lib/itinerary-store/types'
import { applyMoveStay, deriveStays, regenerateDerivedDates } from '../app/lib/itinerary-store/domain'
import ItineraryTab from './ItineraryTab'
import ItineraryEmptyState from './ItineraryEmptyState'
import ItineraryRouteMap from './ItineraryRouteMap'
import StaySheet, { type StaySheetMode, type StaySheetSubmitInput } from './StaySheet'

interface ItineraryWorkspaceProps {
  selectedItineraryId?: string
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onDirtyStateChange?: (isDirty: boolean) => void
  onBackToCards?: () => void
}

function formatTripDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/).map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr
  const [year, month, day] = parts
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCountryFromLocation(location?: StayLocation): string | undefined {
  if (!location) return undefined
  if (location.kind === 'resolved') return location.place.country ?? location.place.countryCode
  if (location.kind === 'mapbox') return location.place.country ?? location.place.countryCode
  if (location.kind === 'geonames') return location.place.countryName ?? location.place.countryCode
  return undefined
}

function mapStayError(code: string): string {
  if (code === 'STAY_CITY_REQUIRED') return 'Please provide a city.'
  if (code === 'STAY_NIGHTS_MIN') return 'Nights must be at least 1.'
  if (code === 'STAY_TRAILING_DAYS_LOCKED') return 'Cannot shrink this stay because trailing days already contain plan or train details.'
  if (code === 'WORKSPACE_STALE') return 'Workspace changed in another session. Please retry.'
  return 'Could not save stay changes. Please retry.'
}

function mapWorkspaceError(code: string): string {
  if (code === 'ITINERARY_NOT_FOUND') return 'Selected itinerary was not found.'
  if (code === 'ITINERARY_FORBIDDEN') return 'You no longer have access to this itinerary.'
  return 'Could not load the selected itinerary.'
}

export default function ItineraryWorkspace({
  selectedItineraryId,
  initialWorkspace,
  initialErrorCode,
  onDirtyStateChange,
  onBackToCards,
}: ItineraryWorkspaceProps) {
  const [workspace, setWorkspace] = useState<ItineraryWorkspaceType | null>(initialWorkspace ?? null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(initialErrorCode ?? null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<StaySheetMode>('add-first')
  const [sheetStayIndex, setSheetStayIndex] = useState<number | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [isSheetSubmitting, setIsSheetSubmitting] = useState(false)

  useEffect(() => {
    setWorkspace(initialWorkspace ?? null)
    setWorkspaceError(initialErrorCode ?? null)
  }, [initialErrorCode, initialWorkspace])

  useEffect(() => {
    if (!selectedItineraryId) {
      setWorkspace(null)
      setWorkspaceError(null)
      return
    }
    if (workspace?.itinerary.id === selectedItineraryId) return

    let cancelled = false
    setIsLoading(true)
    setWorkspaceError(null)

    fetch(`/api/itineraries/${selectedItineraryId}`)
      .then(async (response) => {
        const body = (await response.json()) as { error?: string } & Partial<ItineraryWorkspaceType>
        if (!response.ok) {
          throw new Error(body.error ?? 'INTERNAL_ERROR')
        }
        if (cancelled) return
        setWorkspace(body as ItineraryWorkspaceType)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
        setWorkspace(null)
        setWorkspaceError(code)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedItineraryId])

  const selectedStay = useMemo(() => {
    if (!workspace || sheetStayIndex === null) return undefined
    return workspace.stays[sheetStayIndex]
  }, [sheetStayIndex, workspace])

  const tripSummary = useMemo(() => {
    if (!workspace || workspace.days.length === 0) return null
    const startDate = workspace.days[0].date
    const endDate = workspace.days.at(-1)!.date
    const totalDays = workspace.days.length
    const groupMap = new Map<string | null, { nights: number; cities: { city: string; nights: number }[] }>()
    for (const stay of workspace.stays) {
      const country = getCountryFromLocation(stay.location) ?? null
      if (!groupMap.has(country)) groupMap.set(country, { nights: 0, cities: [] })
      const g = groupMap.get(country)!
      g.nights += stay.nights
      g.cities.push({ city: stay.city, nights: stay.nights })
    }
    const countryGroups = Array.from(groupMap.entries()).map(([name, { nights, cities }]) => ({ name, nights, cities }))
    return { startDate, endDate, totalDays, countryGroups }
  }, [workspace])

  async function handleMoveStay(stayIndex: number, direction: 'up' | 'down'): Promise<void> {
    if (!workspace) return
    const snapshot = workspace

    // Optimistic update — reorder immediately for instant feedback
    try {
      const movedDays = applyMoveStay(workspace.days, stayIndex, direction)
      const regenerated = regenerateDerivedDates(workspace.itinerary.startDate, movedDays)
      setWorkspace({ ...workspace, days: regenerated, stays: deriveStays(regenerated) })
    } catch {
      return // boundary error (first/last stay) — buttons prevent this, ignore
    }

    try {
      const response = await fetch(`/api/itineraries/${workspace.itinerary.id}/stays/${stayIndex}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      if (!response.ok) {
        setWorkspace(snapshot)
        return
      }
      const body = await response.json()
      setWorkspace(body as ItineraryWorkspaceType)
    } catch {
      setWorkspace(snapshot)
    }
  }

  async function submitStay(input: StaySheetSubmitInput): Promise<void> {
    if (!workspace) return
    setSheetError(null)
    setIsSheetSubmitting(true)

    try {
      const endpoint =
        sheetMode === 'edit' && sheetStayIndex !== null
          ? `/api/itineraries/${workspace.itinerary.id}/stays/${sheetStayIndex}`
          : `/api/itineraries/${workspace.itinerary.id}/stays`

      const response = await fetch(endpoint, {
        method: sheetMode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = (await response.json()) as { error?: string } & Partial<ItineraryWorkspaceType>

      if (!response.ok) {
        setSheetError(mapStayError(body.error ?? 'INTERNAL_ERROR'))
        return
      }

      setWorkspace(body as ItineraryWorkspaceType)
      setIsSheetOpen(false)
      setSheetStayIndex(null)
      setSheetError(null)
    } catch {
      setSheetError('Could not save stay changes. Please retry.')
    } finally {
      setIsSheetSubmitting(false)
    }
  }

  if (!selectedItineraryId) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Create your first itinerary to start planning stays and daily activities.
      </section>
    )
  }

  if (workspaceError) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{mapWorkspaceError(workspaceError)}</p>
        <button
          type="button"
          className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
          onClick={() => onBackToCards?.()}
        >
          Back to all itineraries
        </button>
      </section>
    )
  }

  if (isLoading || !workspace) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Loading itinerary workspace...
      </section>
    )
  }

  const hasDays = workspace.days.length > 0

  function openAddNextStay() {
    setSheetMode('add-next')
    setSheetStayIndex(null)
    setSheetError(null)
    setIsSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          onClick={onBackToCards}
          aria-label="Back to all itineraries"
          title="Back to all itineraries"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
      </div>

      {hasDays && tripSummary && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-1">
          <h2 className="text-base font-semibold text-gray-900">{workspace.itinerary.name}</h2>
          <p className="text-sm text-gray-500">
            {formatTripDate(tripSummary.startDate)} – {formatTripDate(tripSummary.endDate)}
            <span className="mx-1.5 text-gray-300">·</span>
            {tripSummary.totalDays} {tripSummary.totalDays === 1 ? 'day' : 'days'}
          </p>
          <div className="space-y-0.5 text-sm">
            {tripSummary.countryGroups.map((group) => (
              <div key={group.name ?? '__none__'}>
                {group.name && (
                  <p className="text-gray-500">{group.name} ({group.nights}n)</p>
                )}
                {group.cities.map((c, i) => (
                  <p key={i} className={group.name ? 'pl-3 text-gray-400' : 'text-gray-500'}>
                    {c.city} ({c.nights}n)
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasDays && <ItineraryRouteMap stays={workspace.stays} />}

      {!hasDays ? (
        <ItineraryEmptyState
          itineraryName={workspace.itinerary.name}
          startDate={workspace.itinerary.startDate}
          onAddFirstStay={() => {
            setSheetMode('add-first')
            setSheetStayIndex(null)
            setSheetError(null)
            setIsSheetOpen(true)
          }}
        />
      ) : (
        <ItineraryTab
          initialData={workspace.days}
          itineraryId={workspace.itinerary.id}
          onRequestAddStay={openAddNextStay}
          onRequestEditStay={(stayIndex) => {
            setSheetMode('edit')
            setSheetStayIndex(stayIndex)
            setSheetError(null)
            setIsSheetOpen(true)
          }}
          onMoveStay={handleMoveStay}
          onDirtyStateChange={onDirtyStateChange}
        />
      )}

      <StaySheet
        isOpen={isSheetOpen}
        mode={sheetMode}
        initialCity={sheetMode === 'edit' ? selectedStay?.city : undefined}
        initialNights={sheetMode === 'edit' ? selectedStay?.nights : 1}
        initialLocation={sheetMode === 'edit' ? selectedStay?.location : undefined}
        contextCity={workspace.stays[workspace.stays.length - 1]?.city}
        formError={sheetError}
        isSubmitting={isSheetSubmitting}
        onClose={() => {
          if (isSheetSubmitting) return
          setIsSheetOpen(false)
        }}
        onSubmit={submitStay}
      />
    </div>
  )
}
