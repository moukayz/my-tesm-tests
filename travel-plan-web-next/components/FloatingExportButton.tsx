'use client'

import React from 'react'
import { Download } from 'lucide-react'

export interface FloatingExportButtonProps {
  /** Whether the itinerary has rows. Disables button and shows tooltip when false. */
  hasData: boolean
  /** Whether the picker opened by this button is currently visible. */
  isPickerOpen: boolean
  /** Called when the user clicks the enabled button. */
  onOpen: () => void
  /** Forwarded ref — ItineraryTab uses this for focus-return after picker closes. */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Floating action button (FAB) rendered at the vertical mid-point of the viewport,
 * anchored to the right edge inside the active itinerary panel subtree.
 *
 * Slice 3 — F-03: Floating Export Icon
 */
export default function FloatingExportButton({
  hasData,
  isPickerOpen,
  onOpen,
  buttonRef,
}: FloatingExportButtonProps) {
  return (
    <button
      ref={buttonRef}
      data-testid="export-fab"
      disabled={!hasData}
      aria-label={hasData ? 'Export itinerary' : 'Export itinerary (nothing to export)'}
      aria-haspopup="true"
      aria-expanded={isPickerOpen}
      aria-disabled={!hasData}
      title={!hasData ? 'Nothing to export' : undefined}
      onClick={hasData ? onOpen : undefined}
      className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg
                 bg-white border border-gray-200 text-gray-700
                 hover:bg-gray-50 hover:shadow-xl
                 disabled:opacity-40 disabled:cursor-not-allowed
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                 transition-shadow"
    >
      <Download size={20} aria-hidden="true" />
    </button>
  )
}
