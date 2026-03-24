import React from 'react'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import AttractionCell from '../../components/AttractionCell'
import type { RouteDay, DayAttraction } from '../../app/lib/itinerary'

jest.mock('../../app/lib/locations/search', () => ({
  searchLocationSuggestions: jest.fn().mockResolvedValue({ results: [] }),
}))

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

const baseDay: RouteDay = {
  date: '2026/9/25',
  weekDay: '星期五',
  dayNum: 1,
  overnight: '巴黎',
  plan: { morning: '', afternoon: '', evening: '' },
  train: [],
}

const attractions: DayAttraction[] = [
  { id: 'a1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } },
  { id: 'a2', label: 'Notre-Dame', coordinates: { lat: 48.853, lng: 2.349 } },
  { id: 'a3', label: 'Louvre Museum', coordinates: { lat: 48.861, lng: 2.338 } },
]

function renderCell(dayOverrides: Partial<RouteDay> = {}) {
  const day = { ...baseDay, ...dayOverrides }
  return render(
    <table><tbody><tr>
      <AttractionCell dayIndex={0} day={day} processedDay={day} />
    </tr></tbody></table>
  )
}

describe('AttractionCell', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) })
  })
  afterEach(() => jest.restoreAllMocks())

  describe('button row padding', () => {
    it('renders button row even when there are no attractions', () => {
      renderCell({ attractions: [] })
      expect(screen.getByRole('button', { name: /add attraction/i })).toBeInTheDocument()
    })

    it('renders button row when attractions are present', () => {
      renderCell({ attractions })
      expect(screen.getByRole('button', { name: /add attraction/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /preview attractions map/i })).toBeInTheDocument()
    })

    it('button row is in flow below tags', () => {
      const { container } = renderCell({ attractions })
      const buttonRow = container.querySelector('[data-testid="attraction-buttons"]')
      expect(buttonRow).toBeInTheDocument()
      expect(buttonRow).toHaveClass('opacity-0')
    })
  })

  describe('drag and drop', () => {
    const dt = { setData: jest.fn(), setDragImage: jest.fn(), dropEffect: '', effectAllowed: '' }

    it('renders drag handles on each attraction tag', () => {
      renderCell({ attractions })
      const handles = screen.getAllByLabelText(/drag to reorder/i)
      expect(handles).toHaveLength(3)
    })

    it('sets draggable attribute on attraction tags', () => {
      const { container } = renderCell({ attractions })
      const draggables = container.querySelectorAll('[draggable="true"]')
      expect(draggables.length).toBe(3)
    })

    it('reorders attractions on drag over', () => {
      renderCell({ attractions })
      // Get the draggable wrapper divs (parents of the grip handles)
      const items = screen.getAllByLabelText(/drag to reorder/i).map((h) => h.closest('[draggable="true"]')!)

      fireEvent.dragStart(items[0], { dataTransfer: dt })
      fireEvent.dragOver(items[2], { dataTransfer: dt })

      // All 3 tags should still be present
      expect(screen.getAllByLabelText(/drag to reorder/i)).toHaveLength(3)
    })

    it('saves reordered attractions to backend on drag end', () => {
      renderCell({ attractions })
      const items = screen.getAllByLabelText(/drag to reorder/i).map((h) => h.closest('[draggable="true"]')!)

      fireEvent.dragStart(items[0], { dataTransfer: dt })
      fireEvent.dragOver(items[2], { dataTransfer: dt })
      fireEvent.dragEnd(items[0])

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/attraction-update',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
