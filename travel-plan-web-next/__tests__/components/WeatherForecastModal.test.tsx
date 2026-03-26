import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import WeatherForecastModal from '../../components/WeatherForecastModal'

jest.mock('../../app/lib/hooks/useWeather', () => ({
  useDailyWeather: jest.fn(),
}))

// recharts uses ResizeObserver; mock it
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { useDailyWeather } from '../../app/lib/hooks/useWeather'

const mockDailyData = [
  { date: '2026-03-25', maxTemp: 15, minTemp: 8, description: 'Clear sky ☀️' },
  { date: '2026-03-26', maxTemp: 17, minTemp: 9, description: 'Partly cloudy 🌤' },
  { date: '2026-03-27', maxTemp: 14, minTemp: 7, description: 'Rain 🌧' },
  { date: '2026-03-28', maxTemp: 12, minTemp: 5, description: 'Partly cloudy 🌤' },
  { date: '2026-03-29', maxTemp: 16, minTemp: 10, description: 'Showers 🌦' },
]

const mockDailyDataWithUnknown = [
  { date: '2026-03-25', maxTemp: 15, minTemp: 8, description: 'Unknown ❓' },
]

describe('WeatherForecastModal', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows skeleton while data is loading', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: null, loading: true, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByTestId('weather-skeleton')).toBeInTheDocument()
  })

  it('does not show spinner while data is loading', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: null, loading: true, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders city name in the modal header', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: mockDailyData, loading: false, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
  })

  it('renders weather icons with description tooltips for each day', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: mockDailyData, loading: false, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    // Only emoji shown; full description is the title tooltip
    expect(screen.getByTitle('Clear sky ☀️')).toBeInTheDocument()
    expect(screen.getByTitle('Rain 🌧')).toBeInTheDocument()
    // Full text should not be rendered directly
    expect(screen.queryByText('Clear sky ☀️')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: mockDailyData, loading: false, error: null })
    const onClose = jest.fn()
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: mockDailyData, loading: false, error: null })
    const onClose = jest.fn()
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('weather-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error message when fetch fails', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: null, loading: false, error: 'Failed to fetch' })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })

  it('shows ❓ icon and not the word "Unknown" for unknown weather code', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: mockDailyDataWithUnknown, loading: false, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText('❓')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('passes lat and lng to useDailyWeather', () => {
    ;(useDailyWeather as jest.Mock).mockReturnValue({ data: null, loading: true, error: null })
    render(<WeatherForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(useDailyWeather).toHaveBeenCalledWith(48.85, 2.35)
  })
})
