'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import ItineraryTab from './ItineraryTab'
import TrainDelayTab from './TrainDelayTab'
import TrainTimetableTab from './TrainTimetableTab'
import type { RouteDay } from '../app/lib/itinerary'
import type {
  CreateItineraryResponse,
  ItinerarySummary,
  ItineraryWorkspace as ItineraryWorkspaceType,
} from '../app/lib/itinerary-store/types'
import CreateItineraryModal from './CreateItineraryModal'
import ItineraryPanel from './ItineraryPanel'
import type { StarterRouteCard } from './ItineraryCardsView'

type Tab = 'itinerary' | 'itinerary-test' | 'delays' | 'timetable'

interface TravelPlanProps {
  isLoggedIn?: boolean
  initialRouteData?: RouteDay[]
  initialItineraryWorkspace?: ItineraryWorkspaceType | null
  initialItinerarySummaries?: ItinerarySummary[]
  initialItineraryId?: string
  initialItineraryErrorCode?: string | null
}

type ItineraryDetailTarget =
  | { kind: 'itinerary'; itineraryId: string }
  | { kind: 'legacy'; legacyTabKey: 'route' }
  | null

function countStays(days: RouteDay[]): number {
  if (days.length === 0) return 0
  let count = 1
  for (let index = 1; index < days.length; index += 1) {
    if (days[index].overnight !== days[index - 1].overnight) count += 1
  }
  return count
}

function buildStarterRouteCard(days?: RouteDay[]): StarterRouteCard | null {
  if (!days || days.length === 0) return null
  return {
    legacyTabKey: 'route',
    name: 'Original seeded route',
    startDate: days[0].date,
    dayCount: days.length,
    stayCount: countStays(days),
  }
}

