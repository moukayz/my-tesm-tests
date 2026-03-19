'use client'

import React, { useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

export interface ExportSuccessToastProps {
  /** Human-readable message displayed in the toast body (e.g. "Itinerary exported!"). */
  message: string
  /** Called when the toast should unmount (auto-timer or manual dismiss click). */
  onDismiss: () => void
  /** Auto-dismiss delay in ms. Defaults to 3000. */
  autoDismissMs?: number
}

/**
 * Non-disruptive success toast rendered at fixed bottom-right of viewport.
 * Auto-dismisses after autoDismissMs (default 3000ms) or on manual dismiss click.
 *
 * Slice 1 — F-01: Export Success Toast
 */
export default function ExportSuccessToast({
  message,
  onDismiss,
  autoDismissMs = 3000,
}: ExportSuccessToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, autoDismissMs)
    return () => clearTimeout(id)
  }, [onDismiss, autoDismissMs])

  return (
    <div
      data-testid="export-success-toast"
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-green-200
                 bg-white px-4 py-3 shadow-lg text-sm text-gray-800"
    >
      <CheckCircle aria-hidden="true" className="text-green-500 shrink-0" size={18} />
      <span>{message}</span>
      <button
        data-testid="export-toast-dismiss"
        aria-label="Dismiss"
        className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        onClick={onDismiss}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
