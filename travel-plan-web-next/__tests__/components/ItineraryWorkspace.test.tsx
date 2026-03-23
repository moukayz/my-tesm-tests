import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RouteDay } from '../../app/lib/itinerary'
import type { ItineraryWorkspace as ItineraryWorkspaceType } from '../../app/lib/itinerary-store/types'
import ItineraryWorkspace from '../../components/ItineraryWorkspace'

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

  it('renders one populated header with one Add next stay action', () => {
    render(<ItineraryWorkspace selectedItineraryId="iti-1" initialWorkspace={filledWorkspace} />)

    expect(screen.getByRole('heading', { name: /filled draft/i })).toBeInTheDocument()
    expect(screen.getByText('Start date: 2026-04-10')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /add next stay/i })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /edit stay for paris/i })).not.toBeInTheDocument()
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
