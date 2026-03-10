import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TrainDelayTab from '../../components/TrainDelayTab'

// Recharts uses ResizeObserver and SVG layout which are unavailable in jsdom
jest.mock('recharts', () => {
  const Recharts = jest.requireActual('recharts')
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  }
})

const mockTrains = [
  { train_name: 'ICE 905', train_type: 'ICE' },
  { train_name: 'TGV 6201', train_type: 'TGV' },
]
const mockStations = [
  { station_name: 'Berlin Hbf', station_num: 1 },
  { station_name: 'Frankfurt Hbf', station_num: 2 },
]
const mockDelayData = {
  stats: { total_stops: 90, avg_delay: 4.2, p50: 2.5, p75: 6.0, p90: 9.1, p95: 14.0, max_delay: 60 },
  trends: [{ day: '2024-01-10T00:00:00', avg_delay: 3.1, stops: 5 }],
}

function setupFetch(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    '/api/trains?railway=german': mockTrains,
    '/api/stations': mockStations,
    '/api/delay-stats': mockDelayData,
  }
  const responses = { ...defaults, ...overrides }
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const full = url.toString().replace('http://localhost', '')
    const path = full.split('?')[0]
    const key = responses[full] !== undefined ? full : path
    return Promise.resolve({
      json: () => Promise.resolve(responses[key] ?? []),
    } as Response)
  })
}

describe('TrainDelayTab', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renders the Train and Station labels', async () => {
    setupFetch()
    render(<TrainDelayTab />)
    expect(screen.getByText('Train')).toBeInTheDocument()
    expect(screen.getByText('Station')).toBeInTheDocument()
    // Flush the initial fetch so its state update lands inside act
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))
  })

  it('loads trains on mount and shows them in the dropdown on focus', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainDelayTab />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german')
    )
    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    expect(screen.getByText('TGV 6201')).toBeInTheDocument()
  })

  it('shows an error message when trains fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    render(<TrainDelayTab />)
    await waitFor(() =>
      expect(screen.getByText('Failed to load train list')).toBeInTheDocument()
    )
  })

  it('station input is disabled before a train is selected', async () => {
    setupFetch()
    render(<TrainDelayTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))
    expect(screen.getByPlaceholderText('Type to search station')).toBeDisabled()
  })

  it('loads stations and enables station input after selecting a train', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainDelayTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('ICE 905'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stations?train=ICE%20905')
      )
    )
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type to search station')).not.toBeDisabled()
    )
    await user.click(screen.getByPlaceholderText('Type to search station'))
    expect(screen.getByText('Berlin Hbf')).toBeInTheDocument()
  })

  it('shows stats grid and chart heading after selecting train and station', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainDelayTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('ICE 905'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type to search station')).not.toBeDisabled()
    )
    await user.click(screen.getByPlaceholderText('Type to search station'))
    await user.click(screen.getByText('Berlin Hbf'))

    await waitFor(() => expect(screen.getByText('Total Stops')).toBeInTheDocument())
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('Daily Avg Delay — Last 3 Months')).toBeInTheDocument()
  })

  it('shows no-data message when stats is null', async () => {
    setupFetch({ '/api/delay-stats': { stats: null, trends: [] } })
    const user = userEvent.setup()
    render(<TrainDelayTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('ICE 905'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type to search station')).not.toBeDisabled()
    )
    await user.click(screen.getByPlaceholderText('Type to search station'))
    await user.click(screen.getByText('Berlin Hbf'))

    await waitFor(() =>
      expect(
        screen.getByText(/No data found for this train\/station combination/)
      ).toBeInTheDocument()
    )
  })

  it('disables station input again when train input is cleared', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<TrainDelayTab />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/trains?railway=german'))

    await user.click(screen.getByPlaceholderText(/ICE 905/i))
    await user.click(screen.getByText('ICE 905'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type to search station')).not.toBeDisabled()
    )

    await user.clear(screen.getByPlaceholderText(/ICE 905/i))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Type to search station')).toBeDisabled()
    )
  })
})
