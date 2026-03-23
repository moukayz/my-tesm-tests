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
  buildMarkdownTable: jest.fn().mockReturnValue('| Date | Day | Overnight | Plan | Train Schedule |\n|---|---|---|---|---|\n| 2026/9/25 | 1 | 巴黎 | Morning: e2e-morning | — |'),
  buildPdfBlob: jest.fn().mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Weekday')).toBeInTheDocument()
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByText('Overnight')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Train Schedule')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
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
    render(<ItineraryTab initialData={dataWithResolvedLocation} tabKey="route" />)
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('shows dash in country cell for custom or absent location', async () => {
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
    render(<ItineraryTab initialData={dataNoLocation} tabKey="route" />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('merges country cells across consecutive stays in the same country', async () => {
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
    render(<ItineraryTab initialData={multiCountryData} tabKey="route" />)
    // France appears once, Italy appears once (merged across Rome + Milan)
    const franceCells = screen.getAllByText('France')
    const italyCells = screen.getAllByText('Italy')
    expect(franceCells).toHaveLength(1)
    expect(italyCells).toHaveLength(1)
    // Italy cell spans 2 rows
    expect(italyCells[0].closest('td')).toHaveAttribute('rowspan', '2')
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
    render(<ItineraryTab initialData={dataResolved} tabKey="route" />)
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
    render(<ItineraryTab initialData={dataCustom} tabKey="route" />)
    expect(screen.getByText('CustomCity')).toBeInTheDocument()
  })

  it('exposes primary itinerary panel locator with Date column header', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)

    const panel = screen.getByTestId('itinerary-tab')
    expect(within(panel).getByRole('columnheader', { name: /^date$/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('exposes test itinerary panel locator with Date column header', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route-test" />)

    const panel = screen.getByTestId('itinerary-test-tab')
    expect(within(panel).getByRole('columnheader', { name: /^date$/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders a row for every entry in initialData', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    const dateCells = screen.getAllByText(/^\d{4}\/\d+\/\d+$/)
    expect(dateCells).toHaveLength(mockRouteData.length)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders the first day date and plan sections', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    const firstDateCell = screen.getByText(mockRouteData[0].date)
    const firstRow = firstDateCell.closest('tr')
    expect(firstRow).not.toBeNull()
    const withinRow = within(firstRow as HTMLElement)
    expect(withinRow.getByTitle('Morning')).toBeInTheDocument()
    expect(withinRow.getByTitle('Afternoon')).toBeInTheDocument()
    expect(withinRow.getByTitle('Evening')).toBeInTheDocument()
    expect(withinRow.getByText(mockRouteData[0].plan.morning)).toBeInTheDocument()
    expect(withinRow.getByText(mockRouteData[0].plan.afternoon)).toBeInTheDocument()
    expect(withinRow.getByText(mockRouteData[0].plan.evening)).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders 2 delimiters between the 3 plan sections', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)

    const firstDateCell = screen.getByText(mockRouteData[0].date)
    const firstRow = firstDateCell.closest('tr') as HTMLElement
    const separators = within(firstRow).getAllByRole('separator')
    expect(separators).toHaveLength(2)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders a dash for days with no train schedule', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={dataWithTrain} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/timetable'))
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('displays non-DB trains as a comment without fetching', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    '/api/plan-update': { success: true },
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
  render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
  if (dbTrainCount > 0) {
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount))
  }
  return mockRouteData
}

describe('ItineraryTab - Edit Plan Functionality', () => {
  afterEach(() => jest.restoreAllMocks())

  it('does not render an edit button in the plan cell', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    expect(screen.queryByLabelText('Edit plan')).not.toBeInTheDocument()
  })

  it('double-clicking an activity row shows an input pre-filled with current value', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      expect(screen.getByDisplayValue(routeData[0].plan.morning)).toBeInTheDocument()
    })
  })

  it('only the double-clicked row enters edit mode; others stay in display mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      expect(screen.getByDisplayValue(routeData[0].plan.morning)).toBeInTheDocument()
      expect(screen.queryByDisplayValue(routeData[0].plan.afternoon)).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue(routeData[0].plan.evening)).not.toBeInTheDocument()
    })
  })

  it('allows typing in the edit input', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'Updated morning plan')

    expect(input).toHaveValue('Updated morning plan')
  })

  it('blurring the input exits edit mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('blurring with a changed value calls POST /api/plan-update', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'Updated morning')
    fireEvent.blur(input)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/plan-update',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.stringContaining('"dayIndex":0'),
        })
      )
    })
  })

  it('shows the saved value in display mode after blur', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'Updated morning')
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText('Updated morning')).toBeInTheDocument()
    })
  })

  it('reverts to original value and shows error on API failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ error: 'Invalid day index' }),
        ok: false,
        status: 400,
      } as Response)
    )
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'Updated')
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText(/Invalid/i)).toBeInTheDocument()
      expect(screen.getByText(routeData[0].plan.morning)).toBeInTheDocument()
    })
  })

  it('pressing Enter commits the change and exits edit mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'New activity')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText('New activity')).toBeInTheDocument()
    })
  })

  it('pressing Enter calls POST /api/plan-update', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'New activity')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/plan-update',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('New activity') })
      )
    })
  })

  it('pressing Shift+Enter does not exit edit mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('the edit element is a textarea to support multi-line input', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    await screen.findByDisplayValue(routeData[0].plan.morning)

    const editEl = screen.getByRole('textbox')
    expect(editEl.tagName.toLowerCase()).toBe('textarea')
  })

  it('displays multi-line values with preserved newlines in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const textarea = await screen.findByRole('textbox')

    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2' } })
    fireEvent.blur(textarea)

    await waitFor(() => {
      const morningRow = screen.getByTestId('plan-row-0-morning')
      expect(morningRow.querySelector('br')).not.toBeNull()
      expect(morningRow.textContent).toContain('Line 1')
      expect(morningRow.textContent).toContain('Line 2')
    })
  })

  it('allows editing different activity rows one after another', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const morningInput = await screen.findByDisplayValue(routeData[0].plan.morning)
    fireEvent.blur(morningInput)

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())

    await userEvent.dblClick(screen.getByTestId('plan-row-1-evening'))
    await waitFor(() => {
      expect(screen.getByDisplayValue(routeData[1].plan.evening)).toBeInTheDocument()
    })
  })
})

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
    render(<ItineraryTab initialData={tgvData} tabKey="route" />)
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
    render(<ItineraryTab initialData={estData} tabKey="route" />)
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
    render(<ItineraryTab initialData={iceData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mixedData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    await waitFor(() => {
      const tags = screen.getAllByTestId('train-tag')
      const tagTexts = tags.map((t) => t.textContent)
      // ICE 123 has start/end → should be a tag
      expect(tagTexts).toContain('ICE 123')
    })
  })

  it('renders non-DB train number (no start/end) as a dash with a comment, NOT as a tag', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mixedData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    await waitFor(() => {
      const grid = document.querySelector('[data-testid="schedule-grid"]')
      expect(grid).not.toBeNull()
    })
  })
})

