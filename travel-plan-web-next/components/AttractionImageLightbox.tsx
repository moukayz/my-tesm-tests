'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

interface AttractionImageLightboxProps {
  images: string[]
  initialIndex: number
  onClose: () => void
}

const ZOOM_STEPS = [1, 1.5, 2, 3]

export default function AttractionImageLightbox({
  images,
  initialIndex,
  onClose,
}: AttractionImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomStep, setZoomStep] = useState(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < images.length - 1) setIndex((i) => i + 1)
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, index, images.length])

  const zoom = ZOOM_STEPS[zoomStep]
  const canZoomIn = zoomStep < ZOOM_STEPS.length - 1
  const canZoomOut = zoomStep > 0

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Close */}
      <button
        type="button"
        aria-label="Close"
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X size={20} aria-hidden="true" />
      </button>

      {/* Zoom controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!canZoomOut}
          className="p-1 text-white disabled:opacity-30 hover:text-white/80 transition-colors"
          onClick={() => setZoomStep((s) => s - 1)}
        >
          <ZoomOut size={16} aria-hidden="true" />
        </button>
        <span data-testid="zoom-level" className="text-white text-xs w-8 text-center">
          {zoom}×
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!canZoomIn}
          className="p-1 text-white disabled:opacity-30 hover:text-white/80 transition-colors"
          onClick={() => setZoomStep((s) => s + 1)}
        >
          <ZoomIn size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Prev */}
      {index > 0 && (
        <button
          type="button"
          aria-label="Previous image"
          className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={() => { setIndex((i) => i - 1); setZoomStep(0) }}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      )}

      {/* Image */}
      <div className="overflow-auto max-h-screen max-w-screen flex items-center justify-center p-16">
        <img
          key={index}
          src={images[index]}
          alt={`Image ${index + 1} of ${images.length}`}
          className="object-contain max-h-[80vh] max-w-[80vw] rounded shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Next */}
      {index < images.length - 1 && (
        <button
          type="button"
          aria-label="Next image"
          className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={() => { setIndex((i) => i + 1); setZoomStep(0) }}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
