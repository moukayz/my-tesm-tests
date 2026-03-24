'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useMemo, useRef } from 'react'
import type { DayAttraction } from '../app/lib/itinerary'
import { useMapWithRoute } from '../app/lib/hooks/useMapWithRoute'

interface AttractionMiniMapProps {
  attractions: DayAttraction[]
}

const MINIMAP_OPTIONS = {
  color: '#7c3aed',
  markerSize: 24,
  fontSize: 11,
  popupOffset: 14,
  sourceId: 'attraction-route',
  initialZoom: 12,
  fitPadding: 40,
  maxZoom: 12,
}

export default function AttractionMiniMap({ attractions }: AttractionMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const coordAttractions = useMemo(
    () =>
      attractions
        .filter((a) => a.coordinates != null)
        .map((a) => ({
          lng: a.coordinates!.lng,
          lat: a.coordinates!.lat,
          label: a.label,
        })),
    [attractions]
  )
  const coordKey = coordAttractions.map((a) => `${a.lng},${a.lat}`).join('|')

  useMapWithRoute(containerRef, coordAttractions, MINIMAP_OPTIONS, coordKey)

  if (coordAttractions.length === 0) {
    return (
      <div
        data-testid="attraction-minimap-placeholder"
        className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400"
        style={{ width: 600, height: 450 }}
      >
        No location data
      </div>
    )
  }

  return (
    <div
      data-testid="attraction-minimap"
      className="rounded-lg border border-gray-200 overflow-hidden"
      style={{ width: 600, height: 450 }}
    >
      <div ref={containerRef} style={{ width: 600, height: 450 }} />
    </div>
  )
}
