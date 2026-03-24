import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteDay } from '../../app/lib/itinerary'
import type { ItineraryWorkspace as ItineraryWorkspaceType } from '../../app/lib/itinerary-store/types'
import ItineraryWorkspace from '../../components/ItineraryWorkspace'

jest.mock('../../components/ItineraryRouteMap', () => ({
  __esModule: true,
  default: ({ stays }: { stays: unknown[] }) => (
    <div data-testid="route-map-mock">stays:{stays.length}</div>
  ),
}))

jest.mock('../../components/ItineraryTab', () => ({
  __esModule: true,
  default: ({
    initialData,
    onRequestEditStay,
    onMoveStay,
  }: {
    initialData: RouteDay[]
    onRequestEditStay?: (stayIndex: number) => void
    onMoveStay?: (stayIndex: number, direction: 'up' | 'down') => void
  }) => (
    <div data-testid="itinerary-tab">
      <span data-testid="first-overnight">{initialData[0]?.overnight ?? ''}</span>
      <button type="button" onClick={() => onRequestEditStay?.(0)}>
        Request stay edit 0
      </button>
      <button type="button" onClick={() => onMoveStay?.(0, 'down')}>
        Move stay 0 down
      </button>
    </div>
  ),
}))

const emptyWorkspace: ItineraryWorkspaceType = {
  itinerary: {
    id: 'iti-1',
    name: 'Empty draft',
    startDate: '2026-04-10',
    status: 'draft',
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
  },
  stays: [],
  days: [],
}

const filledWorkspace: ItineraryWorkspaceType = {
  itinerary: {
    ...emptyWorkspace.itinerary,
    name: 'Filled draft',
  },
  stays: [
    {
      stayIndex: 0,
      city: 'Paris',
      nights: 2,
      startDayIndex: 0,
      endDayIndex: 1,
      isLastStay: true,
      location: {
        kind: 'custom',
        label: 'Paris',
        queryText: 'Paris',
      },
    },
  ],
  days: [
    {
      date: '2026/4/10',
      weekDay: '星期五',
      dayNum: 1,
      overnight: 'Paris',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    },
    {
      date: '2026/4/11',
      weekDay: '星期六',
      dayNum: 2,
      overnight: 'Paris',
      plan: { morning: '', afternoon: '', evening: '' },
      train: [],
    },
  ],
}

