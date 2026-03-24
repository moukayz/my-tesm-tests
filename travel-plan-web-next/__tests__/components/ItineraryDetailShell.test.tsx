import React from 'react'
import { render, screen } from '@testing-library/react'
import type { ItinerarySummary } from '../../app/lib/itinerary-store/types'
import ItineraryDetailShell from '../../components/ItineraryDetailShell'

jest.mock('../../components/ItineraryWorkspace', () => ({
  __esModule: true,
  default: () => <div data-testid="itinerary-workspace">workspace</div>,
}))

describe('ItineraryDetailShell', () => {
  it('renders workspace without standalone back button — navigation chrome is owned by ItineraryWorkspace', () => {
    const summary: ItinerarySummary = {
      id: 'iti-1',
      name: 'Paris Sprint',
      startDate: '2026-07-01',
      status: 'draft',
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z',
    }

    render(
      <ItineraryDetailShell
        selectedItineraryId="iti-1"
        selectedSummary={summary}
        onBackToCards={jest.fn()}
      />
    )

    // Back button is delegated to ItineraryWorkspace — shell renders no standalone back button
    expect(screen.queryByRole('button', { name: /back to all itineraries/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Back to all itineraries')).not.toBeInTheDocument()
    expect(screen.getByTestId('itinerary-detail-shell')).toHaveClass('w-full')
    expect(screen.getByTestId('itinerary-workspace')).toBeInTheDocument()
    expect(screen.queryByText('Paris Sprint')).not.toBeInTheDocument()
    expect(screen.queryByText('Start date: 2026-07-01')).not.toBeInTheDocument()
  })
})
