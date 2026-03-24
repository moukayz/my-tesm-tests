import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ItinerarySummary, ItineraryWorkspace } from '../../app/lib/itinerary-store/types'
import ItineraryPanel from '../../components/ItineraryPanel'

jest.mock('../../components/AttractionMiniMap', () => ({
  __esModule: true,
  default: () => <div data-testid="attraction-minimap-placeholder" />,
}))

jest.mock('../../components/ItineraryWorkspace', () => ({
  __esModule: true,
  default: ({
    onDirtyStateChange,
    onBackToCards,
  }: {
    onDirtyStateChange?: (isDirty: boolean) => void
    onBackToCards?: () => void
  }) => (
    <div>
      <button type="button" aria-label="Back to all itineraries" onClick={() => onBackToCards?.()}>
        Back
      </button>
      <div data-testid="itinerary-workspace">ItineraryWorkspace</div>
      <button type="button" onClick={() => onDirtyStateChange?.(true)}>
        Mark dirty
      </button>
    </div>
  ),
}))

const summaries: ItinerarySummary[] = [
  {
    id: 'iti-1',
    name: 'Paris Week',
    startDate: '2026-04-01',
    status: 'draft',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
]

const workspace: ItineraryWorkspace = {
  itinerary: summaries[0],
  stays: [],
  days: [],
}

describe('ItineraryPanel', () => {
  it('renders cards view by default and opens a selected itinerary', async () => {
    const onSelectItinerary = jest.fn()

    render(
      <ItineraryPanel
        selectedItineraryId={undefined}
        itinerarySummaries={summaries}
        onSelectItinerary={onSelectItinerary}
        onBackToCards={jest.fn()}
        onRequestCreateItinerary={jest.fn()}
      />
    )

    await userEvent.click(await screen.findByRole('button', { name: /open itinerary paris week/i }))

    expect(onSelectItinerary).toHaveBeenCalledWith('iti-1')
  })

  it('shows empty cards state with a create action', async () => {
    const onRequestCreateItinerary = jest.fn()

    render(
      <ItineraryPanel
        selectedItineraryId={undefined}
        itinerarySummaries={[]}
        onSelectItinerary={jest.fn()}
        onBackToCards={jest.fn()}
        onRequestCreateItinerary={onRequestCreateItinerary}
      />
    )

    expect(screen.getByText(/no itineraries yet/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /new itinerary/i }))

    expect(onRequestCreateItinerary).toHaveBeenCalled()
  })

  it('renders detail shell with back action', async () => {
    const onBackToCards = jest.fn()

    render(
      <ItineraryPanel
        selectedItineraryId="iti-1"
        itinerarySummaries={summaries}
        initialWorkspace={workspace}
        onSelectItinerary={jest.fn()}
        onBackToCards={onBackToCards}
        onRequestCreateItinerary={jest.fn()}
      />
    )

    expect(screen.getByTestId('itinerary-workspace')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /back to all itineraries/i }))

    expect(onBackToCards).toHaveBeenCalled()
  })

  it('guards back navigation when there are unsaved edits', async () => {
    const onBackToCards = jest.fn()

    render(
      <ItineraryPanel
        selectedItineraryId="iti-1"
        itinerarySummaries={summaries}
        initialWorkspace={workspace}
        onSelectItinerary={jest.fn()}
        onBackToCards={onBackToCards}
        onRequestCreateItinerary={jest.fn()}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /mark dirty/i }))
    await userEvent.click(screen.getByRole('button', { name: /back to all itineraries/i }))

    expect(screen.getByRole('dialog', { name: /discard unsaved edits/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /keep editing/i }))
    expect(onBackToCards).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /back to all itineraries/i }))
    await userEvent.click(screen.getByRole('button', { name: /leave without saving/i }))

    expect(onBackToCards).toHaveBeenCalled()
  })
})
