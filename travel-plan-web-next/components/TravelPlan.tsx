'use client'

import { useState } from 'react'
import ItineraryTab from './ItineraryTab'
import TrainDelayTab from './TrainDelayTab'
import TrainTimetableTab from './TrainTimetableTab'
import type { RouteDay } from '../app/lib/itinerary'

type Tab = 'itinerary' | 'delays' | 'timetable'

interface TravelPlanProps {
  isLoggedIn?: boolean
  initialRouteData?: RouteDay[]
}

export default function TravelPlan({ isLoggedIn = false, initialRouteData }: TravelPlanProps) {
  const allTabs: { id: Tab; label: string }[] = [
    { id: 'itinerary', label: 'Itinerary' },
    { id: 'delays', label: 'Train Delays' },
    { id: 'timetable', label: 'Timetable' },
  ]

  const tabs = isLoggedIn ? allTabs : allTabs.filter(t => t.id !== 'itinerary')
  const defaultTab: Tab = isLoggedIn ? 'itinerary' : 'delays'

  const [tab, setTab] = useState<Tab>(defaultTab)

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
            onClick={() => setTab(id)}
            className={`px-5 py-2.5 border-0 bg-transparent cursor-pointer text-sm font-medium border-b-2 -mb-0.5 transition-colors ${
              tab === id
                ? 'text-blue-500 border-b-blue-500'
                : 'text-gray-500 border-b-transparent hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoggedIn && initialRouteData && (
        <div className={tab === 'itinerary' ? '' : 'hidden'}>
          <ItineraryTab initialData={initialRouteData} />
        </div>
      )}
      <div className={tab === 'delays' ? 'w-full' : 'hidden'}>
        <TrainDelayTab />
      </div>
      <div className={tab === 'timetable' ? 'w-full' : 'hidden'}>
        <TrainTimetableTab />
      </div>
    </div>
  )
}
