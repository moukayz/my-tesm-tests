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
  it('renders user itineraries', async () => {
    const onOpenItinerary = jest.fn()

    render(
      <ItineraryCardsView
        itineraries={itineraries}
        onOpenItinerary={onOpenItinerary}
        onCreateItinerary={jest.fn()}
      />
    )

    expect(await screen.findByRole('heading', { name: /your itineraries/i })).toBeInTheDocument()
    expect(screen.getByTestId('itinerary-cards-rail')).toHaveClass('w-full')

    await userEvent.click(await screen.findByRole('button', { name: /open itinerary paris week/i }))
    expect(onOpenItinerary).toHaveBeenCalledWith('iti-1')
    expect(onOpenItinerary).toHaveBeenCalledTimes(1)
  })

  it('shows empty-state create action when no itineraries exist', async () => {
    const onCreateItinerary = jest.fn()

    render(
      <ItineraryCardsView
        itineraries={[]}
        onOpenItinerary={jest.fn()}
        onCreateItinerary={onCreateItinerary}
      />
    )

    expect(screen.getByText(/no itineraries yet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /new itinerary/i }))
    expect(onCreateItinerary).toHaveBeenCalled()
  })

  it('shows two shimmer skeleton cards when isLoading is true', () => {
    render(
      <ItineraryCardsView
        itineraries={[]}
        isLoading={true}
        onOpenItinerary={jest.fn()}
        onCreateItinerary={jest.fn()}
      />
    )

    expect(screen.getAllByTestId('itinerary-card-skeleton')).toHaveLength(2)
    expect(screen.queryByText(/no itineraries yet/i)).not.toBeInTheDocument()
  })

  it('shows "Your itineraries" heading when isLoading is true', () => {
    render(
      <ItineraryCardsView
        itineraries={[]}
        isLoading={true}
        onOpenItinerary={jest.fn()}
        onCreateItinerary={jest.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: /your itineraries/i })).toBeInTheDocument()
  })
})
