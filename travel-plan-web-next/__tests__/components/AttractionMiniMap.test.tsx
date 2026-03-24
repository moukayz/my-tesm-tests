import React from 'react'
import { render, screen } from '@testing-library/react'
import AttractionMiniMap from '../../components/AttractionMiniMap'
import type { DayAttraction } from '../../app/lib/itinerary'

jest.mock('maplibre-gl', () => {
  const mockMap = {
    on: jest.fn((event: string, cb: () => void) => { if (event === 'load') cb() }),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    fitBounds: jest.fn(),
    remove: jest.fn(),
  }
  return {
    __esModule: true,
    default: {
      Map: jest.fn(() => mockMap),
      Marker: jest.fn(() => ({ setLngLat: jest.fn().mockReturnThis(), setPopup: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis() })),
      Popup: jest.fn(() => ({ setText: jest.fn().mockReturnThis() })),
      LngLatBounds: jest.fn(() => ({ extend: jest.fn().mockReturnThis() })),
    },
  }
})

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

const attractionsWithCoords: DayAttraction[] = [
  { id: 'g1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } },
  { id: 'g2', label: 'Notre-Dame', coordinates: { lat: 48.853, lng: 2.349 } },
]

const attractionsNoCoords: DayAttraction[] = [
  { id: 'c1', label: 'Custom Place' },
]

describe('AttractionMiniMap', () => {
  it('renders a map container when at least one attraction has coordinates', () => {
    const { container } = render(<AttractionMiniMap attractions={attractionsWithCoords} />)
    expect(container.querySelector('[data-testid="attraction-minimap"]')).toBeInTheDocument()
    expect(screen.queryByTestId('attraction-minimap-placeholder')).not.toBeInTheDocument()
  })

  it('renders a placeholder when no attraction has coordinates', () => {
    render(<AttractionMiniMap attractions={attractionsNoCoords} />)
    expect(screen.getByTestId('attraction-minimap-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('attraction-minimap')).not.toBeInTheDocument()
  })

  it('renders a placeholder when attractions array is empty', () => {
    render(<AttractionMiniMap attractions={[]} />)
    expect(screen.getByTestId('attraction-minimap-placeholder')).toBeInTheDocument()
  })

  it('renders map container at 600×450', () => {
    render(<AttractionMiniMap attractions={attractionsWithCoords} />)
    const mapContainer = screen.getByTestId('attraction-minimap')
    expect(mapContainer).toHaveStyle({ width: '600px', height: '450px' })
  })

  it('renders placeholder at 600×450', () => {
    render(<AttractionMiniMap attractions={attractionsNoCoords} />)
    const placeholder = screen.getByTestId('attraction-minimap-placeholder')
    expect(placeholder).toHaveStyle({ width: '600px', height: '450px' })
  })
})
