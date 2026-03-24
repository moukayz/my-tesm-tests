import React from 'react'
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItineraryTab from '../../components/ItineraryTab'
import type { RouteDay } from '../../app/lib/itinerary'

// Mock fileSave and itineraryExport for export integration tests
jest.mock('../../app/lib/fileSave', () => ({
  saveFile: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../app/lib/itineraryExport', () => ({
  buildMarkdownTable: jest.fn().mockReturnValue('| Overnight | Date | Day | Train Schedule | Note |\n|---|---|---|---|---|\n| 巴黎 | 2026/9/25 | 1 | — | |'),
  buildPdfBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
}))

jest.mock('../../components/AttractionMiniMap', () => ({
  __esModule: true,
  default: ({ attractions }: { attractions: { id: string }[] }) =>
    attractions.length === 0 || attractions.every((a: { coordinates?: unknown }) => !a.coordinates)
      ? <div data-testid="attraction-minimap-placeholder">No location data</div>
      : <div data-testid="attraction-minimap">MiniMap</div>,
}))

jest.mock('../../app/lib/locations/search', () => ({
  searchLocationSuggestions: jest.fn().mockResolvedValue({ results: [] }),
}))

import { saveFile } from '../../app/lib/fileSave'
import { buildMarkdownTable, buildPdfBlob } from '../../app/lib/itineraryExport'

const mockRouteData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'e2e-morning', afternoon: 'e2e-afternoon', evening: 'e2e-evening' },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: { morning: 'Day 2 morning', afternoon: 'Day 2 afternoon', evening: 'Day 2 evening' },
    train: [{ train_id: 'TGV 456' }],
  },
  {
    date: '2026/9/27',
    weekDay: '星期日',
    dayNum: 3,
    overnight: '科隆',
    plan: { morning: 'Day 3 morning', afternoon: 'Day 3 afternoon', evening: 'Day 3 evening' },
    train: [{ train_id: 'ICE 123', start: 'augsburg', end: 'munich' }],
  },
]

function getDbTrainCount(routeData: RouteDay[]) {
  return routeData.flatMap((day) => day.train).filter((train) => train.start && train.end).length
}

function setupFetch(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {}
  const responses = { ...defaults, ...overrides }
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const path = url.toString().split('?')[0].replace('http://localhost', '')
    return Promise.resolve({
      json: () => Promise.resolve(responses[path] ?? null),
    } as Response)
  })
}

