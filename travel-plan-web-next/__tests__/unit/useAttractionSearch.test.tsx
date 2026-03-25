import { renderHook, act } from '@testing-library/react'
import { useAttractionSearch } from '../../components/hooks/useAttractionSearch'
import type { StayLocationResolved } from '../../app/lib/itinerary-store/types'

const mockSearchLocationSuggestions = jest.fn()
jest.mock('../../app/lib/locations/search', () => ({
  searchLocationSuggestions: (...args: unknown[]) => mockSearchLocationSuggestions(...args),
}))

const mockResult: StayLocationResolved = {
  kind: 'resolved',
  label: 'Eiffel Tower, Paris, France',
  queryText: 'Eiffel',
  coordinates: { lat: 48.858, lng: 2.294 },
  place: {
    placeId: 'geonames:2988507',
    name: 'Eiffel Tower',
    locality: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    countryCode: 'FR',
  },
}

beforeEach(() => {
  jest.useFakeTimers()
  mockSearchLocationSuggestions.mockReset()
  mockSearchLocationSuggestions.mockResolvedValue({ results: [mockResult] })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useAttractionSearch', () => {
  it('starts with isAdding false', () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    expect(result.current.isAdding).toBe(false)
  })

  it('openSearch sets isAdding to true and clears state', () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    act(() => result.current.openSearch())
    expect(result.current.isAdding).toBe(true)
    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
  })

  it('closeSearch resets all search state', () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    act(() => result.current.openSearch())
    act(() => result.current.closeSearch())
    expect(result.current.isAdding).toBe(false)
    expect(result.current.query).toBe('')
    expect(result.current.searchOpen).toBe(false)
  })

  it('short query (< 2 chars) produces no search call', () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    act(() => result.current.openSearch())
    act(() => result.current.setQuery('a'))
    act(() => jest.runAllTimers())
    expect(mockSearchLocationSuggestions).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it('valid query triggers debounced search and populates results', async () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    act(() => result.current.openSearch())
    act(() => result.current.setQuery('Eiffel'))
    await act(async () => { jest.runAllTimers() })
    expect(mockSearchLocationSuggestions).toHaveBeenCalledWith(
      'Eiffel',
      expect.objectContaining({ limit: 6 })
    )
    expect(result.current.results).toEqual([mockResult])
    expect(result.current.searchOpen).toBe(true)
  })

  it('selectAttraction calls onSelect with DayAttraction and resets search', () => {
    const onSelect = jest.fn()
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect })
    )
    act(() => result.current.openSearch())
    act(() => result.current.selectAttraction(mockResult))
    expect(onSelect).toHaveBeenCalledWith({
      id: 'geonames:2988507',
      label: 'Eiffel Tower',
      coordinates: { lat: 48.858, lng: 2.294 },
    })
    expect(result.current.isAdding).toBe(false)
  })

  it('selectAttraction skips duplicate attraction id', () => {
    const onSelect = jest.fn()
    const { result } = renderHook(() =>
      useAttractionSearch({
        existingAttractionIds: ['geonames:2988507'],
        onSelect,
      })
    )
    act(() => result.current.openSearch())
    act(() => result.current.selectAttraction(mockResult))
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.isAdding).toBe(false)
  })

  it('setActiveIndex updates activeIndex', () => {
    const { result } = renderHook(() =>
      useAttractionSearch({ existingAttractionIds: [], onSelect: jest.fn() })
    )
    act(() => result.current.setActiveIndex(2))
    expect(result.current.activeIndex).toBe(2)
  })
})
