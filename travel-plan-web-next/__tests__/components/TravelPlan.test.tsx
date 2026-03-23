import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TravelPlan from '../../components/TravelPlan'
import type { RouteDay } from '../../app/lib/itinerary'
import type { ItinerarySummary, ItineraryWorkspace } from '../../app/lib/itinerary-store/types'

let searchParams = new URLSearchParams('tab=itinerary&itineraryId=iti-1')

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => searchParams,
}))

jest.mock('../../components/ItineraryPanel', () => ({
  __esModule: true,
  default: ({
    onDirtyStateChange,
    selectedItineraryId,
    selectedLegacyTabKey,
    onBackToCards,
    onSelectItinerary,
    onSelectStarterRoute,
  }: {
    onDirtyStateChange?: (isDirty: boolean) => void
    selectedItineraryId?: string
    selectedLegacyTabKey?: 'route'
    onBackToCards: () => void
    onSelectItinerary: (id: string) => void
    onSelectStarterRoute: (legacyTabKey: 'route') => void
  }) => (
    <div>
      <div data-testid="itinerary-panel">ItineraryPanel</div>
      <div data-testid="selected-itinerary-id">{selectedItineraryId ?? 'none'}</div>
      <div data-testid="selected-legacy-tab-key">{selectedLegacyTabKey ?? 'none'}</div>
      <button type="button" onClick={() => onDirtyStateChange?.(true)}>
        Mark dirty
      </button>
      <button type="button" onClick={onBackToCards}>
        Back to all itineraries
      </button>
      <button type="button" onClick={() => onSelectItinerary('iti-2')}>
        Open itinerary 2
      </button>
      <button type="button" onClick={() => onSelectStarterRoute('route')}>
        Open starter route
      </button>
    </div>
  ),
}))

jest.mock('../../components/ItineraryTab', () => ({
  __esModule: true,
  default: ({ tabKey }: { tabKey: string }) => <div data-testid={tabKey === 'route-test' ? 'itinerary-test-tab' : 'itinerary-tab'} />,
}))

jest.mock('../../components/TrainDelayTab', () => ({
  __esModule: true,
  default: () => <div data-testid="train-delay-tab" />,
}))

jest.mock('../../components/TrainTimetableTab', () => ({
  __esModule: true,
  default: () => <div data-testid="train-timetable-tab" />,
}))

jest.mock('../../components/CreateItineraryModal', () => ({
  __esModule: true,
  default: ({ isOpen, onSuccess }: { isOpen: boolean; onSuccess: (resp: { itinerary: { id: string }; workspaceUrl: string }) => void }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() => onSuccess({ itinerary: { id: 'iti-new' }, workspaceUrl: '/?tab=itinerary&itineraryId=iti-new' })}
      >
        Submit create
      </button>
    ) : null,
}))

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

const mockWorkspace: ItineraryWorkspace = {
  itinerary: {
    id: 'iti-1',
    name: 'Draft',
    startDate: '2026-04-01',
    status: 'draft',
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  stays: [],
  days: [],
}

const mockSummaries: ItinerarySummary[] = [
  {
    id: 'iti-1',
    name: 'Draft',
    startDate: '2026-04-01',
    status: 'draft',
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
]

describe('TravelPlan', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams('tab=itinerary&itineraryId=iti-1')
    window.history.replaceState(window.history.state, '', '/?tab=itinerary&itineraryId=iti-1')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response)
  })

  it('shows new itinerary button on itinerary tab for logged-in user', () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    expect(screen.getByRole('button', { name: /new itinerary/i })).toBeInTheDocument()
  })

  it('updates browser URL when user switches tabs', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /train delays/i }))

    expect(window.location.search).toContain('tab=delays')
    expect(window.location.search).toContain('itineraryId=iti-1')
  })

  it('switches visible tab content immediately on click before url sync', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    const timetablePanel = screen.getByTestId('train-timetable-tab').parentElement
    expect(timetablePanel).toHaveClass('hidden')

    await userEvent.click(screen.getByRole('button', { name: /timetable/i }))

    expect(timetablePanel).toHaveClass('w-full')
  })

  it('blocks tab switch when workspace reports unsaved inline edits', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /mark dirty/i }))
    await userEvent.click(screen.getByRole('button', { name: /train delays/i }))

    expect(window.location.search).toContain('tab=itinerary')
  })

  it('creates itinerary and canonicalizes URL with replaceState', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /new itinerary/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit create/i }))

    expect(window.location.search).toContain('tab=itinerary')
    expect(window.location.search).toContain('itineraryId=iti-new')
  })

  it('keeps newly created itinerary selected before URL params refresh', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    expect(screen.getByTestId('selected-itinerary-id')).toHaveTextContent('iti-1')

    await userEvent.click(screen.getByRole('button', { name: /new itinerary/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit create/i }))

    expect(screen.getByTestId('selected-itinerary-id')).toHaveTextContent('iti-new')
  })

  it('hides itinerary tabs for logged-out users', () => {
    render(<TravelPlan isLoggedIn={false} />)

    expect(screen.queryByRole('button', { name: /^itinerary$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /itinerary \(test\)/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /train delays/i })).toBeInTheDocument()
  })

  it('defaults itinerary tab to cards-first selection when itineraryId is absent', () => {
    searchParams = new URLSearchParams('tab=itinerary')

    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={null}
        initialItinerarySummaries={mockSummaries}
      />
    )

    expect(screen.getByTestId('selected-itinerary-id')).toHaveTextContent('none')
  })

  it('clears itineraryId from URL when detail requests back to cards', async () => {
    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItineraryId="iti-1"
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /back to all itineraries/i }))

    expect(window.location.search).toBe('?tab=itinerary')
  })

  it('opens selected card via URL param sync', async () => {
    searchParams = new URLSearchParams('tab=itinerary')

    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={null}
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /open itinerary 2/i }))

    expect(window.location.search).toContain('tab=itinerary')
    expect(window.location.search).toContain('itineraryId=iti-2')
  })

  it('opens starter route card via legacyTabKey url param', async () => {
    searchParams = new URLSearchParams('tab=itinerary')

    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={null}
        initialItinerarySummaries={mockSummaries}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /open starter route/i }))

    expect(window.location.search).toContain('tab=itinerary')
    expect(window.location.search).toContain('legacyTabKey=route')
  })

  it('prioritizes itineraryId over legacyTabKey when both are present', () => {
    searchParams = new URLSearchParams('tab=itinerary&itineraryId=iti-1&legacyTabKey=route')

    render(
      <TravelPlan
        isLoggedIn={true}
        initialRouteData={mockRouteData}
        initialItineraryWorkspace={mockWorkspace}
        initialItinerarySummaries={mockSummaries}
      />
    )

    expect(screen.getByTestId('selected-itinerary-id')).toHaveTextContent('iti-1')
    expect(screen.getByTestId('selected-legacy-tab-key')).toHaveTextContent('none')
  })
})
