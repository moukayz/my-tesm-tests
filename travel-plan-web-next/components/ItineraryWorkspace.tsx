'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ItineraryWorkspace as ItineraryWorkspaceType } from '../app/lib/itinerary-store/types'
import ItineraryTab from './ItineraryTab'
import ItineraryEmptyState from './ItineraryEmptyState'
import StaySheet, { type StaySheetMode, type StaySheetSubmitInput } from './StaySheet'

interface ItineraryWorkspaceProps {
  selectedItineraryId?: string
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onDirtyStateChange?: (isDirty: boolean) => void
  onBackToCards?: () => void
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

  return (
    <div className="space-y-4">
      {hasDays && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{workspace.itinerary.name}</h2>
            <p className="text-sm text-gray-500">Start date: {workspace.itinerary.startDate}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSheetMode('add-next')
              setSheetStayIndex(null)
              setSheetError(null)
              setIsSheetOpen(true)
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add next stay
          </button>
        </div>
      )}

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
          onRequestAddStay={() => {
            setSheetMode('add-next')
            setSheetStayIndex(null)
            setSheetError(null)
            setIsSheetOpen(true)
          }}
          onRequestEditStay={(stayIndex) => {
            setSheetMode('edit')
            setSheetStayIndex(stayIndex)
            setSheetError(null)
            setIsSheetOpen(true)
          }}
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
