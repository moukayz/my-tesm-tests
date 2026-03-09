import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ItineraryTab from '../../components/ItineraryTab'

function getDbTrainCount(routeData: Array<{ train: Array<{ start?: string; end?: string }> }>) {
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
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
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

  it('renders a row for every entry in route.json', async () => {
    setupFetch()
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    // Each row has a date cell — count them
    const dateCells = screen.getAllByText(/^\d{4}\/\d+\/\d+$/)
    expect(dateCells).toHaveLength(routeData.length)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders the first day date and plan sections', async () => {
    setupFetch()
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    const firstDateCell = screen.getByText(routeData[0].date)
    const firstRow = firstDateCell.closest('tr')
    expect(firstRow).not.toBeNull()
    const withinRow = within(firstRow as HTMLElement)
    expect(withinRow.getByTitle('Morning')).toBeInTheDocument()
    expect(withinRow.getByTitle('Afternoon')).toBeInTheDocument()
    expect(withinRow.getByTitle('Evening')).toBeInTheDocument()
    expect(withinRow.getByText(routeData[0].plan.morning)).toBeInTheDocument()
    expect(withinRow.getByText(routeData[0].plan.afternoon)).toBeInTheDocument()
    expect(withinRow.getByText(routeData[0].plan.evening)).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders 2 delimiters between the 3 plan sections', async () => {
    setupFetch()
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)

    const firstDateCell = screen.getByText(routeData[0].date)
    const firstRow = firstDateCell.closest('tr') as HTMLElement
    const separators = within(firstRow).getAllByRole('separator')
    expect(separators).toHaveLength(2)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders a dash for days with no train schedule', async () => {
    setupFetch()
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    // Days with empty train array render an em-dash placeholder
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
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    const dayWithTrain = routeData.find((d) => d.train.length > 0)!
    await waitFor(() => {
      // For non-DB trains (no start/end), should display as-is
      // For DB trains (has start/end), should show in list
      const trainEntry = dayWithTrain.train[0]
      expect(screen.getByText(trainEntry.train_id)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('renders overnight location cells with merged rowspans', async () => {
    setupFetch()
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    // Each unique overnight location should appear in the DOM.
    // Skip '—' since it also appears as the train-schedule placeholder spans.
    const uniqueLocations = [...new Set(routeData.map((d) => d.overnight))].filter(
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
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    render(<ItineraryTab />)
    // Verify fetch was called for DB trains
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/timetable'))
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })

  it('displays non-DB trains as-is without fetching', async () => {
    setupFetch()
    render(<ItineraryTab />)
    const routeData = (await import('../../data/route.json')).default
    const dbTrainCount = getDbTrainCount(routeData)
    const allTrains = routeData.flatMap((day) => day.train)
    const nonDbTrain = allTrains.find((train) => !train.start || !train.end)
    if (!nonDbTrain) {
      expect(allTrains.every((train) => train.start && train.end)).toBe(true)
      return
    }
    // Non-DB trains should be displayed as-is
    await waitFor(() => {
      expect(screen.getByText(nonDbTrain.train_id)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(dbTrainCount)
    })
  })
})

function setupFetchWithPlanUpdate(overrides: Record<string, unknown> = {}) {
  const responses = {
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

describe('ItineraryTab - Edit Plan Functionality', () => {
  afterEach(() => jest.restoreAllMocks())

  it('does not render an edit button in the plan cell', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)
    expect(screen.queryByLabelText('Edit plan')).not.toBeInTheDocument()
  })

  it('double-clicking an activity row shows an input pre-filled with current value', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      expect(screen.getByDisplayValue(routeData[0].plan.morning)).toBeInTheDocument()
    })
  })

  it('only the double-clicked row enters edit mode; others stay in display mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      expect(screen.getByDisplayValue(routeData[0].plan.morning)).toBeInTheDocument()
      // afternoon and evening rows stay as display spans
      expect(screen.queryByDisplayValue(routeData[0].plan.afternoon)).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue(routeData[0].plan.evening)).not.toBeInTheDocument()
    })
  })

  it('allows typing in the edit input', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    await userEvent.clear(input)
    await userEvent.type(input, 'Updated morning plan')

    expect(input).toHaveValue('Updated morning plan')
  })

  it('blurring the input exits edit mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('blurring with a changed value calls POST /api/plan-update', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ error: 'Invalid day index' }),
        ok: false,
        status: 400,
      } as Response)
    )
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const input = await screen.findByDisplayValue(routeData[0].plan.morning)

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    // Still in edit mode — textarea should still be present
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('the edit element is a textarea to support multi-line input', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    await screen.findByDisplayValue(routeData[0].plan.morning)

    const editEl = screen.getByRole('textbox')
    expect(editEl.tagName.toLowerCase()).toBe('textarea')
  })

  it('displays multi-line values with preserved newlines in display mode', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)

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
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    // Edit morning of day 0
    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))
    const morningInput = await screen.findByDisplayValue(routeData[0].plan.morning)
    fireEvent.blur(morningInput)

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())

    // Edit evening of day 1
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
    render(<ItineraryTab />)
    await editRowWithValue('plan-row-0-morning', '**bold text**')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('bold text').tagName.toLowerCase()).toBe('strong')
    })
  })

  it('renders *italic* as <em> in display mode', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)
    await editRowWithValue('plan-row-0-morning', '*italic text*')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('italic text').tagName.toLowerCase()).toBe('em')
    })
  })

  it('renders `code` as <code> in display mode', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)
    await editRowWithValue('plan-row-0-morning', '`code text`')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('code text').tagName.toLowerCase()).toBe('code')
    })
  })

  it('renders ~~strikethrough~~ as <del> in display mode', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)
    await editRowWithValue('plan-row-0-morning', '~~strike~~')
    await waitFor(() => {
      const row = screen.getByTestId('plan-row-0-morning')
      expect(within(row).getByText('strike').tagName.toLowerCase()).toBe('del')
    })
  })

  it('preserves newlines as line breaks in display mode', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)
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

  // Test 1: drag handles rendered in display mode
  it('renders a drag handle for each of the 3 plan sections in display mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const firstDateCell = screen.getByText(routeData[0].date)
    const firstRow = firstDateCell.closest('tr') as HTMLElement
    const handles = within(firstRow).getAllByLabelText('Drag to reorder')
    expect(handles).toHaveLength(3)
  })

  // Test 2: drag handle NOT rendered for the row being edited
  it('does not render a drag handle for the row being edited', async () => {
    setupFetchWithPlanUpdate()
    render(<ItineraryTab />)

    await userEvent.dblClick(screen.getByTestId('plan-row-0-morning'))

    await waitFor(() => {
      // morning row is now an input — its drag handle is gone
      expect(screen.queryByTestId('plan-row-0-morning')).not.toBeInTheDocument()
    })
    // afternoon and evening rows still have handles
    expect(screen.getByTestId('plan-row-0-afternoon')).toBeInTheDocument()
  })

  // Test 3: plan section rows have draggable attribute in display mode
  it('plan section rows are draggable in display mode', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow = screen.getByTestId(`plan-row-0-morning`)
    expect(morningRow).toHaveAttribute('draggable', 'true')
  })

  // Test 4: source row gets opacity-40 on dragStart
  it('source row gets muted appearance on dragStart', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow = screen.getByTestId('plan-row-0-morning')
    fireEvent.dragStart(morningRow, mockDragEvent)

    expect(morningRow.className).toContain('opacity-40')
  })

  // Test 5: target row highlights on dragOver same day
  it('target row shows highlight on dragOver of same-day section', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)

    expect(eveningRow.className).toContain('ring-2')
  })

  // Test 6: dragOver on different-day section does NOT highlight
  it('dragOver on a different-day section does NOT show highlight', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow0 = screen.getByTestId('plan-row-0-morning')
    const morningRow1 = screen.getByTestId('plan-row-1-morning')

    fireEvent.dragStart(morningRow0, mockDragEvent)
    fireEvent.dragOver(morningRow1, mockDragEvent)

    expect(morningRow1.className).not.toContain('ring-2')
  })

  // Test 7: dropping swaps values and calls POST /api/plan-update
  it('dropping swaps activity values and calls POST /api/plan-update with swapped plan', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    const originalMorning = routeData[0].plan.morning.trim()
    const originalEvening = routeData[0].plan.evening.trim()

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.drop(eveningRow, mockDragEvent)

    // Values should be swapped in display
    await waitFor(() => {
      expect(eveningRow.textContent).toContain(originalMorning)
      expect(morningRow.textContent).toContain(originalEvening)
    })

    // API should be called with swapped plan
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

  // Test 8: dropping on same slot does not swap or call API
  it('dropping on the same slot does not swap or call the API', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

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

  // Test 9: on API failure values revert and error appears
  it('on API failure: values revert and error message appears', async () => {
    const routeData = (await import('../../data/route.json')).default
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

    render(<ItineraryTab />)

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')
    const originalMorning = routeData[0].plan.morning.trim()
    const originalEvening = routeData[0].plan.evening.trim()

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.drop(eveningRow, mockDragEvent)

    // Values should revert after API failure
    await waitFor(() => {
      expect(morningRow.textContent).toContain(originalMorning)
      expect(eveningRow.textContent).toContain(originalEvening)
    })

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/Server error|Failed to save/i)).toBeInTheDocument()
    })
  })

  // Test 10: dragEnd without drop clears all drag visual state
  it('dragEnd without drop clears all drag visual state', async () => {
    setupFetchWithPlanUpdate()
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)

    const morningRow = screen.getByTestId('plan-row-0-morning')
    const eveningRow = screen.getByTestId('plan-row-0-evening')

    fireEvent.dragStart(morningRow, mockDragEvent)
    fireEvent.dragOver(eveningRow, mockDragEvent)
    fireEvent.dragEnd(morningRow, mockDragEvent)

    expect(morningRow.className).not.toContain('opacity-40')
    expect(eveningRow.className).not.toContain('ring-2')
  })
})