describe('ItineraryTab', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renders all table header columns', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^country$/i })).not.toBeInTheDocument()
    expect(screen.getByText('Overnight')).toBeInTheDocument()
    expect(screen.getByText('Train Schedule')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('thead has sticky class for always-visible column headers on scroll', () => {
    setupFetch()
    const { container } = render(<ItineraryTab initialData={mockRouteData} />)
    const thead = container.querySelector('thead')
    expect(thead).toHaveClass('sticky')
  })

  it('renders floating Add next stay button and calls onRequestAddStay on click', async () => {
    setupFetch()
    const onRequestAddStay = jest.fn()
    render(<ItineraryTab initialData={mockRouteData} onRequestAddStay={onRequestAddStay} />)
    await userEvent.click(screen.getByRole('button', { name: /add next stay/i }))
    expect(onRequestAddStay).toHaveBeenCalledTimes(1)
  })

  it('does not render Add next stay button when onRequestAddStay is not provided', () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    expect(screen.queryByRole('button', { name: /add next stay/i })).not.toBeInTheDocument()
  })

  it('shows country from resolved location in country cell', async () => {
    setupFetch()
    const dataWithResolvedLocation: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: 'Paris, Île-de-France, France',
        location: {
          kind: 'resolved',
          label: 'Paris, Île-de-France, France',
          queryText: 'Paris',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: { placeId: 'geonames:2988507', name: 'Paris', region: 'Île-de-France', country: 'France', countryCode: 'FR', featureType: 'locality' },
        },
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      },
    ]
    render(<ItineraryTab initialData={dataWithResolvedLocation} />)
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('shows no country tag in overnight cell when location is absent', async () => {
    setupFetch()
    const dataNoLocation: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: 'SomeCity',
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      },
    ]
    render(<ItineraryTab initialData={dataNoLocation} />)
    // Country tag should not appear when there is no resolved location
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(screen.getByText('SomeCity')).toBeInTheDocument()
  })

  it('shows country tag per overnight row (no merging)', async () => {
    setupFetch()
    const makeResolved = (name: string, country: string): RouteDay['location'] => ({
      kind: 'resolved',
      label: `${name}, ${country}`,
      queryText: name,
      coordinates: { lat: 0, lng: 0 },
      place: { placeId: `id-${name}`, name, country, featureType: 'locality' },
    })
    const multiCountryData: RouteDay[] = [
      { date: '2026/9/25', weekDay: '一', dayNum: 1, overnight: 'Paris', location: makeResolved('Paris', 'France'), plan: { morning: '', afternoon: '', evening: '' }, train: [] },
      { date: '2026/9/26', weekDay: '二', dayNum: 2, overnight: 'Rome', location: makeResolved('Rome', 'Italy'), plan: { morning: '', afternoon: '', evening: '' }, train: [] },
      { date: '2026/9/27', weekDay: '三', dayNum: 3, overnight: 'Milan', location: makeResolved('Milan', 'Italy'), plan: { morning: '', afternoon: '', evening: '' }, train: [] },
    ]
    render(<ItineraryTab initialData={multiCountryData} />)
    // France tag appears once (Paris), Italy tag appears twice (Rome + Milan) — one per overnight cell
    expect(screen.getAllByText('France')).toHaveLength(1)
    expect(screen.getAllByText('Italy')).toHaveLength(2)
  })

  it('shows only city name in overnight cell for resolved location', async () => {
    setupFetch()
    const dataResolved: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: 'Paris, Île-de-France, France',
        location: {
          kind: 'resolved',
          label: 'Paris, Île-de-France, France',
          queryText: 'Paris',
          coordinates: { lat: 48.85, lng: 2.35 },
          place: { placeId: 'geonames:2988507', name: 'Paris', region: 'Île-de-France', country: 'France', featureType: 'locality' },
        },
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      },
    ]
    render(<ItineraryTab initialData={dataResolved} />)
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.queryByText('Paris, Île-de-France, France')).not.toBeInTheDocument()
  })

  it('shows overnight string as-is for custom or absent location', async () => {
    setupFetch()
    const dataCustom: RouteDay[] = [
      {
        date: '2026/9/25',
        weekDay: '星期五',
        dayNum: 1,
        overnight: 'CustomCity',
        plan: { morning: '', afternoon: '', evening: '' },
        train: [],
      },
    ]
    render(<ItineraryTab initialData={dataCustom} />)
    expect(screen.getByText('CustomCity')).toBeInTheDocument()
  })

  it('exposes primary itinerary panel locator with Date column header', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)

    const panel = screen.getByTestId('itinerary-tab')
    expect(within(panel).getByRole('columnheader', { name: /^date$/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders a row for every entry in initialData', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    const dateCells = screen.getAllByText(/^\d{4}\/\d+\/\d+$/)
    expect(dateCells).toHaveLength(mockRouteData.length)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders a dash for days with no train schedule', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('shows a loading spinner for each pending train schedule while fetching', () => {
    const dataWithTrain: RouteDay[] = [
      {
        date: '2026/9/27',
        weekDay: '星期日',
        dayNum: 3,
        overnight: '科隆',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [{ train_id: 'ICE 123', start: 'augsburg', end: 'munich' }],
      },
    ]
    global.fetch = jest.fn(() => new Promise(() => {})) // never resolves
    render(<ItineraryTab initialData={dataWithTrain} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders train schedule as a list for days that have trains', async () => {
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Augsburg Hbf',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 07:14:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Munich Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 08:04:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    // Find a day with a DB train (has start/end) to verify the train tag renders
    const dayWithDbTrain = mockRouteData.find((d) =>
      d.train.some((t) => t.start && t.end)
    )!
    const dbTrainEntry = dayWithDbTrain.train.find((t) => t.start && t.end)!
    await waitFor(() => {
      expect(screen.getByText(dbTrainEntry.train_id)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders overnight location cells with merged rowspans', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    const uniqueLocations = [...new Set(mockRouteData.map((d) => d.overnight))].filter(
      (l) => l !== '—'
    )
    for (const location of uniqueLocations) {
      expect(screen.getAllByText(location).length).toBeGreaterThan(0)
    }
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('fetches train schedule for DB trains', async () => {
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Paris Est',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 08:00:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Cologne Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 12:30:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/timetable'))
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('displays non-DB trains as a comment without fetching', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    const dbTrainCount = getDbTrainCount(mockRouteData)
    const allTrains = mockRouteData.flatMap((day) => day.train)
    const nonDbTrain = allTrains.find((train) => !train.start || !train.end)
    if (!nonDbTrain) {
      expect(allTrains.every((train) => train.start && train.end)).toBe(true)
      return
    }
    await waitFor(() => {
      const comments = screen.getAllByTestId('invalid-train-comment')
      const commentTexts = comments.map((c) => c.textContent)
      expect(commentTexts.some((t) => t?.includes(nonDbTrain.train_id))).toBe(true)
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })
})

function setupFetchWithPlanUpdate(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/api/timetable': null,
    '/api/note-update': { success: true },
    ...overrides,
  }
  global.fetch = jest.fn((url: RequestInfo | URL, options?: RequestInit) => {
    const path = url.toString().split('?')[0].replace('http://localhost', '')
    return Promise.resolve({
      json: () => Promise.resolve(responses[path] ?? null),
      ok: true,
      status: 200,
    } as Response)
  })
}

async function renderAndAwaitSchedules() {
  const dbTrainCount = getDbTrainCount(mockRouteData)
  render(<ItineraryTab initialData={mockRouteData} />)
  if (dbTrainCount > 0) {
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount))
  }
  return mockRouteData
}

describe('ItineraryTab - TGV/EST Railway Fetching', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetches TGV trains with railway=french query param', async () => {
    const tgvData: RouteDay[] = [
      {
        date: '2026/9/28',
        weekDay: '星期一',
        dayNum: 4,
        overnight: '里昂',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [{ train_id: 'TGV9242', start: 'paris', end: 'lyon' }],
      },
    ]
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Paris Gare de Lyon',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '08:00:00',
          ride_date: null,
        },
        {
          station_name: 'Lyon Part-Dieu',
          station_num: 2,
          arrival_planned_time: '10:00:00',
          departure_planned_time: null,
          ride_date: null,
        },
      ],
    })
    render(<ItineraryTab initialData={tgvData} />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('railway=french')
      )
    })
  })

  it('fetches EST trains with railway=eurostar query param', async () => {
    const estData: RouteDay[] = [
      {
        date: '2026/9/29',
        weekDay: '星期二',
        dayNum: 5,
        overnight: '伦敦',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [{ train_id: 'EST9023', start: 'paris', end: 'london' }],
      },
    ]
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Paris Nord',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '07:00:00',
          ride_date: null,
        },
        {
          station_name: 'London St Pancras',
          station_num: 2,
          arrival_planned_time: '08:30:00',
          departure_planned_time: null,
          ride_date: null,
        },
      ],
    })
    render(<ItineraryTab initialData={estData} />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('railway=eurostar')
      )
    })
  })

  it('fetches German ICE trains without a railway param', async () => {
    const iceData: RouteDay[] = [
      {
        date: '2026/9/27',
        weekDay: '星期日',
        dayNum: 3,
        overnight: '科隆',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [{ train_id: 'ICE 123', start: 'augsburg', end: 'munich' }],
      },
    ]
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Augsburg Hbf',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 07:14:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Munich Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 08:04:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    render(<ItineraryTab initialData={iceData} />)
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const timetableCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('/api/timetable')
      )
      expect(timetableCalls.length).toBe(1)
      expect(timetableCalls[0][0]).not.toContain('railway=')
    })
  })

  it('fetches both TGV and ICE trains in the same itinerary with correct railway params', async () => {
    const mixedData: RouteDay[] = [
      {
        date: '2026/9/28',
        weekDay: '星期一',
        dayNum: 4,
        overnight: '里昂',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [
          { train_id: 'TGV9242', start: 'paris', end: 'lyon' },
          { train_id: 'ICE 905', start: 'cologne', end: 'munich' },
        ],
      },
    ]
    setupFetch({ '/api/timetable': [] })
    render(<ItineraryTab initialData={mixedData} />)
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const timetableCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('/api/timetable')
      )
      expect(timetableCalls.length).toBe(2)
      const tgvCall = timetableCalls.find((c: unknown[]) =>
        (c[0] as string).includes('TGV')
      )
      const iceCall = timetableCalls.find((c: unknown[]) =>
        (c[0] as string).includes('ICE')
      )
      expect(tgvCall).toBeDefined()
      expect((tgvCall as unknown[])[0]).toContain('railway=french')
      expect(iceCall).toBeDefined()
      expect((iceCall as unknown[])[0]).not.toContain('railway=')
    })
  })
})

