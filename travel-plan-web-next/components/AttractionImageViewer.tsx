'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface AttractionImageViewerProps {
  images: string[]
  anchorRect: DOMRect
  onDeleteImage: (index: number) => void
  onThumbnailClick: (index: number) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export default function AttractionImageViewer({
  images,
  anchorRect,
  onDeleteImage,
  onThumbnailClick,
  onMouseEnter,
  onMouseLeave,
}: AttractionImageViewerProps) {
  if (images.length === 0) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    // Bottom edge aligns with tag top; pb-1.5 padding fills the visual gap as a hover bridge
    bottom: `calc(100vh - ${anchorRect.top}px)`,
    left: `${anchorRect.left}px`,
  }

  const content = (
    <div data-testid="viewer-outer" style={style} className="z-[60] pb-1.5" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-1.5">
        <div
          data-testid="image-scroll"
          className="flex gap-1.5 overflow-x-auto max-w-[320px]"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((url, i) => (
            <div key={url} className="relative flex-shrink-0 group/thumb">
              <img
                src={url}
                alt={`Image ${i + 1}`}
                className="h-20 w-20 object-cover rounded cursor-pointer hover:brightness-90 transition-[filter]"
                onClick={(e) => { e.stopPropagation(); onThumbnailClick(i) }}
              />
              <button
                type="button"
                aria-label={`Delete image ${i + 1}`}
                className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 text-gray-500 hover:text-red-500 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onDeleteImage(i) }}
              >
                <X size={10} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}
