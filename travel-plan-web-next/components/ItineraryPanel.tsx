'use client'

import { useMemo, useState } from 'react'
import type { ItinerarySummary, ItineraryWorkspace as ItineraryWorkspaceType } from '../app/lib/itinerary-store/types'
import type { RouteDay } from '../app/lib/itinerary'
import ItineraryCardsView, { type StarterRouteCard } from './ItineraryCardsView'
import ItineraryDetailShell from './ItineraryDetailShell'

interface ItineraryPanelProps {
  selectedItineraryId?: string
  selectedLegacyTabKey?: 'route'
  itinerarySummaries: ItinerarySummary[]
  starterRouteCard: StarterRouteCard | null
  initialRouteData?: RouteDay[]
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onSelectItinerary: (itineraryId: string) => void
  onSelectStarterRoute: (legacyTabKey: 'route') => void
  onBackToCards: () => void
  onRequestCreateItinerary: () => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryPanel({
  selectedItineraryId,
  selectedLegacyTabKey,
  itinerarySummaries,
  starterRouteCard,
  initialRouteData,
  initialWorkspace,
  initialErrorCode,
  onSelectItinerary,
  onSelectStarterRoute,
  onBackToCards,
  onRequestCreateItinerary,
  onDirtyStateChange,
}: ItineraryPanelProps) {
  const [hasUnsavedInlineEdits, setHasUnsavedInlineEdits] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  const selectedSummary = useMemo(
    () => itinerarySummaries.find((item) => item.id === selectedItineraryId),
    [itinerarySummaries, selectedItineraryId]
  )

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

  const isDetailMode = !!selectedItineraryId || selectedLegacyTabKey === 'route'

  return (
    <div className="w-full space-y-4">
      {!isDetailMode ? (
        <ItineraryCardsView
          itineraries={itinerarySummaries}
          starterRouteCard={starterRouteCard}
          onOpenStarterRoute={onSelectStarterRoute}
          onOpenItinerary={onSelectItinerary}
          onCreateItinerary={onRequestCreateItinerary}
        />
      ) : (
        <ItineraryDetailShell
          selectedItineraryId={selectedItineraryId}
          selectedLegacyTabKey={selectedLegacyTabKey}
          selectedSummary={selectedSummary}
          initialRouteData={initialRouteData}
          initialWorkspace={initialWorkspace}
          initialErrorCode={initialErrorCode}
          onBackToCards={requestBackToCards}
          onDirtyStateChange={handleDirtyStateChange}
        />
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
