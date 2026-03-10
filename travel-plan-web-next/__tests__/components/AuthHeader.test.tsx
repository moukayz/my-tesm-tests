import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthHeader from '../../components/AuthHeader'

describe('AuthHeader', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows login link when not logged in', () => {
    render(<AuthHeader isLoggedIn={false} />)
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
  })

  it('shows no login link when logged in', () => {
    render(<AuthHeader isLoggedIn={true} username="testuser" />)
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument()
  })

  it('shows username when logged in', () => {
    render(<AuthHeader isLoggedIn={true} username="testuser" />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('shows logout button when logged in', () => {
    render(<AuthHeader isLoggedIn={true} username="testuser" />)
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('calls POST /api/auth/logout on logout click', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch

    render(<AuthHeader isLoggedIn={true} username="testuser" />)
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    })
  })

  it('shows error message when logout fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false })

    render(<AuthHeader isLoggedIn={true} username="testuser" />)
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))

    await waitFor(() => {
      expect(screen.getByText(/logout failed/i)).toBeInTheDocument()
    })
  })
})
