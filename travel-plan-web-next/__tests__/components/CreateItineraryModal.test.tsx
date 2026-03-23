import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateItineraryModal from '../../components/CreateItineraryModal'

describe('CreateItineraryModal', () => {
  afterEach(() => jest.restoreAllMocks())

  it('validates required start date before submit', async () => {
    global.fetch = jest.fn()
    render(<CreateItineraryModal isOpen={true} onClose={jest.fn()} onSuccess={jest.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /create itinerary/i }))

    expect(screen.getByText(/start date is required/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits and returns created itinerary on success', async () => {
    const onSuccess = jest.fn()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          itinerary: {
            id: 'iti-123',
            name: 'Spring trip',
            startDate: '2026-04-01',
            status: 'draft',
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z',
          },
          workspaceUrl: '/?tab=itinerary&itineraryId=iti-123',
        }),
      } as Response)
    )

    render(<CreateItineraryModal isOpen={true} onClose={jest.fn()} onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/name/i), 'Spring trip')
    await userEvent.type(screen.getByLabelText(/start date/i), '2026-04-01')
    await userEvent.click(screen.getByRole('button', { name: /create itinerary/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          itinerary: expect.objectContaining({ id: 'iti-123' }),
          workspaceUrl: '/?tab=itinerary&itineraryId=iti-123',
        })
      )
    })
  })

  it('shows mapped API field errors', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({ error: 'INVALID_START_DATE' }),
      } as Response)
    )

    render(<CreateItineraryModal isOpen={true} onClose={jest.fn()} onSuccess={jest.fn()} />)

    await userEvent.type(screen.getByLabelText(/start date/i), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: /create itinerary/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid start date/i)
    })
  })
})
