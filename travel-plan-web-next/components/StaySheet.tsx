'use client'

import { useEffect, useId, useMemo, useState } from 'react'

type StaySheetMode = 'add-first' | 'add-next' | 'edit'

interface StaySheetSubmitInput {
  city: string
  nights: number
}

interface StaySheetProps {
  isOpen: boolean
  mode: StaySheetMode
  initialCity?: string
  initialNights?: number
  contextCity?: string
  isSubmitting?: boolean
  formError?: string | null
  onClose: () => void
  onSubmit: (input: StaySheetSubmitInput) => Promise<void>
}

function titleForMode(mode: StaySheetMode): string {
  if (mode === 'add-first') return 'Add first stay'
  if (mode === 'add-next') return 'Add next stay'
  return 'Edit stay'
}

function actionForMode(mode: StaySheetMode): string {
  if (mode === 'edit') return 'Save stay'
  if (mode === 'add-first') return 'Create stay'
  return 'Add stay'
}

export default function StaySheet({
  isOpen,
  mode,
  initialCity,
  initialNights,
  contextCity,
  isSubmitting = false,
  formError,
  onClose,
  onSubmit,
}: StaySheetProps) {
  const [city, setCity] = useState(initialCity ?? '')
  const [nights, setNights] = useState(String(initialNights ?? 1))
  const [cityError, setCityError] = useState<string | null>(null)
  const [nightsError, setNightsError] = useState<string | null>(null)
  const titleId = useId()
  const helpId = useId()

  useEffect(() => {
    if (!isOpen) return
    setCity(initialCity ?? '')
    setNights(String(initialNights ?? 1))
    setCityError(null)
    setNightsError(null)
  }, [initialCity, initialNights, isOpen])

  const helperText = useMemo(() => {
    if (mode === 'add-next' && contextCity) {
      return `Current final stay: ${contextCity}`
    }
    if (mode === 'edit') {
      return 'Update city and nights for this stay.'
    }
    return 'Enter where you will stay and for how many nights.'
  }, [contextCity, mode])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={helpId}
        className="w-full rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-xl"
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">{titleForMode(mode)}</h3>
        <p id={helpId} className="mt-1 text-sm text-gray-500">{helperText}</p>

        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()
            const trimmedCity = city.trim()
            const parsedNights = Number(nights)

            let hasError = false
            if (trimmedCity.length === 0) {
              setCityError('City is required.')
              hasError = true
            } else {
              setCityError(null)
            }

            if (!Number.isInteger(parsedNights) || parsedNights < 1) {
              setNightsError('Nights must be at least 1.')
              hasError = true
            } else {
              setNightsError(null)
            }

            if (hasError) return
            await onSubmit({ city: trimmedCity, nights: parsedNights })
          }}
        >
          <div>
            <label htmlFor="stay-city" className="block text-sm font-medium text-gray-700">City</label>
            <input
              id="stay-city"
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {cityError && <p role="alert" className="mt-1 text-xs text-red-600">{cityError}</p>}
          </div>

          <div>
            <label htmlFor="stay-nights" className="block text-sm font-medium text-gray-700">Nights</label>
            <input
              id="stay-nights"
              name="nights"
              type="number"
              min={1}
              value={nights}
              onChange={(event) => setNights(event.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {nightsError && <p role="alert" className="mt-1 text-xs text-red-600">{nightsError}</p>}
          </div>

          {formError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="mt-4 flex gap-2">
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
              {isSubmitting ? 'Saving...' : actionForMode(mode)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export type { StaySheetMode, StaySheetSubmitInput }
