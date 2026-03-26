'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CalendarDays, AlertTriangle, Clock, CloudSun } from 'lucide-react'
import TrainDelayTab from './TrainDelayTab'
import TrainTimetableTab from './TrainTimetableTab'
import type {
  CreateItineraryResponse,
  ItinerarySummary,
  ItineraryWorkspace as ItineraryWorkspaceType,
} from '../app/lib/itinerary-store/types'
import CreateItineraryModal from './CreateItineraryModal'
import ItineraryPanel from './ItineraryPanel'
import ForecastTab from './ForecastTab'

type Tab = 'itinerary' | 'delays' | 'timetable' | 'forecast'

interface TravelPlanProps {
  isLoggedIn?: boolean
  initialItineraryWorkspace?: ItineraryWorkspaceType | null
  initialItinerarySummaries?: ItinerarySummary[]
  initialItineraryId?: string
  initialItineraryErrorCode?: string | null
}

export default function TravelPlan({
  isLoggedIn = false,
  initialItineraryWorkspace,
  initialItinerarySummaries = [],
  initialItineraryId,
  initialItineraryErrorCode,
}: TravelPlanProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const allTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'itinerary', label: 'Itinerary', icon: <CalendarDays size={18} aria-hidden="true" /> },
    { id: 'delays', label: 'Train Delays', icon: <AlertTriangle size={18} aria-hidden="true" /> },
    { id: 'timetable', label: 'Timetable', icon: <Clock size={18} aria-hidden="true" /> },
    { id: 'forecast', label: 'Forecast', icon: <CloudSun size={18} aria-hidden="true" /> },
  ]

  const tabs = isLoggedIn
    ? allTabs
    : allTabs.filter((t) => t.id !== 'itinerary')
  const defaultTab: Tab = isLoggedIn ? 'itinerary' : 'delays'

  const currentTab = (searchParams.get('tab') as Tab | null) ?? defaultTab
  const tab = tabs.some((t) => t.id === currentTab) ? currentTab : defaultTab
  const urlItineraryId = searchParams.get('itineraryId') ?? undefined

  const [selectedItineraryId, setSelectedItineraryId] = useState<string | undefined>(urlItineraryId ?? initialItineraryId)
  const [displayTab, setDisplayTab] = useState<Tab>(tab)
  const [itinerarySummaries, setItinerarySummaries] = useState<ItinerarySummary[]>(initialItinerarySummaries)
  const [isItinerariesLoading, setIsItinerariesLoading] = useState(isLoggedIn && initialItinerarySummaries.length === 0)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [hasUnsavedInlineEdits, setHasUnsavedInlineEdits] = useState(false)

  useEffect(() => {
    setDisplayTab(tab)
  }, [tab])

  useEffect(() => {
    const nextItineraryId = urlItineraryId ?? initialItineraryId
    setSelectedItineraryId((current) => (current === nextItineraryId ? current : nextItineraryId))
  }, [initialItineraryId, urlItineraryId])

  useEffect(() => {
    if (tab !== 'itinerary') return

    if (selectedItineraryId && urlItineraryId !== selectedItineraryId) {
      setSearchParams('itinerary', selectedItineraryId, true)
      return
    }

    if (!selectedItineraryId && urlItineraryId) {
      setSearchParams('itinerary', null, true)
    }
  }, [selectedItineraryId, tab, urlItineraryId])

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
      .catch(() => {})
      .finally(() => {
        if (isActive) setIsItinerariesLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [initialItinerarySummaries.length, isLoggedIn])

  const setSearchParams = (nextTab: Tab, itineraryId: string | null, replace = false) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    params.delete('itineraryId')
    if (itineraryId) params.set('itineraryId', itineraryId)

    const nextUrl = `${pathname}?${params.toString()}`

    if (typeof window === 'undefined') return

    if (replace) {
      window.history.replaceState(window.history.state, '', nextUrl)
    } else {
      window.history.pushState(window.history.state, '', nextUrl)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Travel Plan Itinerary</h1>
        <p className="text-gray-500 text-lg">A detailed view of your upcoming trip</p>
      </div>

      <div className="flex gap-1 sm:gap-2 mb-6 border-b-2 border-gray-200 w-full">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => {
              if (hasUnsavedInlineEdits && id !== displayTab) return
              setDisplayTab(id)
              setSearchParams(id, selectedItineraryId ?? null)
            }}
            className={`px-3 sm:px-5 py-2.5 border-0 bg-transparent cursor-pointer text-sm font-medium border-b-2 -mb-0.5 transition-colors ${
              displayTab === id
                ? 'text-blue-500 border-b-blue-500'
                : 'text-gray-500 border-b-transparent hover:text-gray-800'
            }`}
            title={label}
          >
            <span className="sm:hidden">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {isLoggedIn && (
        <div className={displayTab === 'itinerary' ? 'w-full' : 'hidden'}>
          <ItineraryPanel
            selectedItineraryId={selectedItineraryId}
            itinerarySummaries={itinerarySummaries}
            isLoading={isItinerariesLoading}
            initialWorkspace={initialItineraryWorkspace}
            initialErrorCode={initialItineraryErrorCode}
            onDirtyStateChange={setHasUnsavedInlineEdits}
            onBackToCards={() => {
              setSelectedItineraryId(undefined)
              setSearchParams('itinerary', null)
            }}
            onSelectItinerary={(itineraryId) => {
              setSelectedItineraryId(itineraryId)
              setSearchParams('itinerary', itineraryId)
            }}
            onRequestCreateItinerary={() => {
              if (hasUnsavedInlineEdits) return
              setIsCreateModalOpen(true)
            }}
          />
        </div>
      )}
      <div className={displayTab === 'delays' ? 'w-full' : 'hidden'}>
        <TrainDelayTab />
      </div>
      <div className={displayTab === 'timetable' ? 'w-full' : 'hidden'}>
        <TrainTimetableTab />
      </div>
      <div className={displayTab === 'forecast' ? 'w-full' : 'hidden'}>
        <ForecastTab />
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
          setIsCreateModalOpen(false)
          setSearchParams('itinerary', nextId, true)
        }}
      />
    </div>
  )
}
