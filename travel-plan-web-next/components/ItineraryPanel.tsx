'use client'

import { useState } from 'react'
import type { ItinerarySummary, ItineraryWorkspace as ItineraryWorkspaceType } from '../app/lib/itinerary-store/types'
import ItineraryCardsView from './ItineraryCardsView'
import ItineraryWorkspace from './ItineraryWorkspace'

interface ItineraryPanelProps {
  selectedItineraryId?: string
  itinerarySummaries: ItinerarySummary[]
  isLoading?: boolean
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onSelectItinerary: (itineraryId: string) => void
  onBackToCards: () => void
  onRequestCreateItinerary: () => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryPanel({
  selectedItineraryId,
  itinerarySummaries,
  isLoading,
  initialWorkspace,
  initialErrorCode,
  onSelectItinerary,
  onBackToCards,
  onRequestCreateItinerary,
  onDirtyStateChange,
}: ItineraryPanelProps) {
  const [hasUnsavedInlineEdits, setHasUnsavedInlineEdits] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  const handleDirtyStateChange = (isDirty: boolean) => {
    setHasUnsavedInlineEdits(isDirty)
    onDirtyStateChange?.(isDirty)
  }

  const requestBackToCards = () => {
    if (!hasUnsavedInlineEdits) {
      onBackToCards()
      return
    }
    setShowDiscardDialog(true)
  }

  return (
    <div className="w-full space-y-4">
      {!selectedItineraryId ? (
        <ItineraryCardsView
          itineraries={itinerarySummaries}
          isLoading={isLoading}
          onOpenItinerary={onSelectItinerary}
          onCreateItinerary={onRequestCreateItinerary}
        />
      ) : (
        <div data-testid="itinerary-detail-shell" className="w-full space-y-4">
          <ItineraryWorkspace
            selectedItineraryId={selectedItineraryId}
            initialWorkspace={initialWorkspace}
            initialErrorCode={initialErrorCode}
            onDirtyStateChange={handleDirtyStateChange}
            onBackToCards={requestBackToCards}
          />
        </div>
      )}

      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="Discard unsaved edits" className="w-full max-w-md rounded-xl bg-white p-5">
            <h3 className="text-base font-semibold text-gray-900">Discard unsaved edits?</h3>
            <p className="mt-2 text-sm text-gray-600">Leaving this itinerary will discard unsaved inline edits.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowDiscardDialog(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => {
                  setShowDiscardDialog(false)
                  handleDirtyStateChange(false)
                  onBackToCards()
                }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