const twoStayWorkspace: ItineraryWorkspaceType = {
  itinerary: { ...emptyWorkspace.itinerary, id: 'iti-2', name: 'Two stays', startDate: '2026-04-10' },
  stays: [
    { stayIndex: 0, city: 'Paris', nights: 1, startDayIndex: 0, endDayIndex: 0, isLastStay: false, location: { kind: 'custom', label: 'Paris', queryText: 'Paris' } },
    { stayIndex: 1, city: 'Lyon', nights: 1, startDayIndex: 1, endDayIndex: 1, isLastStay: true, location: { kind: 'custom', label: 'Lyon', queryText: 'Lyon' } },
  ],
  days: [
    { date: '2026/4/10', weekDay: '星期五', dayNum: 1, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
    { date: '2026/4/11', weekDay: '星期六', dayNum: 2, overnight: 'Lyon', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
  ],
}

describe('ItineraryWorkspace', () => {
  afterEach(() => jest.restoreAllMocks())

  it('loads the selected itinerary workspace when selection changes', async () => {
    const selectedWorkspace: ItineraryWorkspaceType = {
      ...emptyWorkspace,
      itinerary: {
        ...emptyWorkspace.itinerary,
        id: 'iti-2',
        name: 'Selected draft',
      },
    }

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => selectedWorkspace,
      } as Response)
    )

    render(<ItineraryWorkspace selectedItineraryId="iti-2" initialWorkspace={emptyWorkspace} />)

    expect(screen.getByText(/loading itinerary workspace/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/itineraries/iti-2')
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /selected draft/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /add first stay/i })).toBeInTheDocument()
  })

  it('renders empty state and adds first stay', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => filledWorkspace,
      } as Response)
    )

    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={emptyWorkspace} />)

    expect(screen.getByText(/add your first stay/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /add first stay/i }))
    await userEvent.type(screen.getByLabelText(/city/i), 'Paris')
    await userEvent.clear(screen.getByLabelText(/nights/i))
    await userEvent.type(screen.getByLabelText(/nights/i), '2')
    await userEvent.click(screen.getByRole('button', { name: /create stay/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-1/stays',
        expect.objectContaining({ method: 'POST' })
      )
    })

    const postCall = (global.fetch as jest.Mock).mock.calls.find((call) => call[0] === '/api/itineraries/iti-1/stays')
    expect(postCall).toBeDefined()
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({
      city: 'Paris',
      nights: 2,
      location: {
        kind: 'custom',
        label: 'Paris',
        queryText: 'Paris',
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('itinerary-tab')).toBeInTheDocument()
    })
  })

  it('submits full edit stay city and nights', async () => {
    const patchedWorkspace: ItineraryWorkspaceType = {
      ...filledWorkspace,
      stays: [
        {
          ...filledWorkspace.stays[0],
          city: 'Lyon',
          nights: 3,
        },
      ],
      days: [
        ...filledWorkspace.days,
        {
          date: '2026/4/12',
          weekDay: '星期日',
          dayNum: 3,
          overnight: 'Lyon',
          plan: { morning: '', afternoon: '', evening: '' },
          train: [],
        },
      ],
    }

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => patchedWorkspace,
      } as Response)
    )

    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={filledWorkspace} />)

    await userEvent.click(screen.getByRole('button', { name: /request stay edit 0/i }))
    await userEvent.clear(screen.getByLabelText(/city/i))
    await userEvent.type(screen.getByLabelText(/city/i), 'Lyon')
    await userEvent.clear(screen.getByLabelText(/nights/i))
    await userEvent.type(screen.getByLabelText(/nights/i), '3')
    await userEvent.click(screen.getByRole('button', { name: /save stay/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-1/stays/0',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    const patchCall = (global.fetch as jest.Mock).mock.calls.find((call) => call[0] === '/api/itineraries/iti-1/stays/0')
    expect(patchCall).toBeDefined()
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({
      city: 'Lyon',
      nights: 3,
      location: {
        kind: 'custom',
        label: 'Lyon',
        queryText: 'Lyon',
      },
    })
  })

  it('renders banner with trip summary and a single Add next stay action', () => {
    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={filledWorkspace} />)

    expect(screen.getByRole('heading', { name: /filled draft/i })).toBeInTheDocument()
    // Date range and total days are shown; old "Start date:" label is gone
    expect(screen.queryByText(/start date:/i)).not.toBeInTheDocument()
    // Formatted date range and total days
    expect(screen.getByText(/Apr 10.*Apr 11/)).toBeInTheDocument()
    expect(screen.getByText(/2 days/i)).toBeInTheDocument()
    // City breakdown with compact nights notation
    expect(screen.getByText(/paris.*2n/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /add next stay/i })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /edit stay for paris/i })).not.toBeInTheDocument()
  })

  it('renders back button alongside Add next stay in the same control row', () => {
    const onBackToCards = jest.fn()
    render(
      <ItineraryWorkspace
        selectedItineraryId="iti-1"
        initialWorkspace={filledWorkspace}
        onBackToCards={onBackToCards}
      />
    )

    const backBtn = screen.getByRole('button', { name: /back to all itineraries/i })
    const addBtn = screen.getByRole('button', { name: /add next stay/i })
    expect(backBtn).toBeInTheDocument()
    expect(addBtn).toBeInTheDocument()
    // Both buttons share the same parent container (same control row)
    expect(backBtn.parentElement).toBe(addBtn.parentElement)
  })

  it('renders back button without Add next stay when workspace is empty', () => {
    const onBackToCards = jest.fn()
    render(
      <ItineraryWorkspace
        selectedItineraryId="iti-1"
        initialWorkspace={emptyWorkspace}
        onBackToCards={onBackToCards}
      />
    )

    expect(screen.getByRole('button', { name: /back to all itineraries/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add next stay/i })).not.toBeInTheDocument()
  })

  it('shows country breakdown in banner when stays have resolved locations', () => {
    const workspaceWithCountries: ItineraryWorkspaceType = {
      itinerary: { ...emptyWorkspace.itinerary, name: 'Euro trip', startDate: '2026-05-01' },
      stays: [
        {
          stayIndex: 0,
          city: 'Paris',
          nights: 3,
          startDayIndex: 0,
          endDayIndex: 2,
          isLastStay: false,
          location: {
            kind: 'resolved',
            label: 'Paris, France',
            queryText: 'Paris',
            coordinates: { lat: 48.85, lng: 2.35 },
            place: { placeId: 'geo:1', name: 'Paris', country: 'France', countryCode: 'FR', featureType: 'locality' },
          },
        },
        {
          stayIndex: 1,
          city: 'Berlin',
          nights: 2,
          startDayIndex: 3,
          endDayIndex: 4,
          isLastStay: true,
          location: {
            kind: 'resolved',
            label: 'Berlin, Germany',
            queryText: 'Berlin',
            coordinates: { lat: 52.52, lng: 13.4 },
            place: { placeId: 'geo:2', name: 'Berlin', country: 'Germany', countryCode: 'DE', featureType: 'locality' },
          },
        },
      ],
      days: [
        { date: '2026/5/1', weekDay: '星期五', dayNum: 1, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
        { date: '2026/5/2', weekDay: '星期六', dayNum: 2, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
        { date: '2026/5/3', weekDay: '星期日', dayNum: 3, overnight: 'Paris', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
        { date: '2026/5/4', weekDay: '星期一', dayNum: 4, overnight: 'Berlin', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
        { date: '2026/5/5', weekDay: '星期二', dayNum: 5, overnight: 'Berlin', plan: { morning: '', afternoon: '', evening: '' }, train: [] },
      ],
    }

    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={workspaceWithCountries} />)

    expect(screen.getByText(/france.*3n/i)).toBeInTheDocument()
    expect(screen.getByText(/germany.*2n/i)).toBeInTheDocument()
    // Cities appear as sub-items under their country, without country postfix
    expect(screen.getByText('Paris (3n)')).toBeInTheDocument()
    expect(screen.getByText('Berlin (2n)')).toBeInTheDocument()
  })

  it('shows multi-city country group without repeating country in each city label', () => {
    const multiCityWorkspace: ItineraryWorkspaceType = {
      itinerary: { ...emptyWorkspace.itinerary, name: 'Italy trip', startDate: '2026-06-01' },
      stays: [
        {
          stayIndex: 0, city: 'Florence', nights: 3, startDayIndex: 0, endDayIndex: 2, isLastStay: false,
          location: { kind: 'resolved', label: 'Florence, Italy', queryText: 'Florence', coordinates: { lat: 43.77, lng: 11.25 },
            place: { placeId: 'geo:3', name: 'Florence', country: 'Italy', countryCode: 'IT', featureType: 'locality' } },
        },
        {
          stayIndex: 1, city: 'Rome', nights: 4, startDayIndex: 3, endDayIndex: 6, isLastStay: true,
          location: { kind: 'resolved', label: 'Rome, Italy', queryText: 'Rome', coordinates: { lat: 41.9, lng: 12.5 },
            place: { placeId: 'geo:4', name: 'Rome', country: 'Italy', countryCode: 'IT', featureType: 'locality' } },
        },
      ],
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026/6/${i + 1}`, weekDay: '', dayNum: i + 1,
        overnight: i < 3 ? 'Florence' : 'Rome',
        plan: { morning: '', afternoon: '', evening: '' }, train: [],
      })),
    }

    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={multiCityWorkspace} />)

    // Country header shows total nights
    expect(screen.getByText('Italy (7n)')).toBeInTheDocument()
    // Each city as its own item, no country appended
    expect(screen.getByText('Florence (3n)')).toBeInTheDocument()
    expect(screen.getByText('Rome (4n)')).toBeInTheDocument()
  })

  it('omits country row in banner when all stays have custom locations', () => {
    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={filledWorkspace} />)

    // filledWorkspace has only custom-location stays → no country info
    expect(screen.queryByText(/france/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/germany/i)).not.toBeInTheDocument()
  })

  it('optimistically reorders days before API resolves', async () => {
    let resolveFetch!: (value: Response) => void
    global.fetch = jest.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve })
    )

    render(<ItineraryWorkspace selectedItineraryId="iti-2" initialWorkspace={twoStayWorkspace} />)

    expect(screen.getByTestId('first-overnight').textContent).toBe('Paris')

    await userEvent.click(screen.getByRole('button', { name: /move stay 0 down/i }))

    // UI updates immediately before fetch resolves
    expect(screen.getByTestId('first-overnight').textContent).toBe('Lyon')

    // Resolve fetch with authoritative response
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        ...twoStayWorkspace,
        days: [
          { ...twoStayWorkspace.days[1], dayNum: 1 },
          { ...twoStayWorkspace.days[0], dayNum: 2 },
        ],
      }),
    } as Response)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itineraries/iti-2/stays/0/move',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ direction: 'down' }) })
      )
    })
  })

  it('reverts optimistic update when API fails', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'INTERNAL_ERROR' }) } as Response)
    )

    render(<ItineraryWorkspace selectedItineraryId="iti-2" initialWorkspace={twoStayWorkspace} />)

    expect(screen.getByTestId('first-overnight').textContent).toBe('Paris')

    await userEvent.click(screen.getByRole('button', { name: /move stay 0 down/i }))

    await waitFor(() => {
      expect(screen.getByTestId('first-overnight').textContent).toBe('Paris')
    })
  })

  it('shows recoverable back action for not-found workspace errors', async () => {
    const onBackToCards = jest.fn()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'ITINERARY_NOT_FOUND' }),
      } as Response)
    )

    render(
      <ItineraryWorkspace
        selectedItineraryId="iti-missing"
        initialWorkspace={null}
        onBackToCards={onBackToCards}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to all itineraries/i })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /back to all itineraries/i }))

    expect(onBackToCards).toHaveBeenCalled()
  })
})
