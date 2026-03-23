import React from 'react'
import { render, screen } from '@testing-library/react'
import type { StaySummary } from '../../app/lib/itinerary-store/types'

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
import ItineraryRouteMap from '../../components/ItineraryRouteMap'

const MockMap = maplibregl.Map as jest.Mock
const MockMarker = maplibregl.Marker as jest.Mock
const MockPopup = maplibregl.Popup as jest.Mock
const MockLngLatBounds = maplibregl.LngLatBounds as jest.Mock

function makeMapInstance() {
  return {
    on: jest.fn(),
    remove: jest.fn(),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    fitBounds: jest.fn(),
  }
}

function resolvedStay(city: string, lng: number, lat: number, stayIndex = 0): StaySummary {
  return {
    stayIndex,
    city,
    nights: 1,
    startDayIndex: stayIndex,
    endDayIndex: stayIndex,
    isLastStay: false,
    location: {
      kind: 'resolved',
      label: city,
      queryText: city,
      coordinates: { lng, lat },
      place: { placeId: `p-${city}`, name: city },
    },
  }
}

function customStay(city: string, stayIndex = 0): StaySummary {
  return {
    stayIndex,
    city,
    nights: 1,
    startDayIndex: stayIndex,
    endDayIndex: stayIndex,
    isLastStay: false,
    location: { kind: 'custom', label: city, queryText: city },
  }
}

let mockMapInstance: ReturnType<typeof makeMapInstance>

beforeEach(() => {
  jest.clearAllMocks()
  mockMapInstance = makeMapInstance()
  MockMap.mockImplementation(() => mockMapInstance)
  mockMapInstance.on.mockImplementation((event: string, cb: () => void) => {
    if (event === 'load') cb()
  })
  MockMarker.mockImplementation(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setPopup: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
  }))
  MockPopup.mockImplementation(() => ({
    setText: jest.fn().mockReturnThis(),
  }))
  MockLngLatBounds.mockImplementation(() => ({
    extend: jest.fn().mockReturnThis(),
  }))
})

describe('ItineraryRouteMap', () => {
  it('shows placeholder when stays array is empty', () => {
    render(<ItineraryRouteMap stays={[]} />)
    expect(screen.getByTestId('route-map-placeholder')).toBeInTheDocument()
    expect(screen.getByText(/add locations to stays to see the route map/i)).toBeInTheDocument()
    expect(MockMap).not.toHaveBeenCalled()
  })

  it('shows placeholder when all stays are kind: custom', () => {
    render(<ItineraryRouteMap stays={[customStay('Somewhere'), customStay('Nowhere', 1)]} />)
    expect(screen.getByTestId('route-map-placeholder')).toBeInTheDocument()
    expect(MockMap).not.toHaveBeenCalled()
  })

  it('renders map container when at least one resolved stay exists', () => {
    render(<ItineraryRouteMap stays={[resolvedStay('Paris', 2.3522, 48.8566)]} />)
    expect(screen.getByTestId('route-map')).toBeInTheDocument()
    expect(screen.queryByTestId('route-map-placeholder')).not.toBeInTheDocument()
    expect(MockMap).toHaveBeenCalled()
  })

  it('initialises map with OpenFreeMap liberty style', () => {
    render(<ItineraryRouteMap stays={[resolvedStay('Paris', 2.3522, 48.8566)]} />)
    expect(MockMap).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'https://tiles.openfreemap.org/styles/liberty' })
    )
  })

  it('only resolved stays contribute markers; custom stays are excluded', () => {
    const stays: StaySummary[] = [
      resolvedStay('Paris', 2.3522, 48.8566, 0),
      customStay('Unknown', 1),
      resolvedStay('Lyon', 4.8357, 45.764, 2),
    ]
    render(<ItineraryRouteMap stays={stays} />)
    // 2 resolved stays → 2 Marker instances
    expect(MockMarker).toHaveBeenCalledTimes(2)
  })

  it('passes a custom element with the correct stop number to each Marker', () => {
    const stays: StaySummary[] = [
      resolvedStay('Paris', 2.3522, 48.8566, 0),
      resolvedStay('Lyon', 4.8357, 45.764, 1),
      resolvedStay('Marseille', 5.3698, 43.2965, 2),
    ]
    render(<ItineraryRouteMap stays={stays} />)
    const calls = MockMarker.mock.calls as [{ element: HTMLElement }][]
    expect(calls).toHaveLength(3)
    expect(calls[0][0].element.textContent).toBe('1')
    expect(calls[1][0].element.textContent).toBe('2')
    expect(calls[2][0].element.textContent).toBe('3')
  })

  it('adds LineString GeoJSON source with coordinates from resolved stays in order', () => {
    const stays: StaySummary[] = [
      resolvedStay('Paris', 2.3522, 48.8566, 0),
      resolvedStay('Lyon', 4.8357, 45.764, 1),
      resolvedStay('Marseille', 5.3698, 43.2965, 2),
    ]
    render(<ItineraryRouteMap stays={stays} />)
    expect(mockMapInstance.addSource).toHaveBeenCalledWith(
      'route',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          geometry: expect.objectContaining({
            type: 'LineString',
            coordinates: [
              [2.3522, 48.8566],
              [4.8357, 45.764],
              [5.3698, 43.2965],
            ],
          }),
        }),
      })
    )
  })

  it('does not add source or layer when exactly one stay has coordinates', () => {
    render(<ItineraryRouteMap stays={[resolvedStay('Paris', 2.3522, 48.8566)]} />)
    expect(mockMapInstance.addSource).not.toHaveBeenCalled()
    expect(mockMapInstance.addLayer).not.toHaveBeenCalled()
  })

  it('calls map.remove on unmount', () => {
    const { unmount } = render(
      <ItineraryRouteMap stays={[resolvedStay('Paris', 2.3522, 48.8566)]} />
    )
    unmount()
    expect(mockMapInstance.remove).toHaveBeenCalled()
  })
})
