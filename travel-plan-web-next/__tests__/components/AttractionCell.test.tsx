import React from 'react'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import AttractionCell from '../../components/AttractionCell'
import type { RouteDay, DayAttraction } from '../../app/lib/itinerary'

jest.mock('@vercel/blob/client', () => ({
  upload: jest.fn(),
  handleUpload: jest.fn(),
}))

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

  describe('city anchors', () => {
    it('does not render cityAnchor as an attraction tag', () => {
      const cityAnchor = { label: 'Paris', lat: 48.8566, lng: 2.3522 }
      render(
        <table><tbody><tr>
          <AttractionCell dayIndex={0} day={{ ...baseDay, attractions: [] }} processedDay={baseDay} cityAnchor={cityAnchor} />
        </tr></tbody></table>
      )
      expect(screen.queryByLabelText(/drag to reorder/i)).not.toBeInTheDocument()
    })

    it('does not render prevCityAnchor as an attraction tag', () => {
      const prevCityAnchor = { label: 'Lyon', lat: 45.75, lng: 4.85 }
      render(
        <table><tbody><tr>
          <AttractionCell dayIndex={0} day={{ ...baseDay, attractions: [] }} processedDay={baseDay} prevCityAnchor={prevCityAnchor} />
        </tr></tbody></table>
      )
      expect(screen.queryByLabelText(/drag to reorder/i)).not.toBeInTheDocument()
    })
  })

  describe('minimap popover position', () => {
    it('does not jump when window.scrollY changes and a re-render occurs', async () => {
      // Simulate page scrolled to Y=300 when minimap opens
      Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true })
      Object.defineProperty(window, 'scrollX', { value: 0, configurable: true, writable: true })

      const day = { ...baseDay, attractions }
      render(
        <table><tbody><tr>
          <AttractionCell dayIndex={0} day={day} processedDay={day} />
        </tr></tbody></table>
      )

      // Open minimap
      const mapBtn = screen.getByRole('button', { name: /preview attractions map/i })
      await act(async () => { fireEvent.click(mapBtn) })

      const popover = document.body.querySelector('[data-testid="minimap-popover"]') as HTMLElement
      const topAtOpen = popover?.style.top

      // User scrolls further down — then a state update (e.g. keydown) causes a re-render
      ;(window as { scrollY: number }).scrollY = 800
      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' })
      })

      // Position must not have changed — window.scrollY must not be re-read from JSX
      expect(popover?.style.top).toBe(topAtOpen)
    })
  })

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

    it('does not open the image viewer immediately after dragging ends', () => {
      const withImages: DayAttraction[] = [
        { id: 'a1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 }, images: ['https://example.com/img.jpg'] },
        { id: 'a2', label: 'Notre-Dame', coordinates: { lat: 48.853, lng: 2.349 }, images: ['https://example.com/img2.jpg'] },
      ]
      renderCell({ attractions: withImages })
      const items = screen.getAllByLabelText(/drag to reorder/i).map((h) => h.closest('[draggable="true"]')!)

      fireEvent.dragStart(items[0], { dataTransfer: dt })
      fireEvent.dragEnd(items[0])

      // Mouse enters a tag immediately after drop — viewer must not open
      fireEvent.mouseEnter(items[1])
      expect(document.querySelector('[data-testid="viewer-outer"]')).not.toBeInTheDocument()
    })

    it('removes group/tag class from all tags while any drag is active', () => {
      renderCell({ attractions })
      const items = screen.getAllByLabelText(/drag to reorder/i).map((h) => h.closest('[draggable="true"]')!)

      fireEvent.dragStart(items[0], { dataTransfer: dt })

      // All tags lose group/tag during drag so hover buttons cannot appear on any tag
      items.forEach((item) => expect(item).not.toHaveClass('group/tag'))
    })

    it('hides the image viewer when dragging starts', () => {
      const withImages: DayAttraction[] = [
        { id: 'a1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 }, images: ['https://example.com/img.jpg'] },
        { id: 'a2', label: 'Notre-Dame', coordinates: { lat: 48.853, lng: 2.349 } },
      ]
      renderCell({ attractions: withImages })

      const items = screen.getAllByLabelText(/drag to reorder/i).map((h) => h.closest('[draggable="true"]')!)

      // Hover the tag with images to open the viewer
      fireEvent.mouseEnter(items[0])
      expect(document.querySelector('[data-testid="viewer-outer"]')).toBeInTheDocument()

      // Drag start should immediately hide the viewer
      fireEvent.dragStart(items[0], { dataTransfer: dt })
      expect(document.querySelector('[data-testid="viewer-outer"]')).not.toBeInTheDocument()
    })
  })

  describe('variant prop', () => {
    it('default variant renders outer <td>', () => {
      const { container } = renderCell()
      expect(container.querySelector('td')).not.toBeNull()
    })

    it('default variant does not render data-testid="attraction-card"', () => {
      renderCell()
      expect(screen.queryByTestId('attraction-card')).toBeNull()
    })

    it('card variant renders outer <div data-testid="attraction-card"> not <td>', () => {
      const { container } = render(
        <AttractionCell variant="card" dayIndex={0} day={baseDay} processedDay={baseDay} />
      )
      expect(container.querySelector('td')).toBeNull()
      expect(screen.getByTestId('attraction-card')).toBeInTheDocument()
    })

    it('card variant attraction-buttons does NOT have opacity-0 class', () => {
      render(
        <AttractionCell variant="card" dayIndex={0} day={baseDay} processedDay={baseDay} />
      )
      const buttons = screen.getByTestId('attraction-buttons')
      expect(buttons.className).not.toContain('opacity-0')
    })

    it('table-cell variant attraction-buttons HAS opacity-0 class', () => {
      renderCell()
      const buttons = screen.getByTestId('attraction-buttons')
      expect(buttons.className).toContain('opacity-0')
    })

    it('card variant slides in action buttons when tag is tapped', () => {
      const dayWithAttractions = { ...baseDay, attractions: [{ id: 'a1', label: 'Eiffel Tower' }] }
      render(
        <AttractionCell variant="card" dayIndex={0} day={dayWithAttractions} processedDay={dayWithAttractions} />
      )
      // Action bar collapsed by default
      const actionBar = screen.getByTestId('tag-actions-a1')
      expect(actionBar.className).toContain('max-w-0')
      expect(actionBar.className).toContain('opacity-0')

      // Tap the tag to expand action bar
      fireEvent.click(screen.getByText('Eiffel Tower'))
      expect(actionBar.className).toContain('max-w-[120px]')
      expect(actionBar.className).toContain('opacity-100')
    })

    it('table-cell variant per-tag image/remove buttons have opacity-0 class', () => {
      renderCell({ attractions: [{ id: 'a1', label: 'Eiffel Tower' }] })
      const imageBtn = screen.getByRole('button', { name: /add images for Eiffel Tower/i })
      const removeBtn = screen.getByRole('button', { name: /remove Eiffel Tower/i })
      expect(imageBtn.className).toContain('opacity-0')
      expect(removeBtn.className).toContain('opacity-0')
    })
  })

  describe('image lightbox', () => {
    it('lightbox remains open after mouse leaves the image viewer', async () => {
      const withImages: DayAttraction[] = [
        { id: 'a1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 }, images: ['https://example.com/img.jpg'] },
      ]
      renderCell({ attractions: withImages })

      // Hover the tag to open the viewer
      const tag = screen.getByLabelText(/drag to reorder/i).closest('[draggable="true"]')!
      fireEvent.mouseEnter(tag)
      expect(document.querySelector('[data-testid="viewer-outer"]')).toBeInTheDocument()

      // Click the thumbnail to open the lightbox
      fireEvent.click(screen.getByRole('img'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Mouse leaves the viewer (simulating cursor moving to the lightbox overlay)
      fireEvent.mouseLeave(tag)

      // Lightbox must still be visible even though viewer hide timer may fire
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