describe('ItineraryTab - Train Schedule Tag Presentation', () => {
  afterEach(() => jest.restoreAllMocks())

  // ── Tag vs plain-text rules ──────────────────────────────────────────────

  it('renders DB train number (with start/end) as a tag/badge', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    await waitFor(() => {
      const tags = screen.getAllByTestId('train-tag')
      const tagTexts = tags.map((t) => t.textContent)
      // ICE 123 has start/end → should be a tag
      expect(tagTexts).toContain('ICE 123')
    })
  })

  it('renders non-DB train number (no start/end) as a dash with a comment, NOT as a tag', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    const dbTrainCount = getDbTrainCount(mockRouteData)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount))

    const tags = screen.queryAllByTestId('train-tag')
    const tagTexts = tags.map((t) => t.textContent)
    // TGV 456 has no start/end → must NOT be a tag
    expect(tagTexts).not.toContain('TGV 456')
    // The schedule cell shows a dash for the invalid/informal train
    const dashes = screen.getAllByTestId('invalid-train-dash')
    expect(dashes.length).toBeGreaterThan(0)
    // The train id must still appear as a comment
    const comments = screen.getAllByTestId('invalid-train-comment')
    const commentTexts = comments.map((c) => c.textContent)
    expect(commentTexts.some((t) => t?.includes('TGV 456'))).toBe(true)
  })

  it('non-DB train comment appears at the bottom of the cell, after the dash', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    const dbTrainCount = getDbTrainCount(mockRouteData)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount))

    const comment = screen.getAllByTestId('invalid-train-comment')[0]
    const dash = screen.getAllByTestId('invalid-train-dash')[0]
    // comment should come after dash in DOM order
    expect(
      dash.compareDocumentPosition(comment) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders multiple DB trains as tags and non-DB trains as plain text', async () => {
    const mixedData: RouteDay[] = [
      {
        date: '2026/9/28',
        weekDay: '星期一',
        dayNum: 4,
        overnight: '里昂',
        plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
        train: [
          { train_id: 'TGV 8088', start: 'paris', end: 'lyon' },
          { train_id: 'ICE 505' },
        ],
      },
    ]
    setupFetch({ '/api/timetable': [] })
    render(<ItineraryTab initialData={mixedData} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const tags = screen.getAllByTestId('train-tag')
    const tagTexts = tags.map((t) => t.textContent)
    expect(tagTexts).toContain('TGV 8088')
    expect(tagTexts).not.toContain('ICE 505')
    // ICE 505 has no start/end → shown as comment under a dash, not as plain inline text or tag
    const comments = screen.getAllByTestId('invalid-train-comment')
    const commentTexts = comments.map((c) => c.textContent)
    expect(commentTexts.some((t) => t?.includes('ICE 505'))).toBe(true)
    expect(document.querySelector('ol')).toBeNull()
  })

  // ── Schedule content: station names + times ──────────────────────────────

  it('does NOT render "Start:" or "End:" labels in schedule rows', async () => {
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Augsburg Hbf',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 07:14:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Munich Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 08:04:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    render(<ItineraryTab initialData={mockRouteData} />)
    // Wait until schedule has fully loaded (station names must be present)
    await waitFor(() => {
      expect(screen.getByText('Augsburg Hbf')).toBeInTheDocument()
      expect(screen.getByText('Munich Hbf')).toBeInTheDocument()
    })
    // Now assert labels are absent
    expect(screen.queryByText(/^Start:$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^End:$/)).not.toBeInTheDocument()
  })

  it('renders departure time next to the Start station name', async () => {
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Augsburg Hbf',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 07:14:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Munich Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 08:04:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    render(<ItineraryTab initialData={mockRouteData} />)
    await waitFor(() => {
      expect(screen.getByText('Augsburg Hbf')).toBeInTheDocument()
      expect(screen.getByText('07:14')).toBeInTheDocument()
      expect(screen.getByText('Munich Hbf')).toBeInTheDocument()
      expect(screen.getByText('08:04')).toBeInTheDocument()
    })
  })

  // ── Time alignment: label / station / time in separate grid cells ────────

  it('renders schedule rows inside a grid container for alignment', async () => {
    setupFetch({
      '/api/timetable': [
        {
          station_name: 'Augsburg Hbf',
          station_num: 1,
          arrival_planned_time: null,
          departure_planned_time: '2026-02-09 07:14:00',
          ride_date: '2026-02-09',
        },
        {
          station_name: 'Munich Hbf',
          station_num: 2,
          arrival_planned_time: '2026-02-09 08:04:00',
          departure_planned_time: null,
          ride_date: '2026-02-09',
        },
      ],
    })
    render(<ItineraryTab initialData={mockRouteData} />)
    await waitFor(() => {
      const grid = document.querySelector('[data-testid="schedule-grid"]')
      expect(grid).not.toBeNull()
    })
  })
})
describe('ItineraryTab - Train Schedule Editor', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renders edit button for each day', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    for (let i = 0; i < mockRouteData.length; i++) {
      expect(screen.getByTestId(`train-json-edit-btn-${i}`)).toBeInTheDocument()
    }
  })

  it('editor dialog is closed by default', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    expect(screen.queryByTestId('train-schedule-editor-modal')).not.toBeInTheDocument()
  })

  it('clicking edit button opens structured train editor dialog', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))

    expect(screen.getByTestId('train-schedule-editor-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('train-json-content')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /edit train schedule/i })).toBeInTheDocument()
  })

  it('editor shows existing row fields for clicked day', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-2'))
    expect(screen.getByDisplayValue('ICE 123')).toBeInTheDocument()
    expect(screen.getByDisplayValue('augsburg')).toBeInTheDocument()
    expect(screen.getByDisplayValue('munich')).toBeInTheDocument()
  })

  it('cancel button closes editor dialog', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    expect(screen.getByTestId('train-schedule-editor-modal')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('train-editor-cancel'))
    expect(screen.queryByTestId('train-schedule-editor-modal')).not.toBeInTheDocument()
  })

  it('Escape key closes editor dialog', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    expect(screen.getByTestId('train-schedule-editor-modal')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('train-schedule-editor-modal')).not.toBeInTheDocument()
    })
  })

  it('shows empty state for day with no trains and supports add row', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    expect(screen.getByText(/no trains added for this day/i)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    expect(screen.getByLabelText(/train id for row 1/i)).toBeInTheDocument()
  })

  it('dialog has accessibility attributes', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('validates blank train_id before save', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    await userEvent.click(screen.getByTestId('train-editor-save'))

    expect(screen.getByText(/train id is required/i)).toBeInTheDocument()
    const calls = (global.fetch as jest.Mock).mock.calls.filter((c) => c[0] === '/api/train-update')
    expect(calls).toHaveLength(0)
  })

  it('validates half-filled start/end pair before save', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    await userEvent.type(screen.getByLabelText(/train id for row 1/i), 'ICE 505')
    await userEvent.type(screen.getByLabelText(/start station for row 1/i), 'Berlin')
    await userEvent.click(screen.getByTestId('train-editor-save'))

    expect(screen.getByText(/start and end must both be filled/i)).toBeInTheDocument()
    const calls = (global.fetch as jest.Mock).mock.calls.filter((c) => c[0] === '/api/train-update')
    expect(calls).toHaveLength(0)
  })

  it('save posts serialized trainJson for add flow', async () => {
    setupFetchWithPlanUpdate({ '/api/train-update': { train: [{ train_id: 'ICE999' }] } })
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    await userEvent.type(screen.getByLabelText(/train id for row 1/i), 'ICE999')
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/train-update',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ dayIndex: 0, trainJson: '[{"train_id":"ICE999"}]' }),
        })
      )
    })
  })

  it('save supports reordering rows and persists new order', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return Promise.resolve({
          json: () => Promise.resolve({
            train: [
              { train_id: 'ICE 200', start: 'Paris', end: 'Lyon' },
              { train_id: 'ICE 100', start: 'Berlin', end: 'Munich' },
            ],
          }),
          ok: true,
          status: 200,
        } as Response)
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    const reorderData: RouteDay[] = [
      {
        date: '2026/9/27',
        weekDay: '星期日',
        dayNum: 3,
        overnight: '科隆',
        plan: { morning: 'm', afternoon: 'a', evening: 'e' },
        train: [
          { train_id: 'ICE 100', start: 'Berlin', end: 'Munich' },
          { train_id: 'ICE 200', start: 'Paris', end: 'Lyon' },
        ],
      },
    ]
    render(<ItineraryTab initialData={reorderData} />)

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    const firstRow = screen.getByTestId('train-editor-row-1')
    const secondRow = screen.getByTestId('train-editor-row-2')
    const dragEvent = { dataTransfer: { effectAllowed: 'move' } }
    fireEvent.dragStart(firstRow, dragEvent)
    fireEvent.dragOver(secondRow, dragEvent)
    fireEvent.drop(secondRow, dragEvent)
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const saveCall = calls.find((call) => call[0] === '/api/train-update')
      expect(saveCall).toBeDefined()
      const body = JSON.parse(saveCall![1].body)
      expect(body.trainJson).toBe(
        '[{"train_id":"ICE 200","start":"Paris","end":"Lyon"},{"train_id":"ICE 100","start":"Berlin","end":"Munich"}]'
      )
    })
  })

  it('successful save closes editor and updates table with new train data', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return Promise.resolve({
          json: () => Promise.resolve({ train: [{ train_id: 'ICE999', start: 'berlin', end: 'munich' }] }),
          ok: true,
          status: 200,
        } as Response)
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    await userEvent.type(screen.getByLabelText(/train id for row 1/i), 'ICE999')
    await userEvent.type(screen.getByLabelText(/start station for row 1/i), 'berlin')
    await userEvent.type(screen.getByLabelText(/end station for row 1/i), 'munich')
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      expect(screen.queryByTestId('train-schedule-editor-modal')).not.toBeInTheDocument()
      expect(screen.getByText('ICE 999')).toBeInTheDocument()
    })
  })

  it('save supports remove-all and sends empty array', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return Promise.resolve({
          json: () => Promise.resolve({ train: [] }),
          ok: true,
          status: 200,
        } as Response)
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-2'))
    await userEvent.click(screen.getByTestId('train-editor-delete-1'))
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const saveCall = calls.find((call) => call[0] === '/api/train-update')
      expect(saveCall).toBeDefined()
      const body = JSON.parse(saveCall![1].body)
      expect(body.trainJson).toBe('[]')
    })
  })

  it('removes legacy up/down row controls and keeps row-end delete action', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-2'))

    expect(screen.queryByTestId('train-editor-move-up-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('train-editor-move-down-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('train-editor-delete-1')).toBeInTheDocument()
  })

  it('API error keeps editor open and shows save error', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return Promise.resolve({
          json: () => Promise.resolve({ error: 'Failed to save' }),
          ok: false,
          status: 400,
        } as Response)
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-add-row'))
    await userEvent.type(screen.getByLabelText(/train id for row 1/i), 'ICE999')
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      expect(screen.getByTestId('train-editor-save-error')).toBeInTheDocument()
      expect(screen.getByTestId('train-editor-save-error')).toHaveTextContent('Failed to save')
      expect(screen.getByTestId('train-schedule-editor-modal')).toBeInTheDocument()
      expect(screen.getByDisplayValue('ICE999')).toBeInTheDocument()
    })
  })

  it('Save button is disabled while saving', async () => {
    let resolvePromise: (value: Response) => void
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      expect(screen.getByTestId('train-editor-save')).toBeDisabled()
    })

    // Clean up: resolve the pending promise
    resolvePromise!({
      json: () => Promise.resolve({ train: [] }),
      ok: true,
      status: 200,
    } as Response)
  })

  it('Cancel button is disabled while saving', async () => {
    let resolvePromise: (value: Response) => void
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/train-update') {
        return new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    await renderAndAwaitSchedules()

    await userEvent.click(screen.getByTestId('train-json-edit-btn-0'))
    await userEvent.click(screen.getByTestId('train-editor-save'))

    await waitFor(() => {
      expect(screen.getByTestId('train-editor-cancel')).toBeDisabled()
    })

    // Clean up: resolve the pending promise
    resolvePromise!({
      json: () => Promise.resolve({ train: [] }),
      ok: true,
      status: 200,
    } as Response)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests: Export flow
// ─────────────────────────────────────────────────────────────────────────────

describe('ItineraryTab - Export Feature', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  function setupExportFetch() {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    )
  }

  // ── T1-S3-12: export-fab present; export-button removed ──────────────────

  it('T1-S3-12: data-testid="export-fab" is in DOM (FAB replaces inline export-button)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    expect(screen.getByTestId('export-fab')).toBeInTheDocument()
  })

  it('T1-S3-13: data-testid="export-button" is NOT in DOM (inline toolbar removed)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    expect(screen.queryByTestId('export-button')).not.toBeInTheDocument()
  })

  it('T1-S3-14: clicking export-fab opens picker (export-format-picker visible, pdf disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))

    expect(screen.getByTestId('export-format-picker')).toBeInTheDocument()
    expect(screen.getByTestId('export-md')).toBeInTheDocument()
    // PDF button is present but disabled (temporarily unavailable)
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('export-pdf')).toBeDisabled()
  })

  it('T1-S3-15: export-fab disabled when initialData=[]', () => {
    setupExportFetch()
    render(<ItineraryTab initialData={[]} />)
    expect(screen.getByTestId('export-fab')).toBeDisabled()
  })

  it('clicking Markdown triggers buildMarkdownTable and saveFile with .md filename', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(buildMarkdownTable).toHaveBeenCalled()
      expect(saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'itinerary.md' })
      )
    })
  })

  it('clicking Markdown closes the picker after export', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-format-picker')).not.toBeInTheDocument()
    })
  })

  it('clicking PDF button does NOT trigger buildPdfBlob or saveFile (PDF export temporarily disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    // Attempt to click the (disabled) PDF button
    fireEvent.click(screen.getByTestId('export-pdf'))
    // Neither buildPdfBlob nor saveFile should be called
    await new Promise((r) => setTimeout(r, 100))
    expect(buildPdfBlob).not.toHaveBeenCalled()
    expect(saveFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'itinerary.pdf' })
    )
  })

  it('PDF button is disabled in the picker (PDF export temporarily disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    expect(screen.getByTestId('export-pdf')).toBeDisabled()
  })

  it('Markdown export works independently of PDF being disabled', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)

    // Markdown should work without any PDF involvement
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'itinerary.md' })
      )
    })
  })

  it('AbortError from saveFile closes picker silently with no error banner', async () => {
    setupExportFetch()
    ;(saveFile as jest.Mock).mockRejectedValueOnce(
      Object.assign(new DOMException('cancelled', 'AbortError'))
    )
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-format-picker')).not.toBeInTheDocument()
      expect(screen.queryByTestId('export-pdf-error')).not.toBeInTheDocument()
    })
  })

  // ── Slice 1 — Success Toast (T1-S1-11 through T1-S1-15) ─────────────────

  it('T1-S1-11: after Markdown success, export-success-toast is shown', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.getByTestId('export-success-toast')).toBeInTheDocument()
    })
  })

  it('T1-S1-12: clicking PDF button does NOT show success toast (PDF export temporarily disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-pdf'))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
  })

  it('T1-S1-13: no toast when saveFile throws AbortError', async () => {
    setupExportFetch()
    ;(saveFile as jest.Mock).mockRejectedValueOnce(
      Object.assign(new DOMException('cancelled', 'AbortError'))
    )
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-format-picker')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
  })

  it('T1-S1-14: no toast and no error banner when PDF is clicked (PDF export temporarily disabled — no-op)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-pdf'))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByTestId('export-pdf-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
  })

  it('T1-S1-15: toast disappears after clicking dismiss button', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.getByTestId('export-success-toast')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('export-toast-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stay Edit feature tests (editable-itinerary-stays)
// ─────────────────────────────────────────────────────────────────────────────

/** Mock data with 2 distinct stays: Paris (2 nights) → Cologne (1 night) */
const stayMockData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: 'Paris',
    plan: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: 'Paris',
    plan: { morning: 'Morning2', afternoon: 'Afternoon2', evening: 'Evening2' },
    train: [],
  },
  {
    date: '2026/9/27',
    weekDay: '星期日',
    dayNum: 3,
    overnight: 'Cologne',
    plan: { morning: 'Morning3', afternoon: 'Afternoon3', evening: 'Evening3' },
    train: [],
  },
]

