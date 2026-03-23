'use client'

import { useEffect, useId, useState } from 'react'
import type { CreateItineraryResponse } from '../app/lib/itinerary-store/types'

interface CreateItineraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (response: CreateItineraryResponse) => void
}

function mapCreateError(code: string): string {
  if (code === 'INVALID_START_DATE') return 'Please provide a valid start date.'
  if (code === 'INVALID_ITINERARY_NAME') return 'Please provide a shorter itinerary name.'
  return 'Could not create itinerary. Please try again.'
}

export default function CreateItineraryModal({ isOpen, onClose, onSuccess }: CreateItineraryModalProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startDateError, setStartDateError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    setStartDateError(null)
    setRequestError(null)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">Create itinerary</h2>

        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setRequestError(null)

            if (!startDate.trim()) {
              setStartDateError('Start date is required.')
              return
            }
            setStartDateError(null)
            setIsSubmitting(true)

            try {
              const response = await fetch('/api/itineraries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, startDate }),
              })

              const body = (await response.json()) as { error?: string } & Partial<CreateItineraryResponse>
              if (!response.ok) {
                const code = body.error ?? 'UNKNOWN'
                if (code === 'INVALID_START_DATE') {
                  setStartDateError(mapCreateError(code))
                } else {
                  setRequestError(mapCreateError(code))
                }
                return
              }

              onSuccess(body as CreateItineraryResponse)
            } catch {
              setRequestError('Could not create itinerary. Please try again.')
            } finally {
              setIsSubmitting(false)
            }
          }}
        >
          <div>
            <label htmlFor="itinerary-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="itinerary-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="itinerary-start-date" className="block text-sm font-medium text-gray-700">Start date</label>
            <input
              id="itinerary-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {startDateError && <p role="alert" className="mt-1 text-xs text-red-600">{startDateError}</p>}
          </div>

          {requestError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {requestError}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create itinerary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
