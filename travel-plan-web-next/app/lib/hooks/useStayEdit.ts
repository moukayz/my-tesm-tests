import { useState } from 'react'
import { applyStayEditOptimistic } from '../stayUtils'
import type { RouteDay } from '../itinerary'

interface UseStayEditOptions {
  days: RouteDay[]
  itineraryId?: string
  setDays: (days: RouteDay[]) => void
}

export function useStayEdit({ days, itineraryId, setDays }: UseStayEditOptions) {
  const [stayEditingIndex, setStayEditingIndex] = useState<number | null>(null)
  const [stayEditError, setStayEditError] = useState<string | null>(null)
  const [stayEditSaving, setStayEditSaving] = useState(false)

  const handleStayConfirm = async (stayIndex: number, newNights: number) => {
    const snapshot = [...days]
    const optimisticDays = applyStayEditOptimistic(days, stayIndex, newNights)
    setDays(optimisticDays)
    setStayEditingIndex(null)
    setStayEditSaving(true)

    try {
      const response = itineraryId
        ? await fetch(`/api/itineraries/${itineraryId}/stays/${stayIndex}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ nights: newNights }),
          })
        : await fetch('/api/stay-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({ stayIndex, newNights }),
          })

      if (!response.ok) {
        setDays(snapshot)
        setStayEditError('Could not save changes. Your edit has been reverted.')
      } else {
        const data = await response.json()
        const nextDays = (data.updatedDays ?? data.days) as RouteDay[] | undefined
        if (nextDays) setDays(nextDays)
      }
    } catch {
      setDays(snapshot)
      setStayEditError('Could not save changes. Your edit has been reverted.')
    } finally {
      setStayEditSaving(false)
    }
  }

  const handleStayCancel = () => setStayEditingIndex(null)

  return {
    stayEditingIndex,
    stayEditError,
    stayEditSaving,
    setStayEditError,
    handleStayConfirm,
    handleStayCancel,
  }
}
