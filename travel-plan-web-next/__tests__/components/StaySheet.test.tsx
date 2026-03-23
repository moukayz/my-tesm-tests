import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StayLocation } from '../../app/lib/itinerary-store/types'
import StaySheet from '../../components/StaySheet'

function resolvedLocation(label: string): StayLocation {
  return {
    kind: 'resolved',
    label,
    queryText: label,
    coordinates: { lng: 2.3522, lat: 48.8566 },
    place: {
      placeId: 'place-paris',
      name: label,
      locality: 'Paris',
      region: 'Ile-de-France',
      country: 'France',
      countryCode: 'FR',
    },
  }
}

describe('StaySheet', () => {
  it('preserves existing resolved metadata when location text is unchanged', async () => {
    const onSubmit = jest.fn(async () => undefined)

    render(
      <StaySheet
        isOpen
        mode="edit"
        initialCity="Paris"
        initialNights={2}
        initialLocation={resolvedLocation('Paris')}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /save stay/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      city: 'Paris',
      nights: 2,
      location: resolvedLocation('Paris'),
    })
  })

  it('downgrades to custom location and clears geocoded metadata after text edit', async () => {
    const onSubmit = jest.fn(async () => undefined)

    render(
      <StaySheet
        isOpen
        mode="edit"
        initialCity="Paris"
        initialNights={2}
        initialLocation={resolvedLocation('Paris')}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />
    )

    const input = screen.getByLabelText(/city/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Paris center')

    await userEvent.click(screen.getByRole('button', { name: /save stay/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      city: 'Paris center',
      nights: 2,
      location: {
        kind: 'custom',
        label: 'Paris center',
        queryText: 'Paris center',
      },
    })
  })
})
