'use client'

import { useState } from 'react'
import ItineraryTab from './ItineraryTab'
import TrainDelayTab from './TrainDelayTab'

export default function TravelPlan() {
  const [tab, setTab] = useState('itinerary')

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Travel Plan Itinerary</h1>
        <p className="text-gray-500 text-lg">A detailed view of your upcoming trip</p>
      </div>

      <div className="flex gap-2 mb-6 border-b-2 border-gray-200 w-full">
        <button
          onClick={() => setTab('itinerary')}
          className={`px-5 py-2.5 border-0 bg-transparent cursor-pointer text-sm font-medium border-b-2 -mb-0.5 transition-colors ${
            tab === 'itinerary'
              ? 'text-blue-500 border-b-blue-500'
              : 'text-gray-500 border-b-transparent hover:text-gray-800'
          }`}
        >
          Itinerary
        </button>
        <button
          onClick={() => setTab('delays')}
          className={`px-5 py-2.5 border-0 bg-transparent cursor-pointer text-sm font-medium border-b-2 -mb-0.5 transition-colors ${
            tab === 'delays'
              ? 'text-blue-500 border-b-blue-500'
              : 'text-gray-500 border-b-transparent hover:text-gray-800'
          }`}
        >
          Train Delays
        </button>
      </div>

      <div className={tab === 'itinerary' ? '' : 'hidden'}><ItineraryTab /></div>
      <div className={tab === 'delays' ? 'w-full' : 'hidden'}><TrainDelayTab /></div>
    </div>
  )
}
