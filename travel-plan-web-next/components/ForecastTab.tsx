'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { omProtocol, updateCurrentBounds, getValueFromLatLong, defaultOmProtocolSettings } from '@openmeteo/weather-map-layer'
import 'maplibre-gl/dist/maplibre-gl.css'

type Provider = 'ecmwf_ifs' | 'ecmwf_ifs025' | 'dwd_icon_eu'
type Variable = 'temperature_2m' | 'cloud_cover' | 'cloud_cover_low' | 'cloud_cover_mid' | 'cloud_cover_high'

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'ecmwf_ifs', label: 'ECMWF IFS HRES' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS 0.25°' },
  { id: 'dwd_icon_eu', label: 'DWD ICON EU' },
]

const VARIABLES: { id: Variable; label: string; unit: string }[] = [
  { id: 'temperature_2m', label: 'Temperature', unit: '°C' },
  { id: 'cloud_cover', label: 'Total Cloud Cover', unit: '%' },
  { id: 'cloud_cover_low', label: 'Low Cloud Cover', unit: '%' },
  { id: 'cloud_cover_mid', label: 'Mid Cloud Cover', unit: '%' },
  { id: 'cloud_cover_high', label: 'High Cloud Cover', unit: '%' },
]

function buildBaseUrl(provider: Provider, variable: Variable): string {
  return `https://map-tiles.open-meteo.com/data_spatial/${provider}/latest.json?variable=${variable}`
}

// Each color is pinned to an exact temperature breakpoint.
// The official guide recommends 'breakpoint' type as preferred and computationally faster.
const TEMP_BREAKPOINTS = [
  -40, -37.5, -35, -32.5, -30, -27.5, -25, -22.5, -20, -17.5, -15, -12.5, -10,
  -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  42, 44, 46, 48, 50,
]
const TEMP_COLORS: [number, number, number][] = [
  [47, 17, 189], [86, 15, 201],
  [131, 13, 213], [181, 10, 226], [239, 7, 239], [206, 6, 241], [171, 5, 243],
  [136, 4, 245], [100, 4, 247], [64, 3, 249], [26, 2, 251], [1, 14, 253],
  [0, 52, 255], [35, 110, 251], [69, 156, 247], [102, 192, 245], [134, 219, 245],
  [124, 245, 124], [90, 244, 90], [56, 244, 56], [21, 245, 21], [7, 224, 7],
  [4, 193, 4], [2, 161, 2], [0, 128, 0], [57, 170, 0], [142, 213, 0],
  [255, 255, 0], [255, 233, 0], [255, 210, 0], [255, 188, 0], [255, 165, 0],
  [255, 141, 0], [255, 118, 0], [255, 94, 0], [255, 71, 0], [255, 47, 0],
  [255, 24, 0], [255, 0, 0], [228, 0, 10], [201, 0, 18], [174, 0, 23], [147, 0, 26],
]
const TEMP_MIN = -40
const TEMP_MAX = 50

const customTemperatureScale = {
  type: 'breakpoint' as const,
  unit: '°C',
  breakpoints: TEMP_BREAKPOINTS,
  colors: TEMP_COLORS.map(([r, g, b]): [number, number, number, number] => [r, g, b, 1]),
}

const customProtocolSettings = {
  ...defaultOmProtocolSettings,
  colorScales: {
    ...defaultOmProtocolSettings.colorScales,
    // Override only temperature_2m; all other variables use the library's built-in scales.
    temperature_2m: customTemperatureScale,
  },
}

// Cloud cover color scale (light variant) from @openmeteo/weather-map-layer
const CLOUD_BREAKPOINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
const CLOUD_COLORS: [number, number, number, number][] = [
  [255, 255, 255, 0],
  [249, 251, 253, 0.141],
  [244, 247, 250, 0.4],
  [233, 239, 244, 0.475],
  [220, 226, 233, 0.55],
  [209, 213, 219, 0.625],
  [188, 193, 202, 0.7],
  [166, 173, 184, 0.775],
  [138, 147, 162, 0.85],
  [104, 115, 133, 0.925],
]

function buildGradient(stops: string[]): string {
  return `linear-gradient(to right, ${stops.join(', ')})`
}

const TEMP_GRADIENT = buildGradient(
  TEMP_COLORS.map(([r, g, b], i) =>
    `rgb(${r},${g},${b}) ${((i / (TEMP_COLORS.length - 1)) * 100).toFixed(2)}%`
  )
)

const CLOUD_GRADIENT = buildGradient(
  CLOUD_BREAKPOINTS.map((bp, i) => {
    const [r, g, b, a] = CLOUD_COLORS[i]
    return `rgba(${r},${g},${b},${a}) ${bp}%`
  })
)

const TEMP_TICKS = [
  { temp: -40, label: '-40°C' },
  { temp: -20, label: '-20°C' },
  { temp: 0, label: '0°C' },
  { temp: 20, label: '20°C' },
  { temp: 40, label: '40°C' },
].map(({ temp, label }) => ({
  position: ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100,
  label,
}))

const CLOUD_TICKS = [
  { position: 0, label: '0%' },
  { position: 25, label: '25%' },
  { position: 50, label: '50%' },
  { position: 75, label: '75%' },
  { position: 90, label: '90%' },
]

interface TooltipState {
  x: number
  y: number
  value: number
}

