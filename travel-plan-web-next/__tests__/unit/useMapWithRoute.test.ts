import { renderHook } from '@testing-library/react'
import { useRef } from 'react'

jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: {
    Map: jest.fn(),
    Marker: jest.fn(),
    Popup: jest.fn(),
    LngLatBounds: jest.fn(),
  },
}))

// eslint-disable-next-line import/first
import maplibregl from 'maplibre-gl'
// eslint-disable-next-line import/first
import { useMapWithRoute } from '../../app/lib/hooks/useMapWithRoute'

const MockMap = maplibregl.Map as jest.Mock
const MockMarker = maplibregl.Marker as jest.Mock
const MockPopup = maplibregl.Popup as jest.Mock
const MockLngLatBounds = maplibregl.LngLatBounds as jest.Mock

function makeMapInstance(triggerLoadImmediately = true) {
  const instance = {
    on: jest.fn((event: string, cb: () => void) => {
      if (triggerLoadImmediately && (event === 'load' || event === 'style.load')) cb()
    }),
    remove: jest.fn(),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    fitBounds: jest.fn(),
    setProjection: jest.fn(),
  }
  return instance
}

const defaultOptions = {
  color: '#3b82f6',
  markerSize: 28,
  fontSize: 13,
  popupOffset: 16,
  sourceId: 'route',
  initialZoom: 4,
  fitPadding: 60,
  maxZoom: 10,
}

describe('useMapWithRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    const markerInstance = { setLngLat: jest.fn().mockReturnThis(), setPopup: jest.fn().mockReturnThis(), addTo: jest.fn() }
    MockMarker.mockImplementation(() => markerInstance)
    const popupInstance = { setText: jest.fn().mockReturnThis() }
    MockPopup.mockImplementation(() => popupInstance)
    const boundsInstance = { extend: jest.fn().mockReturnThis() }
    MockLngLatBounds.mockImplementation(() => boundsInstance)
  })

  it('creates a map when containerRef and points are provided', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [{ lng: 2.35, lat: 48.85, label: 'Paris' }]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    expect(MockMap).toHaveBeenCalledWith(expect.objectContaining({
      container,
      zoom: 4,
    }))
  })

  it('sets globe projection on style.load when globeProjection is true', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [{ lng: 2.35, lat: 48.85, label: 'Paris' }]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, { ...defaultOptions, globeProjection: true })
    })

    expect(mapInstance.setProjection).toHaveBeenCalledWith({ type: 'globe' })
  })

  it('does not set globe projection when globeProjection is not set', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [{ lng: 2.35, lat: 48.85, label: 'Paris' }]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    expect(mapInstance.setProjection).not.toHaveBeenCalled()
  })

  it('adds a marker for each point', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [
      { lng: 2.35, lat: 48.85, label: 'Paris' },
      { lng: 4.83, lat: 45.74, label: 'Lyon' },
    ]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    expect(MockMarker).toHaveBeenCalledTimes(2)
  })

  it('adds GeoJSON source and line layer for 2+ points', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [
      { lng: 2.35, lat: 48.85, label: 'Paris' },
      { lng: 4.83, lat: 45.74, label: 'Lyon' },
    ]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    expect(mapInstance.addSource).toHaveBeenCalledWith('route', expect.objectContaining({ type: 'geojson' }))
    expect(mapInstance.addLayer).toHaveBeenCalledTimes(1)
  })

  it('does not add source/layer for a single point', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [{ lng: 2.35, lat: 48.85, label: 'Paris' }]

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    expect(mapInstance.addSource).not.toHaveBeenCalled()
    expect(mapInstance.addLayer).not.toHaveBeenCalled()
  })

  it('calls map.remove() on unmount', () => {
    const container = document.createElement('div')
    const mapInstance = makeMapInstance()
    MockMap.mockImplementation(() => mapInstance)

    const points = [{ lng: 2.35, lat: 48.85, label: 'Paris' }]

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, points, defaultOptions)
    })

    unmount()

    expect(mapInstance.remove).toHaveBeenCalledTimes(1)
  })

  it('does not create a map when points array is empty', () => {
    const container = document.createElement('div')
    MockMap.mockImplementation(() => makeMapInstance())

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container)
      useMapWithRoute(ref, [], defaultOptions)
    })

    expect(MockMap).not.toHaveBeenCalled()
  })
})
