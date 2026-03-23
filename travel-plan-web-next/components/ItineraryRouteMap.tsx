'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import type { StaySummary } from '../app/lib/itinerary-store/types'

interface ItineraryRouteMapProps {
  stays: StaySummary[]
}

function getStayCoords(stays: StaySummary[]): { lng: number; lat: number; city: string }[] {
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
      city: s.city,
    }))
}

export default function ItineraryRouteMap({ stays }: ItineraryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const coordStays = useMemo(() => getStayCoords(stays), [stays])
  const coordKey = coordStays.map((c) => `${c.lng},${c.lat}`).join('|')

  useEffect(() => {
    if (!containerRef.current || coordStays.length === 0) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [coordStays[0].lng, coordStays[0].lat],
      zoom: 4,
    })
    mapRef.current = map

    map.on('load', () => {
      coordStays.forEach((coord, index) => {
        const el = document.createElement('div')
        el.textContent = String(index + 1)
        el.setAttribute('aria-label', `Stop ${index + 1}: ${coord.city}`)
        el.style.cssText =
          'width:28px;height:28px;border-radius:50%;background:#3b82f6;color:#fff;' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:13px;font-weight:600;font-family:sans-serif;' +
          'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;'
        new maplibregl.Marker({ element: el })
          .setLngLat([coord.lng, coord.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(coord.city))
          .addTo(map)
      })

      if (coordStays.length >= 2) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coordStays.map((c) => [c.lng, c.lat]),
            },
            properties: {},
          },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3b82f6', 'line-width': 2 },
        })
        const bounds = coordStays.reduce(
          (b, c) => b.extend([c.lng, c.lat] as [number, number]),
          new maplibregl.LngLatBounds(
            [coordStays[0].lng, coordStays[0].lat],
            [coordStays[0].lng, coordStays[0].lat]
          )
        )
        map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [coordKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
