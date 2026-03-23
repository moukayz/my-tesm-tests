import React, { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StayLocation } from '../../app/lib/itinerary-store/types'
import LocationAutocompleteField from '../../components/LocationAutocompleteField'

function Harness() {
  const [value, setValue] = useState('')
  const [selection, setSelection] = useState<StayLocation>({ kind: 'custom', label: '', queryText: '' })

  return (
    <LocationAutocompleteField
      inputId="stay-city"
      value={value}
      selectedLocation={selection}
      disabled={false}
      onValueChange={setValue}
      onSelectionChange={setSelection}
    />
  )
}

describe('LocationAutocompleteField', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('shows custom option first and limits backend candidates to five', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Pa',
        results: [
          {
            kind: 'resolved',
            label: 'Paris',
            queryText: 'Pa',
            coordinates: { lng: 2.3522, lat: 48.8566 },
            place: { placeId: 'place-1', name: 'Paris', region: 'Ile-de-France', country: 'France' },
          },
          {
            kind: 'resolved',
            label: 'Parikia',
            queryText: 'Pa',
            coordinates: { lng: 25.1503, lat: 37.0855 },
            place: { placeId: 'place-2', name: 'Parikia', country: 'Greece' },
          },
          {
            kind: 'resolved',
            label: 'Palo Alto',
            queryText: 'Pa',
            coordinates: { lng: -122.143, lat: 37.4419 },
            place: { placeId: 'place-3', name: 'Palo Alto', country: 'United States' },
          },
          {
            kind: 'resolved',
            label: 'Panama City',
            queryText: 'Pa',
            coordinates: { lng: -79.5199, lat: 8.9824 },
            place: { placeId: 'place-4', name: 'Panama City', country: 'Panama' },
          },
          {
            kind: 'resolved',
            label: 'Padua',
            queryText: 'Pa',
            coordinates: { lng: 11.8768, lat: 45.4064 },
            place: { placeId: 'place-5', name: 'Padua', country: 'Italy' },
          },
          {
            kind: 'resolved',
            label: 'Parma',
            queryText: 'Pa',
            coordinates: { lng: 10.3279, lat: 44.8015 },
            place: { placeId: 'place-6', name: 'Parma', country: 'Italy' },
          },
        ],
      }),
    })

    render(<Harness />)

    const input = screen.getByLabelText(/city/i)
    await user.type(input, 'Pa')

    act(() => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(6)
    })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(6)
    expect(options[0]).toHaveTextContent('Use "Pa" as a custom location')
    expect(options[5]).toHaveTextContent('Padua')
    expect(screen.queryByText('Parma')).not.toBeInTheDocument()
  })

  it('shows no hint text when search returns no results', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ query: 'zz', results: [] }),
    })

    render(<Harness />)

    const input = screen.getByLabelText(/city/i)
    await user.type(input, 'zz')

    act(() => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByText(/no matching places found/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/searching for places/i)).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /use "zz" as a custom location/i })).toBeInTheDocument()
  })

  it('shows spinner while loading and hides it after response', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    let resolveSearch!: () => void
    ;(global.fetch as jest.Mock).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveSearch = () =>
          resolve({
            ok: true,
            json: async () => ({ query: 'Pa', results: [] }),
          } as Response)
      })
    )

    render(<Harness />)

    const input = screen.getByLabelText(/city/i)
    await user.type(input, 'Pa')

    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Spinner should be visible while fetch is pending
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Resolve the fetch
    await act(async () => {
      resolveSearch()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('dropdown listbox has absolute positioning class', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Pa',
        results: [
          {
            kind: 'resolved',
            label: 'Paris',
            queryText: 'Pa',
            coordinates: { lng: 2.3522, lat: 48.8566 },
            place: { placeId: 'place-1', name: 'Paris', country: 'France' },
          },
        ],
      }),
    })

    render(<Harness />)

    const input = screen.getByLabelText(/city/i)
    await user.type(input, 'Pa')

    act(() => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    expect(screen.getByRole('listbox')).toHaveClass('absolute')
  })

  it('shows non-blocking unavailable hint when backend lookup fails', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'INTERNAL_ERROR' }) })

    render(<Harness />)

    const input = screen.getByLabelText(/city/i)
    await user.type(input, 'Lo')

    act(() => {
      jest.advanceTimersByTime(300)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(await screen.findByText(/place suggestions are unavailable right now/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /use "Lo" as a custom location/i })).toBeInTheDocument()
  })
})
