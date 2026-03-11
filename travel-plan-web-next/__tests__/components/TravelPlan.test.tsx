import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TravelPlan from '../../components/TravelPlan'
import type { RouteDay } from '../../app/lib/itinerary'

const mockRouteData: RouteDay[] = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
    train: [],
  },
]

// Keep component tests fast and focused — stub heavy child components
jest.mock('../../components/ItineraryTab', () => ({
  __esModule: true,
  default: () => <div data-testid="itinerary-tab">ItineraryTab</div>,
}))

jest.mock('../../components/TrainDelayTab', () => ({
  __esModule: true,
  default: () => <div data-testid="train-delay-tab">TrainDelayTab</div>,
}))

jest.mock('../../components/TrainTimetableTab', () => ({
  __esModule: true,
  default: () => <div data-testid="train-timetable-tab">TrainTimetableTab</div>,
}))

describe('TravelPlan', () => {
  it('renders the page heading', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    expect(screen.getByText('Travel Plan Itinerary')).toBeInTheDocument()
  })

  it('shows ItineraryTab by default when logged in', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    const itinerary = screen.getByTestId('itinerary-tab')
    const delays = screen.getByTestId('train-delay-tab')
    const timetable = screen.getByTestId('train-timetable-tab')
    expect(itinerary.parentElement).not.toHaveClass('hidden')
    expect(delays.parentElement).toHaveClass('hidden')
    expect(timetable.parentElement).toHaveClass('hidden')
  })

  it('switches to TrainDelayTab when Delays tab is clicked', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    fireEvent.click(screen.getByRole('button', { name: /train delays/i }))
    const itinerary = screen.getByTestId('itinerary-tab')
    const delays = screen.getByTestId('train-delay-tab')
    expect(itinerary.parentElement).toHaveClass('hidden')
    expect(delays.parentElement).not.toHaveClass('hidden')
  })

  it('switches to TrainTimetableTab when Timetable tab is clicked', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    fireEvent.click(screen.getByRole('button', { name: /^timetable$/i }))
    const itinerary = screen.getByTestId('itinerary-tab')
    const delays = screen.getByTestId('train-delay-tab')
    const timetable = screen.getByTestId('train-timetable-tab')
    expect(itinerary.parentElement).toHaveClass('hidden')
    expect(delays.parentElement).toHaveClass('hidden')
    expect(timetable.parentElement).not.toHaveClass('hidden')
  })

  it('switches back to ItineraryTab when Itinerary tab is clicked', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    fireEvent.click(screen.getByRole('button', { name: /train delays/i }))
    fireEvent.click(screen.getByRole('button', { name: /^itinerary$/i }))
    const itinerary = screen.getByTestId('itinerary-tab')
    expect(itinerary.parentElement).not.toHaveClass('hidden')
  })

  it('renders all three tab buttons when logged in', () => {
    render(<TravelPlan isLoggedIn={true} initialRouteData={mockRouteData} />)
    expect(screen.getByRole('button', { name: /^itinerary$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /train delays/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^timetable$/i })).toBeInTheDocument()
  })

  it('hides Itinerary tab button when not logged in', () => {
    render(<TravelPlan isLoggedIn={false} />)
    expect(screen.queryByRole('button', { name: /^itinerary$/i })).not.toBeInTheDocument()
  })

  it('shows Train Delays and Timetable buttons when not logged in', () => {
    render(<TravelPlan isLoggedIn={false} />)
    expect(screen.getByRole('button', { name: /train delays/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^timetable$/i })).toBeInTheDocument()
  })

  it('defaults to Train Delays tab when not logged in', () => {
    render(<TravelPlan isLoggedIn={false} />)
    const delays = screen.getByTestId('train-delay-tab')
    expect(delays.parentElement).not.toHaveClass('hidden')
  })

  it('does not render ItineraryTab content when not logged in', () => {
    render(<TravelPlan isLoggedIn={false} />)
    expect(screen.queryByTestId('itinerary-tab')).not.toBeInTheDocument()
  })
})
