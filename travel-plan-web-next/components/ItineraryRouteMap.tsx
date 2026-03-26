'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useMemo, useRef } from 'react'
import type { StaySummary } from '../app/lib/itinerary-store/types'
import { useMapWithRoute } from '../app/lib/hooks/useMapWithRoute'

interface ItineraryRouteMapProps {
  stays: StaySummary[]
}

function getStayCoords(stays: StaySummary[]): { lng: number; lat: number; label: string }[] {
  return stays
    .filter(
      (s) =>
        s.location.kind === 'resolved' ||
        s.location.kind === 'mapbox' ||
        s.location.kind === 'geonames'
    )
    .map((s) => ({
      lng: (s.location as { coordinates: { lng: number; lat: number } }).coordinates.lng,
      lat: (s.location as { coordinates: { lng: number; lat: number } }).coordinates.lat,
      label: s.city,
    }))
}

const ROUTE_MAP_OPTIONS = {
  color: '#3b82f6',
  markerSize: 28,
  fontSize: 13,
  popupOffset: 16,
  sourceId: 'route',
  initialZoom: 4,
  fitPadding: 60,
  maxZoom: 10,
  globeProjection: true,
}

export default function ItineraryRouteMap({ stays }: ItineraryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const coordStays = useMemo(() => getStayCoords(stays), [stays])
  const coordKey = coordStays.map((c) => `${c.lng},${c.lat}`).join('|')

  useMapWithRoute(containerRef, coordStays, ROUTE_MAP_OPTIONS, coordKey)

  if (coordStays.length === 0) {
    return (
      <section
        className="rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center"
        style={{ height: '480px' }}
        data-testid="route-map-placeholder"
      >
        <p className="text-sm text-gray-500">Add locations to stays to see the route map</p>
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-gray-200 overflow-hidden"
      data-testid="route-map"
    >
      <div ref={containerRef} style={{ height: '480px' }} />
    </section>
  )
}
