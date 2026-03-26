import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ItineraryMobileView from '../../components/ItineraryMobileView'
import { processItinerary, type RouteDay } from '../../app/lib/itinerary'
import { getStaysWithMeta } from '../../app/lib/stayUtils'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@vercel/blob/client', () => ({
  upload: jest.fn(),
  handleUpload: jest.fn(),
}))

jest.mock('../../app/lib/locations/search', () => ({
  searchLocationSuggestions: jest.fn().mockResolvedValue({ results: [] }),
}))

jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: {
    Map: jest.fn(() => ({
      on: jest.fn(),
      addSource: jest.fn(),
      addLayer: jest.fn(),
      fitBounds: jest.fn(),
      remove: jest.fn(),
    })),
    Marker: jest.fn(() => ({ setLngLat: jest.fn().mockReturnThis(), setPopup: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis() })),
    Popup: jest.fn(() => ({ setText: jest.fn().mockReturnThis() })),
    LngLatBounds: jest.fn(() => ({ extend: jest.fn().mockReturnThis() })),
  },
}))

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

jest.mock('../../components/TrainScheduleDisplay', () => ({
  __esModule: true,
  default: ({ dayIndex }: { dayIndex: number }) => (
    <div data-testid={`mock-train-display-${dayIndex}`} />
  ),
}))

jest.mock('../../components/WeatherForecastModal', () => ({
  __esModule: true,
  default: ({ cityName, onClose }: { cityName: string; onClose: () => void }) => (
    <div data-testid="weather-forecast-modal">
      <span>{cityName}</span>
      <button onClick={onClose}>close weather</button>
    </div>
  ),
}))

jest.mock('../../components/CloudForecastModal', () => ({
  __esModule: true,
  default: ({ cityName, onClose }: { cityName: string; onClose: () => void }) => (
    <div data-testid="cloud-forecast-modal">
      <span>{cityName}</span>
      <button onClick={onClose}>close cloud</button>
    </div>
  ),
}))


// ── Fixtures ─────────────────────────────────────────────────────────────────

