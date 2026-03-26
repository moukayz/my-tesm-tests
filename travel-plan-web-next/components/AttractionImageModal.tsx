'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload } from 'lucide-react'
import { upload } from '@vercel/blob/client'

interface PastedImage {
  file: File
  previewUrl: string
}

interface AttractionImageModalProps {
  attractionLabel: string
  onUploadComplete: (urls: string[]) => void
  onClose: () => void
}

export default function AttractionImageModal({
  attractionLabel,
  onUploadComplete,
  onClose,
}: AttractionImageModalProps) {
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length === 0) return
    e.preventDefault()

    const newImages: PastedImage[] = imageFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPastedImages((prev) => [...prev, ...newImages])
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: PastedImage[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))

    if (newImages.length > 0) setPastedImages((prev) => [...prev, ...newImages])
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  function removeImage(index: number) {
    setPastedImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleUpload() {
    if (pastedImages.length === 0) return
    setIsUploading(true)
    setError(null)

    try {
      const urls: string[] = []
      for (const { file } of pastedImages) {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
        const blob = await upload(uniqueName, file, {
          access: 'public',
          handleUploadUrl: '/api/upload-image',
        })
        urls.push(blob.url)
      }
      // Revoke preview URLs
      pastedImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
      onUploadComplete(urls)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            Add images — <span className="text-gray-500">{attractionLabel}</span>
          </span>
          <button
            type="button"
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Paste / file pick area */}
          <div
            data-testid="paste-area"
            tabIndex={0}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            role="region"
            aria-label="Paste or select images"
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center focus:outline-none focus:border-blue-400 transition-colors cursor-default"
            onPaste={handlePaste}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            autoFocus
          >
            <Upload size={24} className="mx-auto text-gray-300 mb-2" aria-hidden="true" />
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose photos
            </button>
            <p className="mt-2 text-xs text-gray-400">
              or paste with{' '}
              <kbd className="px-1 py-0.5 text-xs rounded bg-gray-100 border border-gray-200">Ctrl+V</kbd>
              {' / '}
              <kbd className="px-1 py-0.5 text-xs rounded bg-gray-100 border border-gray-200">⌘V</kbd>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Image previews */}
          {pastedImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pastedImages.map((img, idx) => (
                <div key={img.previewUrl} className="relative group/preview">
                  <img
                    src={img.previewUrl}
                    alt={`Preview ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    aria-label={`Remove image ${idx + 1}`}
                    className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow border border-gray-200 p-0.5 text-gray-500 hover:text-red-500 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                    onClick={() => removeImage(idx)}
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded text-gray-600 hover:bg-gray-200 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label="Upload"
            disabled={pastedImages.length === 0 || isUploading}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            onClick={handleUpload}
          >
            {isUploading ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Uploading…
              </>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