function setupFetchForStayEdit(stayUpdateResponse?: { ok: boolean; body: unknown }) {
  const resp = stayUpdateResponse ?? { ok: true, body: { updatedDays: stayMockData } }
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const path = url.toString().split('?')[0].replace('http://localhost', '')
    if (path === '/api/stay-update') {
      return Promise.resolve({
        json: () => Promise.resolve(resp.body),
        ok: resp.ok,
        status: resp.ok ? 200 : 500,
      } as Response)
    }
    // timetable and others
    return Promise.resolve({
      json: () => Promise.resolve(null),
      ok: true,
      status: 200,
    } as Response)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Note Column tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ItineraryTab - Note Column', () => {
  afterEach(() => jest.restoreAllMocks())

  function setupFetchWithNoteUpdate(overrides: Record<string, unknown> = {}) {
    const responses: Record<string, unknown> = {
      '/api/timetable': null,
      '/api/note-update': { success: true },
      ...overrides,
    }
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      return Promise.resolve({
        json: () => Promise.resolve(responses[path] ?? null),
        ok: true,
        status: 200,
      } as Response)
    })
  }

  it('renders a Note column header', () => {
    setupFetchWithNoteUpdate()
    render(<ItineraryTab initialData={mockRouteData} />)
    expect(screen.getByRole('columnheader', { name: /^note$/i })).toBeInTheDocument()
  })

  it('shows only the pencil button (no dash) for days with no note', () => {
    setupFetchWithNoteUpdate()
    const dataWithoutNote: RouteDay[] = [
      { ...mockRouteData[0], note: undefined },
    ]
    render(<ItineraryTab initialData={dataWithoutNote} />)
    const noteCells = screen.getAllByTestId(/^note-cell-/)
    expect(noteCells[0].textContent).not.toContain('—')
    expect(noteCells[0].querySelector('button[aria-label="Edit note"]')).toBeInTheDocument()
  })

  it('renders an Edit note pencil button in each note cell', () => {
    setupFetchWithNoteUpdate()
    render(<ItineraryTab initialData={mockRouteData} />)
    const editBtns = screen.getAllByLabelText('Edit note')
    expect(editBtns).toHaveLength(mockRouteData.length)
  })

  it('clicking pencil button opens a textarea pre-filled with current note', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [
      { ...mockRouteData[0], note: 'Existing note content' },
      mockRouteData[1],
      mockRouteData[2],
    ]
    render(<ItineraryTab initialData={dataWithNote} />)
    await userEvent.click(screen.getAllByLabelText('Edit note')[0])
    expect(screen.getByDisplayValue('Existing note content')).toBeInTheDocument()
  })

  it('clicking pencil button on a day with no note opens empty textarea', async () => {
    setupFetchWithNoteUpdate()
    const dataWithoutNote: RouteDay[] = [{ ...mockRouteData[0], note: undefined }]
    render(<ItineraryTab initialData={dataWithoutNote} />)
    await userEvent.click(screen.getByLabelText('Edit note'))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('blurring textarea with changed value calls POST /api/note-update', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [{ ...mockRouteData[0], note: 'old note' }]
    render(<ItineraryTab initialData={dataWithNote} />)
    await userEvent.click(screen.getByLabelText('Edit note'))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'new note text')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/note-update',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"note":"new note text"'),
        })
      )
    })
  })

  it('blurring textarea exits edit mode and shows updated note', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [{ ...mockRouteData[0], note: 'old note' }]
    render(<ItineraryTab initialData={dataWithNote} />)
    await userEvent.click(screen.getByLabelText('Edit note'))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'updated note')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByTestId('note-cell-0').textContent).toContain('updated note')
    })
  })

  it('pressing Escape cancels edit and restores previous note', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [{ ...mockRouteData[0], note: 'original note' }]
    render(<ItineraryTab initialData={dataWithNote} />)
    await userEvent.click(screen.getByLabelText('Edit note'))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'discarded changes')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByTestId('note-cell-0').textContent).toContain('original note')
    })
  })

  it('renders note content as markdown (bold text becomes <strong>)', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [{ ...mockRouteData[0], note: '**bold content**' }]
    render(<ItineraryTab initialData={dataWithNote} />)
    const noteCell = screen.getByTestId('note-cell-0')
    expect(within(noteCell).getByText('bold content').tagName.toLowerCase()).toBe('strong')
  })

  it('blurring with unchanged value does not call the API', async () => {
    setupFetchWithNoteUpdate()
    const dataWithNote: RouteDay[] = [{ ...mockRouteData[0], note: 'same value' }]
    render(<ItineraryTab initialData={dataWithNote} />)
    await userEvent.click(screen.getByLabelText('Edit note'))
    const textarea = screen.getByRole('textbox')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
    const fetchCalls = (global.fetch as jest.Mock).mock.calls
    const noteCalls = fetchCalls.filter((c: unknown[]) => (c[0] as string).includes('/api/note-update'))
    expect(noteCalls).toHaveLength(0)
  })
})

