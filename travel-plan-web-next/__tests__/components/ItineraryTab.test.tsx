import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItineraryTab from '../../components/ItineraryTab'
import type { RouteDay } from '../../app/lib/itinerary'

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

function getDbTrainCount(routeData: Array<{ train: Array<Record<string, unknown>> }>) {
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
    expect(screen.getByText('Weekday')).toBeInTheDocument()
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('Overnight')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Train Schedule')).toBeInTheDocument()
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

  it('renders the first day date and plan sections', async () => {
    setupFetch()
    const dbTrainCount = getDbTrainCount(mockRouteData)
    render(<ItineraryTab initialData={mockRouteData} />)
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
    render(<ItineraryTab initialData={mockRouteData} />)

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
    render(<ItineraryTab initialData={mockRouteData} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
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
    const dayWithTrain = mockRouteData.find((d) => d.train.length > 0)!
    await waitFor(() => {
      const trainEntry = dayWithTrain.train[0]
      expect(screen.getByText(trainEntry.train_id)).toBeInTheDocument()
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

  it('displays non-DB trains as-is without fetching', async () => {
    setupFetch()
    render(<ItineraryTab initialData={mockRouteData} />)
    const dbTrainCount = getDbTrainCount(mockRouteData)
    const allTrains = mockRouteData.flatMap((day) => day.train) as Array<Record<string, unknown>>
    const nonDbTrain = allTrains.find((train) => !train.start || !train.end)
    if (!nonDbTrain) {
      expect(allTrains.every((train) => train.start && train.end)).toBe(true)
      return
    }
    await waitFor(() => {
      expect(screen.getByText(nonDbTrain.train_id as string)).toBeInTheDocument()
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
  render(<ItineraryTab initialData={mockRouteData} />)
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
