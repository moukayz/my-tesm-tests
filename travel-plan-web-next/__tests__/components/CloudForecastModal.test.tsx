import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CloudForecastModal from '../../components/CloudForecastModal'

jest.mock('../../app/lib/hooks/useWeather', () => ({
  useHourlyCloud: jest.fn(),
}))

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { useHourlyCloud } from '../../app/lib/hooks/useWeather'

const mockCloudData = Array.from({ length: 12 }, (_, i) => ({
  time: `2026-03-25T${String(i).padStart(2, '0')}:00`,
  cloudCover: i * 8,
}))

describe('CloudForecastModal', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows loading spinner while data is loading', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: null, loading: true, error: null })
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders city name in the modal header', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: mockCloudData, loading: false, error: null })
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText(/Paris/)).toBeInTheDocument()
  })

  it('renders cloud forecast label', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: mockCloudData, loading: false, error: null })
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText(/12.hour cloud/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: mockCloudData, loading: false, error: null })
    const onClose = jest.fn()
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: mockCloudData, loading: false, error: null })
    const onClose = jest.fn()
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('cloud-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error message when fetch fails', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: null, loading: false, error: 'Failed to fetch' })
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })

  it('passes lat and lng to useHourlyCloud', () => {
    ;(useHourlyCloud as jest.Mock).mockReturnValue({ data: null, loading: true, error: null })
    render(<CloudForecastModal cityName="Paris" lat={48.85} lng={2.35} onClose={jest.fn()} />)
    expect(useHourlyCloud).toHaveBeenCalledWith(48.85, 2.35)
  })
})