describe('ItineraryTab - Stay Edit Feature', () => {
  afterEach(() => jest.restoreAllMocks())

  // ── Rendering: edit affordance ──────────────────────────────────────────

  it('renders pencil buttons for non-last stays', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} />)
    // Paris is not the last stay → should have pencil button
    await waitFor(() => {
      const pencilBtns = screen.getAllByRole('button', { name: /edit stay duration/i })
      expect(pencilBtns.length).toBeGreaterThan(0)
    })
  })

  it('does NOT render a pencil button for the last stay (Cologne)', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => {
      // Only Paris has a pencil button; Cologne is the last stay
      const pencilBtns = screen.queryAllByRole('button', { name: /edit stay duration for Cologne/i })
      expect(pencilBtns).toHaveLength(0)
    })
  })

  it('pencil button for Paris has data-testid="stay-edit-btn-0"', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => {
      expect(screen.getByTestId('stay-edit-btn-0')).toBeInTheDocument()
    })
  })

  // ── Editing interaction ─────────────────────────────────────────────────

  it('clicking pencil for Paris opens the edit input', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))
    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    expect(screen.getByTestId('stay-edit-input-0')).toBeInTheDocument()
  })

  it('POSTs to /api/stay-update with stayIndex and newNights on confirm', async () => {
    // Updated days after shrink: Paris=1, Cologne=2
    const updatedDays: RouteDay[] = [
      { ...stayMockData[0], overnight: 'Paris' },
      { ...stayMockData[1], overnight: 'Cologne' },
      { ...stayMockData[2], overnight: 'Cologne' },
    ]
    setupFetchForStayEdit({ ok: true, body: { updatedDays } })
    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const stayCall = calls.find((c: unknown[]) => (c[0] as string).includes('/api/stay-update'))
      const body = JSON.parse(stayCall![1].body)
      expect(body.tabKey).toBeUndefined()
      expect(body.stayIndex).toBe(0)
      expect(body.newNights).toBe(1)
    })
  })


  // ── Optimistic update ───────────────────────────────────────────────────

  it('applies optimistic update immediately before server response', async () => {
    let resolveStayUpdate: (value: Response) => void
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/stay-update') {
        return new Promise<Response>((resolve) => { resolveStayUpdate = resolve })
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })

    // Confirm — optimistic update happens immediately
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    // Edit input should be gone (confirming closed it)
    await waitFor(() => {
      expect(screen.queryByTestId('stay-edit-input-0')).not.toBeInTheDocument()
    })

    // Clean up
    resolveStayUpdate!({
      json: () => Promise.resolve({ updatedDays: stayMockData }),
      ok: true,
      status: 200,
    } as Response)
  })

  // ── Revert on API failure ───────────────────────────────────────────────

  it('reverts to original values and shows error toast on API 500', async () => {
    setupFetchForStayEdit({ ok: false, body: { error: 'Server error' } })
    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      expect(screen.getByTestId('stay-edit-error-toast')).toBeInTheDocument()
    })
  })

  it('reverts to original state on network error', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/stay-update') {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    render(<ItineraryTab initialData={stayMockData} />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      expect(screen.getByTestId('stay-edit-error-toast')).toBeInTheDocument()
    })
  })

})

