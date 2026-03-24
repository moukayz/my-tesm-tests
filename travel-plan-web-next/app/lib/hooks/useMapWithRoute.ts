import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import maplibregl from 'maplibre-gl'

export interface MapRoutePoint {
  lng: number
  lat: number
  label: string
}

export interface MapWithRouteOptions {
  color: string
  markerSize: number
  fontSize: number
  popupOffset: number
  sourceId: string
  initialZoom: number
  fitPadding: number
  maxZoom: number
}

export function useMapWithRoute(
  containerRef: RefObject<HTMLDivElement | null>,
  points: MapRoutePoint[],
  options: MapWithRouteOptions,
  coordKey?: string
): void {
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Allow callers to pass a pre-computed coordKey, or compute one from points
  const key = coordKey ?? points.map((p) => `${p.lng},${p.lat}`).join('|')

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return

    const { color, markerSize, fontSize, popupOffset, sourceId, initialZoom, fitPadding, maxZoom } = options

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [points[0].lng, points[0].lat],
        zoom: initialZoom,
      })
    } catch {
      // WebGL not available (e.g. headless environments) — skip map rendering
      return
    }
    mapRef.current = map

    map.on('load', () => {
      points.forEach((point, index) => {
        const el = document.createElement('div')
        el.textContent = String(index + 1)
        el.setAttribute('aria-label', `Stop ${index + 1}: ${point.label}`)
        el.style.cssText =
          `width:${markerSize}px;height:${markerSize}px;border-radius:50%;background:${color};color:#fff;` +
          'display:flex;align-items:center;justify-content:center;' +
          `font-size:${fontSize}px;font-weight:600;font-family:sans-serif;` +
          'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;'
        new maplibregl.Marker({ element: el })
          .setLngLat([point.lng, point.lat])
          .setPopup(new maplibregl.Popup({ offset: popupOffset }).setText(point.label))
          .addTo(map)
      })

      if (points.length >= 2) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: points.map((p) => [p.lng, p.lat]),
            },
            properties: {},
          },
        })
        map.addLayer({
          id: sourceId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': color, 'line-width': 2 },
        })
        const bounds = points.reduce(
          (b, p) => b.extend([p.lng, p.lat] as [number, number]),
          new maplibregl.LngLatBounds(
            [points[0].lng, points[0].lat],
            [points[0].lng, points[0].lat]
          )
        )
        map.fitBounds(bounds, { padding: fitPadding, maxZoom })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
