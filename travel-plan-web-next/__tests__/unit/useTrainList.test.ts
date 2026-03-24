import { renderHook, act } from '@testing-library/react'
import { useTrainList } from '../../app/lib/hooks/useTrainList'

const mockTrains = [
  { train_name: 'ICE 905', railway: 'german' },
  { train_name: 'TGV 8088', railway: 'french' },
]

describe('useTrainList', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('fetches trains on mount and sets them on success', async () => {
    fetchMock.mockResolvedValue({ json: async () => mockTrains })

    const { result } = renderHook(() => useTrainList())

    expect(result.current.trainsLoading).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.trains).toEqual(mockTrains)
    expect(result.current.trainsLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error when fetch fails after all retries', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useTrainList())

    // Drain all pending promises and timer callbacks for each retry attempt
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve()
        jest.runAllTimers()
        await Promise.resolve()
      }
    })

    expect(result.current.error).toBe('Failed to load train list')
    expect(result.current.trainsLoading).toBe(false)
  })

  it('uses the provided url', async () => {
    fetchMock.mockResolvedValue({ json: async () => mockTrains })

    renderHook(() => useTrainList({ url: '/api/trains?railway=german' }))

    await act(async () => { await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledWith('/api/trains?railway=german')
  })

  it('does not update state after unmount', async () => {
    let resolvePromise!: (value: unknown) => void
    fetchMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    const { result, unmount } = renderHook(() => useTrainList())

    act(() => { unmount() })

    // Resolve fetch after unmount — should not cause state update
    await act(async () => {
      resolvePromise({ json: async () => mockTrains })
      await Promise.resolve()
    })

    // trains should still be empty since component unmounted
    expect(result.current.trains).toEqual([])
  })

  it('handleTrainChange updates trainInput and clears selection if changed', async () => {
    fetchMock.mockResolvedValue({ json: async () => mockTrains })

    const { result } = renderHook(() => useTrainList())

    // Flush the initial fetch so its state update is inside act
    await act(async () => { await Promise.resolve() })

    act(() => {
      result.current.handleTrainSelect('ICE 905')
    })
    act(() => {
      result.current.handleTrainChange('ICE 9')
    })

    expect(result.current.trainInput).toBe('ICE 9')
    expect(result.current.selectedTrain).toBe('')
    expect(result.current.selectedRailway).toBe('')
  })

  it('handleTrainSelect sets selectedTrain, selectedRailway from trains list', async () => {
    fetchMock.mockResolvedValue({ json: async () => mockTrains })

    const { result } = renderHook(() => useTrainList())

    await act(async () => { await Promise.resolve() })

    act(() => {
      result.current.handleTrainSelect('TGV 8088')
    })

    expect(result.current.selectedTrain).toBe('TGV 8088')
    expect(result.current.selectedRailway).toBe('french')
    expect(result.current.trainInput).toBe('TGV 8088')
  })
})
