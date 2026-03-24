import { renderHook, act } from '@testing-library/react'
import { useTrainSchedules } from '../../app/lib/hooks/useTrainSchedules'
import type { RouteDay } from '../../app/lib/itinerary'

const mockDay = (trainId: string): RouteDay => ({
  overnight: 'Paris',
  date: '2024-01-01',
  weekDay: 'Mon',
  dayNum: 1,
  train: [{ train_id: trainId, start: 'Paris', end: 'Lyon' }],
  attractions: [],
  plan: { morning: '', afternoon: '', evening: '' },
})

describe('useTrainSchedules', () => {
  let abortSpy: jest.SpyInstance
  let fetchMock: jest.Mock

  beforeEach(() => {
    abortSpy = jest.spyOn(AbortController.prototype, 'abort')
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    jest.restoreAllMocks()
  })

  it('aborts in-flight requests when days change', async () => {
    // First fetch hangs until aborted
    let resolveFirst!: (value: Response) => void
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { resolveFirst = resolve })
    )
    fetchMock.mockResolvedValue({
      json: async () => [],
    } as Response)

    const { rerender } = renderHook(
      ({ days }: { days: RouteDay[] }) => useTrainSchedules(days),
      { initialProps: { days: [mockDay('ICE 1')] } }
    )

    // Trigger rerender with new days — should abort the first pending fetch
    act(() => {
      rerender({ days: [mockDay('ICE 2')] })
    })

    expect(abortSpy).toHaveBeenCalledTimes(1)

    // Flush state updates from ICE 2's resolved fetch (mockResolvedValue resolves immediately)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Resolve the first fetch after abort — should not update state
    resolveFirst({ json: async () => [{ station_name: 'Paris', station_num: 1, arrival_planned_time: null, departure_planned_time: '10:00', ride_date: null }] } as Response)
  })

  it('aborts pending requests on unmount', async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {})) // never resolves

    const { unmount } = renderHook(
      ({ days }: { days: RouteDay[] }) => useTrainSchedules(days),
      { initialProps: { days: [mockDay('ICE 1')] } }
    )

    act(() => {
      unmount()
    })

    expect(abortSpy).toHaveBeenCalledTimes(1)
  })

  it('returns schedules on successful fetch', async () => {
    const timetableRows = [
      { station_name: 'Paris', station_num: 1, arrival_planned_time: null, departure_planned_time: '2024-01-01 08:00:00', ride_date: '2024-01-01' },
      { station_name: 'Lyon', station_num: 5, arrival_planned_time: '2024-01-01 10:00:00', departure_planned_time: null, ride_date: '2024-01-01' },
    ]
    fetchMock.mockResolvedValue({ json: async () => timetableRows } as Response)

    const { result } = renderHook(
      ({ days }: { days: RouteDay[] }) => useTrainSchedules(days),
      { initialProps: { days: [mockDay('ICE 101')] } }
    )

    // Wait for async fetch to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.schedulesLoading).toBe(false)
    const keys = Object.keys(result.current.trainSchedules)
    expect(keys.length).toBe(1)
  })
})
