'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import type { DayAttraction } from '../app/lib/itinerary'

interface AttractionMiniMapProps {
  attractions: DayAttraction[]
}

export default function AttractionMiniMap({ attractions }: AttractionMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const coordAttractions = useMemo(
    () => attractions.filter((a) => a.coordinates != null) as (DayAttraction & { coordinates: { lat: number; lng: number } })[],
    [attractions]
  )
  const coordKey = coordAttractions.map((a) => `${a.coordinates.lng},${a.coordinates.lat}`).join('|')

  useEffect(() => {
    if (!containerRef.current || coordAttractions.length === 0) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [coordAttractions[0].coordinates.lng, coordAttractions[0].coordinates.lat],
      zoom: 12,
    })
    mapRef.current = map

    map.on('load', () => {
      coordAttractions.forEach((attraction, index) => {
        const el = document.createElement('div')
        el.textContent = String(index + 1)
        el.setAttribute('aria-label', `Attraction ${index + 1}: ${attraction.label}`)
        el.style.cssText =
          'width:24px;height:24px;border-radius:50%;background:#7c3aed;color:#fff;' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:11px;font-weight:600;font-family:sans-serif;' +
          'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;'
        new maplibregl.Marker({ element: el })
          .setLngLat([attraction.coordinates.lng, attraction.coordinates.lat])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(attraction.label))
          .addTo(map)
      })

      if (coordAttractions.length >= 2) {
        map.addSource('attraction-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coordAttractions.map((a) => [a.coordinates.lng, a.coordinates.lat]),
            },
            properties: {},
          },
        })
        map.addLayer({
          id: 'attraction-route',
          type: 'line',
          source: 'attraction-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#7c3aed', 'line-width': 2 },
        })
        const bounds = coordAttractions.reduce(
          (b, a) => b.extend([a.coordinates.lng, a.coordinates.lat] as [number, number]),
          new maplibregl.LngLatBounds(
            [coordAttractions[0].coordinates.lng, coordAttractions[0].coordinates.lat],
            [coordAttractions[0].coordinates.lng, coordAttractions[0].coordinates.lat]
          )
        )
        map.fitBounds(bounds, { padding: 40, maxZoom: 12 })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [coordKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
