import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ItinerarySummary } from '../../app/lib/itinerary-store/types'
import ItineraryCardsView from '../../components/ItineraryCardsView'

const itineraries: ItinerarySummary[] = [
  {
    id: 'iti-1',
    name: 'Paris Week',
    startDate: '2026-04-01',
    status: 'draft',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
]

describe('ItineraryCardsView', () => {
  it('renders starter route card before user itineraries', async () => {
    const onOpenStarterRoute = jest.fn()
    const onOpenItinerary = jest.fn()

    render(
      <ItineraryCardsView
        itineraries={itineraries}
        starterRouteCard={{
          legacyTabKey: 'route',
          name: 'Original seeded route',
          startDate: '2026/9/25',
          dayCount: 16,
          stayCount: 4,
        }}
        onOpenStarterRoute={onOpenStarterRoute}
        onOpenItinerary={onOpenItinerary}
        onCreateItinerary={jest.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: /starter route/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open itinerary original seeded route/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /your itineraries/i })).toBeInTheDocument()
    expect(screen.getByTestId('itinerary-cards-rail')).toHaveClass('w-full')
    expect(screen.getByTestId('itinerary-card-starter-route')).toHaveClass('w-full', 'p-6')

    await userEvent.click(screen.getByRole('button', { name: /open itinerary original seeded route/i }))
    expect(onOpenStarterRoute).toHaveBeenCalledWith('route')
    expect(onOpenStarterRoute).toHaveBeenCalledTimes(1)

    await userEvent.click(await screen.findByRole('button', { name: /open itinerary paris week/i }))
    expect(onOpenItinerary).toHaveBeenCalledWith('iti-1')
    expect(onOpenItinerary).toHaveBeenCalledTimes(1)
  })

  it('copy to my itineraries button calls onCopyStarterRoute', async () => {
    const onCopyStarterRoute = jest.fn()

    render(
      <ItineraryCardsView
        itineraries={[]}
        starterRouteCard={{
          legacyTabKey: 'route',
          name: 'Original seeded route',
          startDate: '2026/9/25',
          dayCount: 16,
          stayCount: 4,
        }}
        onOpenStarterRoute={jest.fn()}
        onOpenItinerary={jest.fn()}
        onCreateItinerary={jest.fn()}
        onCopyStarterRoute={onCopyStarterRoute}
      />
    )

    const copyBtn = screen.getByRole('button', { name: /copy to my itineraries/i })
    expect(copyBtn).toBeInTheDocument()
    await userEvent.click(copyBtn)
    expect(onCopyStarterRoute).toHaveBeenCalledTimes(1)
  })

  it('shows empty-state create action when no cards exist', async () => {
    const onCreateItinerary = jest.fn()

    render(
      <ItineraryCardsView
        itineraries={[]}
        starterRouteCard={null}
        onOpenStarterRoute={jest.fn()}
        onOpenItinerary={jest.fn()}
        onCreateItinerary={onCreateItinerary}
      />
    )

    expect(screen.getByText(/no itineraries yet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /new itinerary/i }))
    expect(onCreateItinerary).toHaveBeenCalled()
  })
})