export default function ForecastTab() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [provider, setProvider] = useState<Provider>('ecmwf_ifs')
  const [variable, setVariable] = useState<Variable>('temperature_2m')
  const baseUrlRef = useRef(buildBaseUrl('ecmwf_ifs', 'temperature_2m'))
  // Update ref inline during render — no useEffect needed for a derived ref value
  baseUrlRef.current = buildBaseUrl(provider, variable)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return

    // Do NOT propagate maplibre's tile-cancellation signal to the library.
    // The library's abort cleanup throws unhandled async errors (library bug) via two paths:
    //   1. Synchronous throws that escape maplibre's async generator as rejected promises.
    //   2. Fire-and-forget async paths inside the file reader that reject without a handler.
    // Since the library caches all range-request data, letting in-flight requests complete
    // is harmless — data is reused on the next tile request for the same area.
    // We also call .catch() on the returned promise to prevent "Uncaught (in promise)"
    // when maplibre removes the source and orphans the tile promise before it settles.
    maplibregl.addProtocol('om', (params) => {
      const controller = new AbortController()
      const promise = omProtocol(params, controller, customProtocolSettings).catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return { data: null }
        throw err
      })
      promise.catch(() => {})
      return promise
    })

    const container = containerRef.current
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [10, 50],
        zoom: 3,
      })
    } catch {
      return
    }

    let isActive = true

    const syncBounds = () => {
      const b = map.getBounds()
      if (b) updateCurrentBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    }

    const onMouseMove = async (e: maplibregl.MapMouseEvent) => {
      const { x, y } = e.point
      const { lat, lng } = e.lngLat
      try {
        const result = await getValueFromLatLong(lat, lng, baseUrlRef.current)
        if (!isActive) return
        if (!isNaN(result.value)) {
          setTooltip({ x, y, value: result.value })
        }
      } catch {
        // data not yet loaded for this location — keep previous tooltip
      }
    }

    const onMouseLeave = () => {
      if (isActive) setTooltip(null)
    }

    map.on('load', () => {
      if (!isActive) return
      // Sync bounds immediately so the library knows the initial viewport.
      syncBounds()
      setMapReady(true)
    })
    map.on('moveend', syncBounds)
    map.on('mousemove', onMouseMove)
    // Use DOM mouseleave on the container (not maplibre's mouseout) so the tooltip
    // only clears when the mouse physically exits the map, not during zoom animations.
    container.addEventListener('mouseleave', onMouseLeave)

    mapRef.current = map

    return () => {
      isActive = false
      mapRef.current = null
      maplibregl.removeProtocol('om')
      map.off('moveend', syncBounds)
      map.off('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      map.remove()
    }
  }, [])

  // Update weather source/layer whenever the map is ready or provider/variable changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (map.getLayer('weather-layer')) map.removeLayer('weather-layer')
    if (map.getSource('weather')) map.removeSource('weather')

    const url = buildBaseUrl(provider, variable)
    map.addSource('weather', {
      type: 'raster',
      url: `om://${url}`,
      tileSize: 512,
      // Constrain to one world copy so tiles don't repeat horizontally at low zoom.
      bounds: [-180, -90, 180, 90],
    })
    map.addLayer({
      id: 'weather-layer',
      type: 'raster',
      source: 'weather',
      paint: { 'raster-opacity': 0.75 },
    })
  }, [mapReady, provider, variable])

  const varConfig = VARIABLES.find(v => v.id === variable)!
  const isTemp = variable === 'temperature_2m'

  return (
    <div className="relative w-full">
      <div className="absolute top-3 left-3 z-10 bg-white/90 rounded px-2 py-1.5 shadow flex items-center gap-2">
        <select
          data-testid="provider-select"
          value={provider}
          onChange={e => setProvider(e.target.value as Provider)}
          className="text-sm text-gray-700 bg-transparent outline-none cursor-pointer"
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <span className="text-gray-300">|</span>
        <select
          data-testid="variable-select"
          value={variable}
          onChange={e => setVariable(e.target.value as Variable)}
          className="text-sm text-gray-700 bg-transparent outline-none cursor-pointer"
        >
          {VARIABLES.map(v => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      <div
        ref={containerRef}
        data-testid="forecast-map"
        className="w-full h-[600px] rounded-lg overflow-hidden"
      />

      {tooltip && (
        <div
          data-testid="forecast-tooltip"
          className="absolute z-10 bg-white/95 rounded px-2 py-1 text-sm font-semibold text-gray-800 shadow pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          {isTemp ? tooltip.value.toFixed(1) : Math.round(tooltip.value)}{varConfig.unit}
        </div>
      )}

      {isTemp
        ? <ColorScaleLegend gradient={TEMP_GRADIENT} ticks={TEMP_TICKS} />
        : <ColorScaleLegend gradient={CLOUD_GRADIENT} ticks={CLOUD_TICKS} title={varConfig.label} bordered />
      }
    </div>
  )
}

function ColorScaleLegend({
  gradient,
  ticks,
  title,
  bordered = false,
}: {
  gradient: string
  ticks: { position: number; label: string }[]
  title?: string
  bordered?: boolean
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 rounded px-4 pt-2 pb-4 shadow min-w-[280px]">
      {title && <div className="text-xs text-gray-500 mb-1 text-center">{title}</div>}
      <div
        className={`relative w-64 h-3 rounded overflow-hidden${bordered ? ' border border-gray-200' : ''}`}
        style={{ background: gradient }}
      />
      <div className="relative w-64 h-4 mt-0.5">
        {ticks.map(({ position, label }) => (
          <span
            key={label}
            className="absolute text-xs text-gray-600 -translate-x-1/2 top-0"
            style={{ left: `${position}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
