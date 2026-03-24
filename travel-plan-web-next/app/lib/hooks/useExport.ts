import { useRef, useState } from 'react'
import type { RouteDay } from '../itinerary'
import { buildMarkdownTable } from '../itineraryExport'
import { saveFile } from '../fileSave'

interface UseExportOptions {
  getEffectiveData: () => RouteDay[]
}

export function useExport({ getEffectiveData }: UseExportOptions) {
  const [floatingPickerOpen, setFloatingPickerOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null)
  const floatingButtonRef = useRef<HTMLButtonElement>(null)

  function openFloatingPicker() {
    if (floatingButtonRef.current) {
      setPickerAnchorRect(floatingButtonRef.current.getBoundingClientRect())
    }
    setFloatingPickerOpen(true)
    setExportError(null)
  }

  function closeFloatingPicker() {
    setFloatingPickerOpen(false)
    setExportError(null)
    setIsPdfGenerating(false)
    setTimeout(() => floatingButtonRef.current?.focus(), 0)
  }

  async function handleExportMarkdown() {
    try {
      const content = buildMarkdownTable(getEffectiveData())
      await saveFile({ content, filename: 'itinerary.md', mimeType: 'text/markdown' })
      closeFloatingPicker()
      setExportSuccess(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        closeFloatingPicker()
      }
    }
  }

  function handleExportPdf() {
    // PDF export is temporarily disabled — this is a no-op stub.
  }

  return {
    floatingPickerOpen,
    exportError,
    isPdfGenerating,
    exportSuccess,
    setExportSuccess,
    pickerAnchorRect,
    floatingButtonRef,
    openFloatingPicker,
    closeFloatingPicker,
    handleExportMarkdown,
    handleExportPdf,
  }
}
