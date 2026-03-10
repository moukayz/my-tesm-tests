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

  it('renders the Train label', async () => {
    setupFetch()
    render(<TrainTimetableTab />)
    expect(screen.getByText('Train')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))
  })

  it('loads trains on mount and shows them in the dropdown on focus', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    expect(screen.getByText('TGV 6201')).toBeInTheDocument()
  })

  it('shows an error message when trains fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    render(<TrainTimetableTab />)
    await waitFor(() =>
      expect(screen.getByText('Failed to load train list')).toBeInTheDocument()
    )
  })

  it('fetches timetable and renders table after selecting a train', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() => expect(screen.getByText(/latest run: 2026-02-08/i)).toBeInTheDocument())
  })

  it('shows no-timetable message when API returns empty array', async () => {
    setupFetch({ '/api/timetable': [] })
    const user = userEvent.setup()
    render(<TrainTimetableTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
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

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('TGV 6201'))

    await waitFor(() => expect(screen.getByText('Planned Timetable')).toBeInTheDocument())
    expect(screen.queryByText(/latest run/i)).not.toBeInTheDocument()
  })
})
