'use client'

import type { ItinerarySummary, ItineraryWorkspace as ItineraryWorkspaceType } from '../app/lib/itinerary-store/types'
import ItineraryWorkspace from './ItineraryWorkspace'

interface ItineraryDetailShellProps {
  selectedItineraryId?: string
  selectedSummary?: ItinerarySummary
  initialWorkspace?: ItineraryWorkspaceType | null
  initialErrorCode?: string | null
  onBackToCards: () => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

export default function ItineraryDetailShell({
  selectedItineraryId,
  initialWorkspace,
  initialErrorCode,
  onBackToCards,
  onDirtyStateChange,
}: ItineraryDetailShellProps) {
  return (
    <div data-testid="itinerary-detail-shell" className="w-full space-y-4">
      <ItineraryWorkspace
        selectedItineraryId={selectedItineraryId}
        initialWorkspace={initialWorkspace}
        initialErrorCode={initialErrorCode}
        onDirtyStateChange={onDirtyStateChange}
        onBackToCards={onBackToCards}
      />
    </div>
  )
}