describe('ItineraryTab - Itinerary Scoped API wiring', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renders Add next stay as a floating button (not a table-top strip) in itinerary-scoped mode', () => {
    setupFetchForStayEdit()
    const onRequestAddStay = jest.fn()

    render(
      <ItineraryTab
        initialData={stayMockData}
        itineraryId="iti-1"
        onRequestAddStay={onRequestAddStay}
      />
    )

    // Floating button is rendered outside the table (in the sticky anchor)
    const btn = screen.getByRole('button', { name: /^add next stay$/i })
    expect(btn).toBeInTheDocument()
    // It should NOT be inside a <td> or <th> (not a table strip)
    expect(btn.closest('td')).toBeNull()
    expect(btn.closest('th')).toBeNull()
  })

  it('renders one icon-triggered full Edit stay control in itinerary-scoped mode', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} itineraryId="iti-1" onRequestEditStay={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /edit stay for paris/i })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: /edit stay for cologne/i })).toHaveLength(1)
      expect(screen.queryByTestId('stay-edit-btn-0')).not.toBeInTheDocument()
      expect(screen.queryByText(/^edit stay$/i)).not.toBeInTheDocument()
    })
  })

  it('routes itinerary-scoped overnight pencil clicks to onRequestEditStay', async () => {
    setupFetchForStayEdit()
    const onRequestEditStay = jest.fn()
    render(<ItineraryTab initialData={stayMockData} itineraryId="iti-1" onRequestEditStay={onRequestEditStay} />)

    await userEvent.click(await screen.findByRole('button', { name: /edit stay for paris/i }))

    expect(onRequestEditStay).toHaveBeenCalledWith(0)
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/itineraries/iti-1/stays/0'),
      expect.anything()
    )
  })

  it('uses itinerary day note PATCH endpoint when itineraryId is provided', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/itineraries/iti-1/days/0/note') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...mockRouteData[0], note: 'Scoped note' }),
        } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => null } as Response)
    })

    render(<ItineraryTab initialData={mockRouteData} itineraryId="iti-1" />)

    await userEvent.click(screen.getAllByLabelText('Edit note')[0])
    const editor = await screen.findByRole('textbox')
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Scoped note')
    fireEvent.blur(editor)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-1/days/0/note',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })
})