describe('ItineraryTab - Markdown Rendering', () => {
  afterEach(() => jest.restoreAllMocks())

  async function editRowWithValue(testId: string, value: string) {
    await userEvent.dblClick(screen.getByTestId(testId))
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value } })
    fireEvent.blur(textarea)
  }

  it('renders **bold** as <strong> in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    await editRowWithValue('plan-row-0-morning', '**bold text**')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('bold text').tagName.toLowerCase()).toBe('strong')
    })
  })

  it('renders *italic* as <em> in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    await editRowWithValue('plan-row-0-morning', '*italic text*')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('italic text').tagName.toLowerCase()).toBe('em')
    })
  })

  it('renders `code` as <code> in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    await editRowWithValue('plan-row-0-morning', '`code text`')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('code text').tagName.toLowerCase()).toBe('code')
    })
  })

  it('renders ~~strikethrough~~ as <del> in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    await editRowWithValue('plan-row-0-morning', '~~strike~~')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('strike').tagName.toLowerCase()).toBe('del')
    })
  })

  it('preserves newlines as line breaks in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()
    await editRowWithValue('plan-row-0-morning', 'line one\nline two')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(row.querySelector('br')).not.toBeNull()
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
          body: JSON.stringify({ dayIndex: 0, trainJson: '[{"train_id":"ICE999"}]', tabKey: 'route' }),
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
    render(<ItineraryTab initialData={reorderData} tabKey="route" />)

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

describe('ItineraryTab - Drag and Drop', () => {
  afterEach(() => jest.restoreAllMocks())

  const mockDragEvent = { dataTransfer: { setData: jest.fn(), getData: jest.fn(), effectAllowed: '' } }

  it('renders a drag handle for each of the 3 plan sections in display mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    const firstDateCell = screen.getByText(routeData[0].date)
    const firstRow = firstDateCell.closest('tr') as HTMLElement
    const handles = within(firstRow).getAllByLabelText('Drag to reorder')
    expect(handles).toHaveLength(3)
  })

  it('does not render a drag handle for the row being edited', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      expect(screen.queryByTestId('plan-row-0-morning')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('plan-row-0-afternoon')).toBeInTheDocument()
  })

  it('plan section rows are draggable in display mode', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId(`plan-row-0-morning`)
    expect(morningRow).toHaveAttribute('draggable', 'true')
  })

  it('source row gets muted appearance on dragStart', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    fireEvent.dragStart(morningRow, mockDragEvent)

    expect(morningRow.className).toContain('opacity-40')
  })

  it('target row shows highlight on dragOver of same-day section', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)

    expect(eveningRow.className).toContain('ring-2')
  })

  it('dragOver on a different-day section does NOT show highlight', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    const morningRow0 = screen.getByTestId('plan-row-0-morning')
    const morningRow1 = screen.getByTestId('plan-row-1-morning')

    fireEvent.dragStart(morningRow0, mockDragEvent)
    fireEvent.dragOver(morningRow1, mockDragEvent)

    expect(morningRow1.className).not.toContain('ring-2')
  })

  it('dropping swaps activity values and calls POST /api/plan-update with swapped plan', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    const originalMorning = routeData[0].plan.morning.trim()
    const originalEvening = routeData[0].plan.evening.trim()

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.drop(eveningRow, mockDragEvent)

    await waitFor(() => {
      expect(eveningRow.textContent).toContain(originalMorning)
      expect(morningRow.textContent).toContain(originalEvening)
    })

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const planUpdateCall = calls.find(
        (call) => call[0] === '/api/plan-update' && call[1]?.method === 'POST'
      )
      expect(planUpdateCall).toBeDefined()
      const body = JSON.parse(planUpdateCall[1].body)
      expect(body.plan.morning).toBe(originalEvening)
      expect(body.plan.evening).toBe(originalMorning)
    })
  })

  it('dropping on the same slot does not swap or call the API', async () => {
    setupFetchWithPlanUpdate()
    const routeData = await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const originalMorning = routeData[0].plan.morning.trim()

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(morningRow, mockDragEvent)
    fireEvent.drop(morningRow, mockDragEvent)

    await waitFor(() => {
      expect(morningRow.textContent).toContain(originalMorning)
    })

    const planUpdateCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (call) => call[0] === '/api/plan-update'
    )
    expect(planUpdateCalls).toHaveLength(0)
  })

  it('on API failure: values revert and error message appears', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL, options?: RequestInit) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/plan-update') {
        return Promise.resolve({
          json: () => Promise.resolve({ error: 'Server error' }),
          ok: false,
          status: 500,
        } as Response)
      }
      return Promise.resolve({ json: () => Promise.resolve(null), ok: true, status: 200 } as Response)
    })

    const routeData = await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')
    const originalMorning = routeData[0].plan.morning.trim()
    const originalEvening = routeData[0].plan.evening.trim()

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.drop(eveningRow, mockDragEvent)

    await waitFor(() => {
      expect(morningRow.textContent).toContain(originalMorning)
      expect(eveningRow.textContent).toContain(originalEvening)
    })

    await waitFor(() => {
      expect(screen.getByText(/Server error|Failed to save/i)).toBeInTheDocument()
    })
  })

  it('dragEnd without drop clears all drag visual state', async () => {
    setupFetchWithPlanUpdate()
    await renderAndAwaitSchedules()

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.dragEnd(morningRow, mockDragEvent)

    expect(morningRow.className).not.toContain('opacity-40')
    expect(eveningRow.className).not.toContain('ring-2')
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    expect(screen.getByTestId('export-fab')).toBeInTheDocument()
  })

  it('T1-S3-13: data-testid="export-button" is NOT in DOM (inline toolbar removed)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    expect(screen.queryByTestId('export-button')).not.toBeInTheDocument()
  })

  it('T1-S3-14: clicking export-fab opens picker (export-format-picker visible, pdf disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))

    expect(screen.getByTestId('export-format-picker')).toBeInTheDocument()
    expect(screen.getByTestId('export-md')).toBeInTheDocument()
    // PDF button is present but disabled (temporarily unavailable)
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('export-pdf')).toBeDisabled()
  })

  it('T1-S3-15: export-fab disabled when initialData=[]', () => {
    setupExportFetch()
    render(<ItineraryTab initialData={[]} tabKey="route" />)
    expect(screen.getByTestId('export-fab')).toBeDisabled()
  })

  it('clicking Markdown triggers buildMarkdownTable and saveFile with .md filename', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-format-picker')).not.toBeInTheDocument()
    })
  })

  it('clicking PDF button does NOT trigger buildPdfBlob or saveFile (PDF export temporarily disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))
    expect(screen.getByTestId('export-pdf')).toBeDisabled()
  })

  it('Markdown export works independently of PDF being disabled', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)

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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.getByTestId('export-success-toast')).toBeInTheDocument()
    })
  })

  it('T1-S1-12: clicking PDF button does NOT show success toast (PDF export temporarily disabled)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-md'))
    await waitFor(() => {
      expect(screen.queryByTestId('export-format-picker')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
  })

  it('T1-S1-14: no toast and no error banner when PDF is clicked (PDF export temporarily disabled — no-op)', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
    fireEvent.click(screen.getByTestId('export-fab'))
    fireEvent.click(screen.getByTestId('export-pdf'))
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByTestId('export-pdf-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('export-success-toast')).not.toBeInTheDocument()
  })

  it('T1-S1-15: toast disappears after clicking dismiss button', async () => {
    setupExportFetch()
    render(<ItineraryTab initialData={mockRouteData} tabKey="route" />)
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
    if (path === '/api/plan-update') {
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
        ok: true,
        status: 200,
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

describe('ItineraryTab - Stay Edit Feature', () => {
  afterEach(() => jest.restoreAllMocks())

  // ── Rendering: edit affordance ──────────────────────────────────────────

  it('renders pencil buttons for non-last stays', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    // Paris is not the last stay → should have pencil button
    await waitFor(() => {
      const pencilBtns = screen.getAllByRole('button', { name: /edit stay duration/i })
      expect(pencilBtns.length).toBeGreaterThan(0)
    })
  })

  it('does NOT render a pencil button for the last stay (Cologne)', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    await waitFor(() => {
      // Only Paris has a pencil button; Cologne is the last stay
      const pencilBtns = screen.queryAllByRole('button', { name: /edit stay duration for Cologne/i })
      expect(pencilBtns).toHaveLength(0)
    })
  })

  it('pencil button for Paris has data-testid="stay-edit-btn-0"', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    await waitFor(() => {
      expect(screen.getByTestId('stay-edit-btn-0')).toBeInTheDocument()
    })
  })

  // ── Editing interaction ─────────────────────────────────────────────────

  it('clicking pencil for Paris opens the edit input', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))
    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    expect(screen.getByTestId('stay-edit-input-0')).toBeInTheDocument()
  })

  it('POSTs to /api/stay-update with tabKey, stayIndex, newNights on confirm', async () => {
    // Updated days after shrink: Paris=1, Cologne=2
    const updatedDays: RouteDay[] = [
      { ...stayMockData[0], overnight: 'Paris' },
      { ...stayMockData[1], overnight: 'Cologne' },
      { ...stayMockData[2], overnight: 'Cologne' },
    ]
    setupFetchForStayEdit({ ok: true, body: { updatedDays } })
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stay-update',
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
          body: expect.stringContaining('"tabKey":"route"'),
        })
      )
    })
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const stayCall = calls.find((c: unknown[]) => (c[0] as string).includes('/api/stay-update'))
      const body = JSON.parse(stayCall![1].body)
      expect(body.tabKey).toBe('route')
      expect(body.stayIndex).toBe(0)
      expect(body.newNights).toBe(1)
    })
  })

  it('POSTs with tabKey="route-test" when tabKey prop is "route-test"', async () => {
    const updatedDays: RouteDay[] = [
      { ...stayMockData[0], overnight: 'Paris' },
      { ...stayMockData[1], overnight: 'Cologne' },
      { ...stayMockData[2], overnight: 'Cologne' },
    ]
    setupFetchForStayEdit({ ok: true, body: { updatedDays } })
    render(<ItineraryTab initialData={stayMockData} tabKey="route-test" />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const stayCall = calls.find((c: unknown[]) => (c[0] as string).includes('/api/stay-update'))
      const body = JSON.parse(stayCall![1].body)
      expect(body.tabKey).toBe('route-test')
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

    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
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
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
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

    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)
    await waitFor(() => screen.getByTestId('stay-edit-btn-0'))

    await userEvent.click(screen.getByTestId('stay-edit-btn-0'))
    const input = screen.getByTestId('stay-edit-input-0')
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('stay-edit-confirm-0'))

    await waitFor(() => {
      expect(screen.getByTestId('stay-edit-error-toast')).toBeInTheDocument()
    })
  })

  // ── plan-update includes tabKey ─────────────────────────────────────────

  it('plan-update calls include tabKey in the request body', async () => {
    setupFetchForStayEdit()
    render(<ItineraryTab initialData={stayMockData} tabKey="route" />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const textarea = await screen.findByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'New plan')
    fireEvent.blur(textarea)

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls
      const planCall = calls.find((c: unknown[]) => (c[0] as string).includes('/api/plan-update'))
      expect(planCall).toBeDefined()
      const body = JSON.parse(planCall![1].body)
      expect(body.tabKey).toBe('route')
    })
  })
})

describe('ItineraryTab - Itinerary Scoped API wiring', () => {
  afterEach(() => jest.restoreAllMocks())

  it('does not render a table-top Add next stay strip in itinerary-scoped mode', () => {
    setupFetchForStayEdit()
    const onRequestAddStay = jest.fn()

    render(
      <ItineraryTab
        initialData={stayMockData}
        itineraryId="iti-1"
        onRequestAddStay={onRequestAddStay}
      />
    )

    expect(screen.queryByRole('button', { name: /^add next stay$/i })).not.toBeInTheDocument()
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

  it('uses itinerary day plan PATCH endpoint when itineraryId is provided', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const path = url.toString().split('?')[0].replace('http://localhost', '')
      if (path === '/api/itineraries/iti-1/days/0/plan') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...mockRouteData[0] }),
        } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => null } as Response)
    })

    render(<ItineraryTab initialData={mockRouteData} itineraryId="iti-1" />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const editor = await screen.findByRole('textbox')
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Scoped update')
    fireEvent.blur(editor)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-1/days/0/plan',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })
})