export default function TravelPlan({
  isLoggedIn = false,
  initialRouteData,
  initialItineraryWorkspace,
  initialItinerarySummaries = [],
  initialItineraryId,
  initialItineraryErrorCode,
}: TravelPlanProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const allTabs: { id: Tab; label: string }[] = [
    { id: 'itinerary', label: 'Itinerary' },
    { id: 'itinerary-test', label: 'Itinerary (Test)' },
    { id: 'delays', label: 'Train Delays' },
    { id: 'timetable', label: 'Timetable' },
  ]

  const tabs = isLoggedIn
    ? allTabs
    : allTabs.filter((t) => t.id !== 'itinerary' && t.id !== 'itinerary-test')
  const defaultTab: Tab = isLoggedIn ? 'itinerary' : 'delays'

  const currentTab = (searchParams.get('tab') as Tab | null) ?? defaultTab
  const tab = tabs.some((t) => t.id === currentTab) ? currentTab : defaultTab
  const urlItineraryId = searchParams.get('itineraryId') ?? undefined
  const urlLegacyTabKey = searchParams.get('legacyTabKey') === 'route' ? 'route' : undefined

  const [selectedItineraryId, setSelectedItineraryId] = useState<string | undefined>(urlItineraryId ?? initialItineraryId)
  const [selectedLegacyTabKey, setSelectedLegacyTabKey] = useState<'route' | undefined>(
    !urlItineraryId && urlLegacyTabKey ? 'route' : undefined
  )
  const [displayTab, setDisplayTab] = useState<Tab>(tab)
  const [itinerarySummaries, setItinerarySummaries] = useState<ItinerarySummary[]>(initialItinerarySummaries)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [hasUnsavedInlineEdits, setHasUnsavedInlineEdits] = useState(false)

  const starterRouteCard = useMemo(() => buildStarterRouteCard(initialRouteData), [initialRouteData])

  const selectedDetailTarget: ItineraryDetailTarget = selectedItineraryId
    ? { kind: 'itinerary', itineraryId: selectedItineraryId }
    : selectedLegacyTabKey
      ? { kind: 'legacy', legacyTabKey: selectedLegacyTabKey }
      : null

  useEffect(() => {
    setDisplayTab(tab)
  }, [tab])

  useEffect(() => {
    const nextItineraryId = urlItineraryId ?? initialItineraryId
    setSelectedItineraryId((current) => (current === nextItineraryId ? current : nextItineraryId))
    const nextLegacyTabKey = nextItineraryId ? undefined : urlLegacyTabKey
    setSelectedLegacyTabKey((current) => (current === nextLegacyTabKey ? current : nextLegacyTabKey))
  }, [initialItineraryId, urlItineraryId, urlLegacyTabKey])

  useEffect(() => {
    if (tab !== 'itinerary') return

    if (selectedItineraryId && urlItineraryId !== selectedItineraryId) {
      setSearchParams('itinerary', { kind: 'itinerary', itineraryId: selectedItineraryId }, true)
      return
    }

    if (!selectedItineraryId && selectedLegacyTabKey === 'route' && urlLegacyTabKey !== 'route') {
      setSearchParams('itinerary', { kind: 'legacy', legacyTabKey: 'route' }, true)
      return
    }

    if (!selectedItineraryId && !selectedLegacyTabKey && (urlItineraryId || urlLegacyTabKey)) {
      setSearchParams('itinerary', null, true)
    }
  }, [selectedItineraryId, selectedLegacyTabKey, tab, urlItineraryId, urlLegacyTabKey])

  useEffect(() => {
    setItinerarySummaries(initialItinerarySummaries)
  }, [initialItinerarySummaries])

  useEffect(() => {
    if (!isLoggedIn) return
    if (initialItinerarySummaries.length > 0) return

    let isActive = true

    fetch('/api/itineraries')
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { items?: ItinerarySummary[] }
        if (!isActive || !Array.isArray(body.items)) return
        setItinerarySummaries(body.items)
      })
      .catch(() => {
        // Keep starter route cards usable even if summaries fail to load.
      })

    return () => {
      isActive = false
    }
  }, [initialItinerarySummaries.length, isLoggedIn])

  const setSearchParams = (nextTab: Tab, detailTarget: ItineraryDetailTarget, replace = false) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)

    params.delete('itineraryId')
    params.delete('legacyTabKey')

    if (detailTarget?.kind === 'itinerary') params.set('itineraryId', detailTarget.itineraryId)
    if (detailTarget?.kind === 'legacy') params.set('legacyTabKey', detailTarget.legacyTabKey)

    const nextUrl = `${pathname}?${params.toString()}`

    if (typeof window === 'undefined') return

    if (replace) {
      window.history.replaceState(window.history.state, '', nextUrl)
    } else {
      window.history.pushState(window.history.state, '', nextUrl)
    }
  }

  const canOpenCreate = useMemo(
    () => isLoggedIn && displayTab === 'itinerary',
    [displayTab, isLoggedIn]
  )

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Travel Plan Itinerary</h1>
        <p className="text-gray-500 text-lg">A detailed view of your upcoming trip</p>
      </div>

      <div className="flex gap-2 mb-6 border-b-2 border-gray-200 w-full">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              if (hasUnsavedInlineEdits && id !== displayTab) return
              setDisplayTab(id)
              setSearchParams(id, selectedDetailTarget)
            }}
            className={`px-5 py-2.5 border-0 bg-transparent cursor-pointer text-sm font-medium border-b-2 -mb-0.5 transition-colors ${
              displayTab === id
                ? 'text-blue-500 border-b-blue-500'
                : 'text-gray-500 border-b-transparent hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
        {canOpenCreate && (
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedInlineEdits) return
              setIsCreateModalOpen(true)
            }}
            className="ml-auto mb-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={hasUnsavedInlineEdits}
          >
            New itinerary
          </button>
        )}
      </div>

      {isLoggedIn && (
        <div className={displayTab === 'itinerary' ? 'w-full' : 'hidden'}>
          <ItineraryPanel
            selectedItineraryId={selectedItineraryId}
            selectedLegacyTabKey={selectedLegacyTabKey}
            itinerarySummaries={itinerarySummaries}
            starterRouteCard={starterRouteCard}
            initialRouteData={initialRouteData}
            initialWorkspace={initialItineraryWorkspace}
            initialErrorCode={initialItineraryErrorCode}
            onDirtyStateChange={setHasUnsavedInlineEdits}
            onBackToCards={() => {
              setSelectedItineraryId(undefined)
              setSelectedLegacyTabKey(undefined)
              setSearchParams('itinerary', null)
            }}
            onSelectItinerary={(itineraryId) => {
              setSelectedItineraryId(itineraryId)
              setSelectedLegacyTabKey(undefined)
              setSearchParams('itinerary', { kind: 'itinerary', itineraryId })
            }}
            onSelectStarterRoute={(legacyTabKey) => {
              setSelectedItineraryId(undefined)
              setSelectedLegacyTabKey(legacyTabKey)
              setSearchParams('itinerary', { kind: 'legacy', legacyTabKey })
            }}
            onRequestCreateItinerary={() => {
              if (hasUnsavedInlineEdits) return
              setIsCreateModalOpen(true)
            }}
          />
        </div>
      )}
      {isLoggedIn && initialRouteData && (
        <div className={displayTab === 'itinerary-test' ? 'w-full' : 'hidden'}>
          <ItineraryTab initialData={initialRouteData} tabKey="route-test" />
        </div>
      )}
      <div className={displayTab === 'delays' ? 'w-full' : 'hidden'}>
        <TrainDelayTab />
      </div>
      <div className={displayTab === 'timetable' ? 'w-full' : 'hidden'}>
        <TrainTimetableTab />
      </div>

      <CreateItineraryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(response: CreateItineraryResponse) => {
          const nextId = response.itinerary.id
          setItinerarySummaries((current) => [
            response.itinerary,
            ...current.filter((item) => item.id !== response.itinerary.id),
          ])
          setSelectedItineraryId(nextId)
          setSelectedLegacyTabKey(undefined)
          setIsCreateModalOpen(false)
          setSearchParams('itinerary', { kind: 'itinerary', itineraryId: nextId }, true)
        }}
      />
    </div>
  )
}