describe('ItineraryTab move stay buttons', () => {
  function daySimple(overnight: string, dayNum: number): RouteDay {
    return {
      date: `2026/4/${dayNum}`,
      weekDay: '星期一',
      dayNum,
      overnight,
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    }
  }

  const threeCityDays: RouteDay[] = [
    daySimple('Paris', 1),
    daySimple('Paris', 2),
    daySimple('Lyon', 3),
    daySimple('Rome', 4),
  ]

  afterEach(() => jest.restoreAllMocks())

  it('first stay has no move-up button and has move-down button', () => {
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
        onMoveStay={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /move paris up/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move paris down/i })).toBeInTheDocument()
  })

  it('last stay has move-up button and no move-down button', () => {
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
        onMoveStay={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /move rome up/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move rome down/i })).not.toBeInTheDocument()
  })

  it('middle stay has both move-up and move-down buttons', () => {
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
        onMoveStay={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /move lyon up/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move lyon down/i })).toBeInTheDocument()
  })

  it('clicking move-down calls onMoveStay with correct stayIndex and direction', async () => {
    const onMoveStay = jest.fn()
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
        onMoveStay={onMoveStay}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /move paris down/i }))
    expect(onMoveStay).toHaveBeenCalledWith(0, 'down')
  })

  it('clicking move-up calls onMoveStay with correct stayIndex and direction', async () => {
    const onMoveStay = jest.fn()
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
        onMoveStay={onMoveStay}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /move lyon up/i }))
    expect(onMoveStay).toHaveBeenCalledWith(1, 'up')
  })

  it('move buttons not rendered when onMoveStay prop is absent', () => {
    render(
      <ItineraryTab
        initialData={threeCityDays}
        itineraryId="iti-1"
        onRequestEditStay={jest.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /move paris/i })).not.toBeInTheDocument()
  })
})

