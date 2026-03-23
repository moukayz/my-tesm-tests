import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainTimetableTab from '../../components/TrainTimetableTab'

const mockTrains = [
  { train_name: 'ICE 905', train_type: 'ICE', railway: 'german' },
  { train_name: 'TGV 6201', train_type: 'TGV', railway: 'french' },
  { train_name: '9002', train_type: 'Eurostar', railway: 'eurostar' },
]

const mockFrenchTimetable = [
  {
    station_name: 'Paris Gare de Lyon',
    station_num: 0,
    arrival_planned_time: null,
    departure_planned_time: '07:14:00',
    ride_date: null,
  },
  {
    station_name: 'Lyon Part-Dieu',
    station_num: 5,
    arrival_planned_time: '09:00:00',
    departure_planned_time: null,
    ride_date: null,
  },
]

const mockTimetable = [
  {
    station_name: 'Berlin Hauptbahnhof',
    station_num: 1,
    arrival_planned_time: null,
    departure_planned_time: '2026-02-08 23:10:00',
    ride_date: '2026-02-08 00:00:00',
  },
  {
    station_name: 'Leipzig Hbf',
    station_num: 2,
    arrival_planned_time: '2026-02-09 00:55:00',
    departure_planned_time: '2026-02-09 01:03:00',
    ride_date: '2026-02-08 00:00:00',
  },
  {
    station_name: 'München Hbf',
    station_num: 3,
    arrival_planned_time: '2026-02-09 07:14:00',
    departure_planned_time: null,
    ride_date: '2026-02-08 00:00:00',
  },
]

function setupFetch(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    '/api/trains': mockTrains,
    '/api/timetable': mockTimetable,
  }
  const responses = { ...defaults, ...overrides }
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const path = url.toString().split('?')[0].replace('http://localhost', '')
    return Promise.resolve({
      json: () => Promise.resolve(responses[path] ?? []),
    } as Response)
  })
}

describe('TrainTimetableTab', () => {
  afterEach(() => jest.restoreAllMocks())

  it('shows a loading spinner while the train list is being fetched', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) // never resolves
    render(<TrainTimetableTab />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a loading spinner while the timetable is loading', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (url.toString().includes('/api/trains')) {
        return Promise.resolve({ json: () => Promise.resolve(mockTrains) } as Response)
      }
      return new Promise(() => {}) // timetable never resolves
    })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))
    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the Train label', async () => {
    setupFetch()
    render(<TrainTimetableTab />)
    expect(screen.getByText('Train')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))
  })

  it('renders train format hint on the same line as the Train label', async () => {
    setupFetch()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    const label = screen.getByText('Train')
    const hint = screen.getByText(/e\.g\. ICE 905/)
    expect(hint).toBeInTheDocument()
    expect(label.parentElement).toBe(hint.parentElement)
  })

  it('loads trains on mount and shows matching options when user types', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE')
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
  })

  it('shows an error message when trains fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    render(<TrainTimetableTab />)
    await waitFor(() => expect(screen.getByText('Failed to load train list')).toBeInTheDocument(), {
      timeout: 5_000,
    })
  })

  it('retries train list fetch when initial response is empty', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) } as Response)
      .mockResolvedValue({ json: () => Promise.resolve(mockTrains) } as Response)

    const user = userEvent.setup()
    render(<TrainTimetableTab />)

    await waitFor(() => {
      const trainRequests = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => url === '/api/trains'
      )
      expect(trainRequests).toHaveLength(2)
    })

    await waitFor(() => expect(screen.queryByText('Loading trains…')).not.toBeInTheDocument())
    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE')
    await waitFor(() => expect(screen.getByText('ICE 905')).toBeInTheDocument())
  })

  it('fetches timetable and renders table after selecting a train', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/timetable?train=ICE%20905')
      )
    )

    await waitFor(() =>
      expect(screen.getByText('Planned Timetable')).toBeInTheDocument()
    )
    expect(screen.getByText('Berlin Hauptbahnhof')).toBeInTheDocument()
    expect(screen.getByText('Leipzig Hbf')).toBeInTheDocument()
    expect(screen.getByText('München Hbf')).toBeInTheDocument()
  })

  it('formats planned times as HH:MM', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() => expect(screen.getByText('Planned Timetable')).toBeInTheDocument())
    expect(screen.getByText('23:10')).toBeInTheDocument()
    expect(screen.getByText('00:55')).toBeInTheDocument()
    expect(screen.getByText('07:14')).toBeInTheDocument()
  })

  it('shows em-dash for null arrival/departure times', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() => expect(screen.getByText('Planned Timetable')).toBeInTheDocument())
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2) // first and last station each have one null
  })

  it('shows the ride date in the table header', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() => expect(screen.getByText(/latest run: 2026-02-08/i)).toBeInTheDocument())
  })

  it('shows no-timetable message when API returns empty array', async () => {
    setupFetch({ '/api/timetable': [] })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() =>
      expect(screen.getByText('No timetable found for this train.')).toBeInTheDocument()
    )
  })

  it('shows an error message when timetable fetch fails', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (url.toString().includes('/api/trains')) {
        return Promise.resolve({ json: () => Promise.resolve(mockTrains) } as Response)
      }
      return Promise.reject(new Error('Network error'))
    })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'ICE 905')
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() =>
      expect(screen.getByText('Failed to load timetable')).toBeInTheDocument()
    )
  })

  it('includes railway=french in timetable URL when French train selected', async () => {
    setupFetch({ '/api/timetable': mockFrenchTimetable })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'TGV')
    await user.click(screen.getByText('TGV 6201'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('railway=french')
      )
    )
  })

  it('includes railway=eurostar in timetable URL when Eurostar train selected', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), '9002')
    await user.click(screen.getByText('9002'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('railway=eurostar')
      )
    )
  })

  it('renders GTFS time format (HH:MM:SS) as HH:MM', async () => {
    setupFetch({ '/api/timetable': mockFrenchTimetable })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'TGV')
    await user.click(screen.getByText('TGV 6201'))

    await waitFor(() => expect(screen.getByText('Planned Timetable')).toBeInTheDocument())
    expect(screen.getByText('07:14')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('does not show ride date when ride_date is null', async () => {
    setupFetch({ '/api/timetable': mockFrenchTimetable })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.type(screen.getByPlaceholderText(/ICE 905/i), 'TGV')
    await user.click(screen.getByText('TGV 6201'))

    await waitFor(() => expect(screen.getByText('Planned Timetable')).toBeInTheDocument())
    expect(screen.queryByText(/latest run/i)).not.toBeInTheDocument()
  })
})
