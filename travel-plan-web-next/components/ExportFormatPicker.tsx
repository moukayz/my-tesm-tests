'use client'

import React, { useRef, useEffect } from 'react'
import { FileText, FileImage, X } from 'lucide-react'
import { useOutsideClick } from '../app/lib/hooks/useOutsideClick'

export interface ExportFormatPickerProps {
  /** Called when the user selects "Markdown (.md)" */
  onExportMarkdown: () => void
  /** Called when the user selects "PDF (.pdf)" */
  onExportPdf: () => void
  /** Called when the picker should close (Escape, outside click, Cancel) */
  onClose: () => void
  /** Error message from a failed PDF generation, or null. */
  exportError: string | null
  /** True while PDF is being generated; shows spinner on PDF button. */
  isPdfGenerating: boolean
}

// PDF export is temporarily disabled. Set to true to re-enable.
const PDF_EXPORT_DISABLED = true

/**
 * Inline format picker popover.
 * Handles Escape key dismiss and outside-click dismiss.
 * Thin presentational — all data/export logic lives in ItineraryTab.
 */
export default function ExportFormatPicker({
  onExportMarkdown,
  onExportPdf,
  onClose,
  exportError,
  isPdfGenerating,
}: ExportFormatPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)

  useOutsideClick(pickerRef, onClose)

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      data-testid="export-format-picker"
      className="absolute right-4 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">Save as…</span>
        <button
          data-testid="export-close"
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          aria-label="Close export picker"
        >
          <X size={14} />
        </button>
      </div>

      {/* Format options */}
      <div className="py-1">
        <button
          data-testid="export-md"
          onClick={onExportMarkdown}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700
                     hover:bg-gray-50 transition-colors"
        >
          <FileText size={16} className="text-blue-500 shrink-0" />
          Markdown (.md)
        </button>

        {/* PDF export temporarily disabled — set PDF_EXPORT_DISABLED = false to re-enable */}
        <button
          data-testid="export-pdf"
          onClick={PDF_EXPORT_DISABLED ? undefined : onExportPdf}
          disabled={PDF_EXPORT_DISABLED || isPdfGenerating}
          title={PDF_EXPORT_DISABLED ? 'PDF export is temporarily unavailable' : undefined}
          aria-disabled={PDF_EXPORT_DISABLED || isPdfGenerating}
          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700
                     hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!PDF_EXPORT_DISABLED && isPdfGenerating ? (
            <>
              <span
                data-testid="export-pdf-spinner"
                role="status"
                aria-label="Generating PDF…"
                className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin shrink-0"
              />
              Generating…
            </>
          ) : (
            <>
              <FileImage size={16} className="text-red-500 shrink-0" />
              PDF (.pdf){PDF_EXPORT_DISABLED ? ' (unavailable)' : ''}
            </>
          )}
        </button>
      </div>

      {/* PDF error banner */}
      {exportError !== null && (
        <div className="border-t border-gray-100 px-4 py-2">
          <p
            data-testid="export-pdf-error"
            role="alert"
            className="text-xs text-red-600"
          >
            ⚠ {exportError}
          </p>
        </div>
      )}
    </div>
  )
}