const twoStayDays: RouteDay[] = [
  { date: '2026/9/25', weekDay: '星期五', dayNum: 1, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
  { date: '2026/9/26', weekDay: '星期六', dayNum: 2, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
  { date: '2026/9/27', weekDay: '星期日', dayNum: 3, overnight: 'Rome', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
  { date: '2026/9/28', weekDay: '星期一', dayNum: 4, overnight: 'Rome', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
]

const resolvedLocationDay: RouteDay = {
  date: '2026/9/25', weekDay: '星期五', dayNum: 1, overnight: 'Paris',
  plan: { morning: '', afternoon: '', evening: '' }, train: [],
  location: {
    kind: 'resolved',
    label: 'Paris, France',
    queryText: 'Paris',
    coordinates: { lat: 48.85, lng: 2.35 },
    place: { placeId: 'geo:1', name: 'Paris', country: 'France', countryCode: 'FR', featureType: 'locality' },
  },
}

function makeMockNoteEditor(overrides: Partial<ReturnType<typeof makeMockNoteEditor>> = {}) {
  return {
    noteOverrides: {} as Record<number, string>,
    editingNoteIndex: null as number | null,
    noteEditingValue: '',
    setNoteEditingValue: jest.fn(),
    handleNoteEdit: jest.fn(),
    handleNoteBlur: jest.fn(),
    handleNoteKeyDown: jest.fn(),
    ...overrides,
  }
}

function makeMockTrainEditor() {
  return { open: jest.fn() }
}

function renderMobileView(
  days: RouteDay[] = twoStayDays,
  overrides: {
    noteEditor?: ReturnType<typeof makeMockNoteEditor>
    isItineraryScopedStayEdit?: boolean
    onRequestEditStay?: (i: number) => void
    onMoveStay?: (i: number, dir: 'up' | 'down') => void
    itineraryId?: string
  } = {}
) {
  const processedData = processItinerary(days)
  const stays = getStaysWithMeta(days)
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

  return render(
    <ItineraryMobileView
      processedData={processedData}
      stays={stays}
      days={days}
      itineraryId={overrides.itineraryId}
      trainOverrides={{}}
      trainSchedules={{}}
      schedulesLoading={false}
      noteEditor={overrides.noteEditor ?? makeMockNoteEditor()}
      trainEditor={makeMockTrainEditor() as ReturnType<typeof makeMockTrainEditor> & { open: jest.Mock }}
      isItineraryScopedStayEdit={overrides.isItineraryScopedStayEdit ?? false}
      onRequestEditStay={overrides.onRequestEditStay}
      onMoveStay={overrides.onMoveStay}
    />
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ItineraryMobileView', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('city section headers', () => {
    it('renders one section per stay', () => {
      renderMobileView()
      expect(screen.getByTestId('stay-section-0')).toBeInTheDocument()
      expect(screen.getByTestId('stay-section-1')).toBeInTheDocument()
      expect(screen.queryByTestId('stay-section-2')).not.toBeInTheDocument()
    })

    it('shows city name in each section header', () => {
      renderMobileView()
      const sec0 = screen.getByTestId('stay-section-0')
      const sec1 = screen.getByTestId('stay-section-1')
      expect(within(sec0).getByText('Paris')).toBeInTheDocument()
      expect(within(sec1).getByText('Rome')).toBeInTheDocument()
    })

    it('shows nights count in section header', () => {
      renderMobileView()
      const sec0 = screen.getByTestId('stay-section-0')
      expect(within(sec0).getByText(/2 nights/i)).toBeInTheDocument()
    })

    it('shows country tag when location is resolved with country', () => {
      const days = [resolvedLocationDay]
      renderMobileView(days)
      expect(screen.getByText('France')).toBeInTheDocument()
    })

    it('does not show country tag when location is absent', () => {
      renderMobileView(twoStayDays)
      // No location on baseDay → no country tags
      expect(screen.queryByText('France')).not.toBeInTheDocument()
    })

    it('always shows plain city name even when isItineraryScopedStayEdit=true', () => {
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true })
      const sec0 = screen.getByTestId('stay-section-0')
      expect(within(sec0).getByText('Paris')).toBeInTheDocument()
    })

    it('renders weather and cloud buttons in each section header', () => {
      renderMobileView()
      const weatherBtns = screen.getAllByRole('button', { name: /weather forecast for/i })
      const cloudBtns = screen.getAllByRole('button', { name: /cloud forecast for/i })
      expect(weatherBtns).toHaveLength(2) // one per stay
      expect(cloudBtns).toHaveLength(2)
    })

    it('weather/cloud buttons are disabled when no coordinates', () => {
      renderMobileView()
      const weatherBtns = screen.getAllByRole('button', { name: /weather forecast for/i })
      weatherBtns.forEach((btn) => expect(btn).toBeDisabled())
    })

    it('weather/cloud buttons are enabled when location has coordinates', () => {
      const days = [resolvedLocationDay]
      renderMobileView(days)
      const weatherBtn = screen.getByRole('button', { name: /weather forecast for Paris/i })
      const cloudBtn = screen.getByRole('button', { name: /cloud forecast for Paris/i })
      expect(weatherBtn).not.toBeDisabled()
      expect(cloudBtn).not.toBeDisabled()
    })

    it('opens weather modal on button click', () => {
      const days = [resolvedLocationDay]
      renderMobileView(days)
      fireEvent.click(screen.getByRole('button', { name: /weather forecast for Paris/i }))
      expect(screen.getByTestId('weather-forecast-modal')).toBeInTheDocument()
    })

    it('opens cloud modal on button click', () => {
      const days = [resolvedLocationDay]
      renderMobileView(days)
      fireEvent.click(screen.getByRole('button', { name: /cloud forecast for Paris/i }))
      expect(screen.getByTestId('cloud-forecast-modal')).toBeInTheDocument()
    })
  })

  describe('day cards', () => {
    it('renders one card per day', () => {
      renderMobileView()
      for (let i = 0; i < twoStayDays.length; i++) {
        expect(screen.getByTestId(`day-card-${i}`)).toBeInTheDocument()
      }
    })

    it('renders date in each card', () => {
      renderMobileView()
      expect(screen.getByTestId('day-card-0').textContent).toContain('2026/9/25')
      expect(screen.getByTestId('day-card-2').textContent).toContain('2026/9/27')
    })

    it('renders weekday in each card', () => {
      renderMobileView()
      expect(screen.getByTestId('day-card-0').textContent).toContain('星期五')
    })

    it('renders AttractionCell with variant="card" (data-testid="attraction-card") per day', () => {
      renderMobileView()
      const cards = screen.getAllByTestId('attraction-card')
      expect(cards).toHaveLength(twoStayDays.length)
    })

    it('renders TrainScheduleDisplay for each day', () => {
      renderMobileView()
      for (let i = 0; i < twoStayDays.length; i++) {
        expect(screen.getByTestId(`mock-train-display-${i}`)).toBeInTheDocument()
      }
    })
  })

  describe('note display and editing', () => {
    it('renders note text when noteOverrides has a value', () => {
      const noteEditor = makeMockNoteEditor({ noteOverrides: { 0: 'my travel note' } })
      renderMobileView(twoStayDays, { noteEditor })
      expect(screen.getByText('my travel note')).toBeInTheDocument()
    })

    it('renders note text from day.note', () => {
      const days = twoStayDays.map((d, i) => i === 1 ? { ...d, note: 'day2 note' } : d)
      renderMobileView(days)
      expect(screen.getByText('day2 note')).toBeInTheDocument()
    })

    it('pencil button does NOT have opacity-0 class (always visible in card mode)', () => {
      renderMobileView()
      const pencilBtns = screen.getAllByRole('button', { name: /edit note/i })
      pencilBtns.forEach((btn) => {
        expect(btn.className).not.toContain('opacity-0')
      })
    })

    it('clicking pencil calls handleNoteEdit with correct dayIndex and current note', () => {
      const noteEditor = makeMockNoteEditor()
      renderMobileView(twoStayDays, { noteEditor })
      const pencilBtns = screen.getAllByRole('button', { name: /edit note/i })
      fireEvent.click(pencilBtns[0])
      expect(noteEditor.handleNoteEdit).toHaveBeenCalledWith(0, '')
    })

    it('renders textarea when editingNoteIndex matches dayIndex', () => {
      const noteEditor = makeMockNoteEditor({ editingNoteIndex: 1, noteEditingValue: 'editing...' })
      renderMobileView(twoStayDays, { noteEditor })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea).toBeInTheDocument()
      expect(textarea.value).toBe('editing...')
    })

    it('blur on textarea calls handleNoteBlur with dayIndex', () => {
      const noteEditor = makeMockNoteEditor({ editingNoteIndex: 0, noteEditingValue: 'test' })
      renderMobileView(twoStayDays, { noteEditor })
      const textarea = screen.getByRole('textbox')
      fireEvent.blur(textarea)
      expect(noteEditor.handleNoteBlur).toHaveBeenCalledWith(0)
    })

    it('Escape key on textarea calls handleNoteKeyDown', () => {
      const noteEditor = makeMockNoteEditor({ editingNoteIndex: 0, noteEditingValue: 'test' })
      renderMobileView(twoStayDays, { noteEditor })
      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Escape' })
      expect(noteEditor.handleNoteKeyDown).toHaveBeenCalled()
    })
  })

  describe('stay action buttons', () => {
    it('edit stay button calls onRequestEditStay with correct stayIndex', () => {
      const onRequestEditStay = jest.fn()
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true, onRequestEditStay })
      const editBtns = screen.getAllByRole('button', { name: /edit stay for/i })
      fireEvent.click(editBtns[0]) // first stay
      expect(onRequestEditStay).toHaveBeenCalledWith(0)
    })

    it('move-up button does not appear for the first stay', () => {
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true })
      // First stay has no move-up button
      const sec0 = screen.getByTestId('stay-section-0')
      expect(within(sec0).queryByRole('button', { name: /move.*up/i })).not.toBeInTheDocument()
    })

    it('move-up button appears for stays after the first', () => {
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true })
      const sec1 = screen.getByTestId('stay-section-1')
      expect(within(sec1).getByRole('button', { name: /move.*up/i })).toBeInTheDocument()
    })

    it('move-down button does not appear for the last stay', () => {
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true })
      const sec1 = screen.getByTestId('stay-section-1')
      expect(within(sec1).queryByRole('button', { name: /move.*down/i })).not.toBeInTheDocument()
    })

    it('move-down button appears for stays before the last', () => {
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true })
      const sec0 = screen.getByTestId('stay-section-0')
      expect(within(sec0).getByRole('button', { name: /move.*down/i })).toBeInTheDocument()
    })

    it('move-up calls onMoveStay with correct args', () => {
      const onMoveStay = jest.fn()
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true, onMoveStay })
      const sec1 = screen.getByTestId('stay-section-1')
      fireEvent.click(within(sec1).getByRole('button', { name: /move.*up/i }))
      expect(onMoveStay).toHaveBeenCalledWith(1, 'up')
    })

    it('move-down calls onMoveStay with correct args', () => {
      const onMoveStay = jest.fn()
      renderMobileView(twoStayDays, { isItineraryScopedStayEdit: true, onMoveStay })
      const sec0 = screen.getByTestId('stay-section-0')
      fireEvent.click(within(sec0).getByRole('button', { name: /move.*down/i }))
      expect(onMoveStay).toHaveBeenCalledWith(0, 'down')
    })
  })
})