describe('ItineraryTab - Attractions', () => {
  afterEach(() => jest.restoreAllMocks())

  function setupFetch(overrides: Record<string, unknown> = {}) {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(overrides[path] ?? {}),
      } as Response)
    })
  }

  const dayWithAttractions: RouteDay[] = [
    {
      date: '2026/9/25',
      weekDay: '星期五',
      dayNum: 1,
      overnight: '巴黎',
      plan: { morning: 'morning', afternoon: 'afternoon', evening: 'evening' },
      train: [],
      attractions: [
        { id: 'g1', label: 'Eiffel Tower', coordinates: { lat: 48.858, lng: 2.294 } },
        { id: 'g2', label: 'Notre-Dame' },
      ],
    },
  ]

  it('renders Attractions column header in the table', () => {
    setupFetch()
    render(<ItineraryTab initialData={[{
      date: '2026/9/25', weekDay: '星期五', dayNum: 1, overnight: '巴黎',
      plan: { morning: '', afternoon: '', evening: '' }, train: [],
    }]} />)
    expect(screen.getByText('Attractions')).toBeInTheDocument()
  })

  it('renders existing attraction tags from initialData', () => {
    setupFetch()
    render(<ItineraryTab initialData={dayWithAttractions} />)
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument()
    expect(screen.getByText('Notre-Dame')).toBeInTheDocument()
  })

  it('shows Add attraction button that reveals inline search', async () => {
    setupFetch()
    render(<ItineraryTab initialData={dayWithAttractions} />)
    const addBtn = screen.getByRole('button', { name: /add attraction for day 1/i })
    expect(addBtn).toBeInTheDocument()
    await userEvent.click(addBtn)
    expect(screen.getByRole('combobox', { name: /search attractions/i })).toBeInTheDocument()
  })

  it('closes inline search on Escape', async () => {
    setupFetch()
    render(<ItineraryTab initialData={dayWithAttractions} />)
    await userEvent.click(screen.getByRole('button', { name: /add attraction for day 1/i }))
    const input = screen.getByRole('combobox', { name: /search attractions/i })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('combobox', { name: /search attractions/i })).not.toBeInTheDocument()
  })

  it('removes an attraction and PATCHes when itineraryId provided', async () => {
    setupFetch({ '/api/itineraries/iti-1/days/0/attractions': { date: '2026/9/25', attractions: [{ id: 'g2', label: 'Notre-Dame' }] } })
    render(<ItineraryTab initialData={dayWithAttractions} itineraryId="iti-1" />)
    const deleteBtn = screen.getByRole('button', { name: /remove eiffel tower/i })
    await userEvent.click(deleteBtn)
    expect(screen.queryByText('Eiffel Tower')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-1/days/0/attractions',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  it('removes an attraction and POSTs to legacy endpoint when no itineraryId', async () => {
    setupFetch({ '/api/attraction-update': { date: '2026/9/25', attractions: [{ id: 'g2', label: 'Notre-Dame' }] } })
    render(<ItineraryTab initialData={dayWithAttractions} />)
    const deleteBtn = screen.getByRole('button', { name: /remove eiffel tower/i })
    await userEvent.click(deleteBtn)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/attraction-update',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('renders preview button that opens minimap popover', async () => {
    setupFetch()
    render(<ItineraryTab initialData={dayWithAttractions} />)
    const previewBtn = screen.getByRole('button', { name: /preview attractions map for day 1/i })
    await userEvent.click(previewBtn)
    expect(await screen.findByTestId('attraction-minimap')).toBeInTheDocument()
  })

  it('closes minimap popover on Escape', async () => {
    setupFetch()
    render(<ItineraryTab initialData={dayWithAttractions} />)
    await userEvent.click(screen.getByRole('button', { name: /preview attractions map for day 1/i }))
    await screen.findByTestId('attraction-minimap')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('attraction-minimap')).not.toBeInTheDocument()
  })
})
