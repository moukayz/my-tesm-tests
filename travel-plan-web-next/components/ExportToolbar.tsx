'use client'

import React from 'react'
import { Download } from 'lucide-react'

export interface ExportToolbarProps {
  /** Whether the itinerary has any rows; disables the button when false. */
  hasData: boolean
  /** Whether the format picker is currently open. */
  isPickerOpen: boolean
  /** Called when the user clicks "Export to files…" */
  onOpen: () => void
  /** Optional ref forwarded to the trigger button for focus management. */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Thin presentational toolbar with the "Export to files…" trigger button.
 * No internal state — all logic lives in ItineraryTab.
 */
export default function ExportToolbar({ hasData, isPickerOpen, onOpen, buttonRef }: ExportToolbarProps) {
  return (
    <div className="flex justify-end items-center px-4 py-3 border-b border-gray-100">
      <button
        ref={buttonRef}
        data-testid="export-button"
        disabled={!hasData}
        title={!hasData ? 'No itinerary data to export' : undefined}
        onClick={onOpen}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                   border border-gray-300 text-gray-700 hover:bg-gray-50
                   disabled:opacity-40 disabled:cursor-not-allowed"
        aria-haspopup="true"
        aria-expanded={isPickerOpen}
      >
        <Download size={16} />
        Export to files…
      </button>
    </div>
  )
}
