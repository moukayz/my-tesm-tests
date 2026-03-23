import React from 'react'
import { render, screen } from '@testing-library/react'
import type { ItinerarySummary } from '../../app/lib/itinerary-store/types'
import ItineraryDetailShell from '../../components/ItineraryDetailShell'

jest.mock('../../components/ItineraryTab', () => ({
  __esModule: true,
  default: () => <div data-testid="itinerary-tab">legacy-tab</div>,
}))

jest.mock('../../components/ItineraryWorkspace', () => ({
  __esModule: true,
  default: () => <div data-testid="itinerary-workspace">workspace</div>,
}))

describe('ItineraryDetailShell', () => {
  it('renders only back navigation chrome without duplicate itinerary metadata', () => {
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
        selectedLegacyTabKey={undefined}
        selectedSummary={summary}
        initialRouteData={[]}
        onBackToCards={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /back to all itineraries/i })).toBeInTheDocument()
    expect(screen.queryByText('Back to all itineraries')).not.toBeInTheDocument()
    expect(screen.getByTestId('itinerary-detail-shell')).toHaveClass('w-full')
    expect(screen.getByTestId('itinerary-workspace')).toBeInTheDocument()
    expect(screen.queryByText('Paris Sprint')).not.toBeInTheDocument()
    expect(screen.queryByText('Start date: 2026-07-01')).not.toBeInTheDocument()
  })

  it('renders legacy route detail when legacy tab key is selected', () => {
    render(
      <ItineraryDetailShell
        selectedItineraryId={undefined}
        selectedLegacyTabKey="route"
        initialRouteData={[]}
        onBackToCards={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /back to all itineraries/i })).toBeInTheDocument()
    expect(screen.queryByText('Back to all itineraries')).not.toBeInTheDocument()
    expect(screen.getByTestId('itinerary-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('itinerary-workspace')).not.toBeInTheDocument()
  })
})
