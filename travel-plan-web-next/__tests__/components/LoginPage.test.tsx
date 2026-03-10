import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../../app/login/page'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRefresh.mockClear()
    global.fetch = jest.fn()
  })

  it('renders username and password fields and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('allows typing in username and password fields', async () => {
    render(<LoginPage />)
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await userEvent.type(usernameInput, 'testuser')
    await userEvent.type(passwordInput, 'testpass')

    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('testpass')
  })

  it('password field has type="password"', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password')
  })

  it('calls POST /api/auth/login on submit and redirects on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/password/i), 'testpass')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      }))
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error on 401 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/username/i), 'bad')
    await userEvent.type(screen.getByLabelText(/password/i), 'creds')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows rate limit error on 429 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many failed attempts', retryAfter: 45 }),
    })

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/password/i), 'testpass')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disables button while submitting', async () => {
    let resolvePromise!: (val: unknown) => void
    global.fetch = jest.fn().mockReturnValue(new Promise(r => { resolvePromise = r }))

    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText(/username/i), 'testuser')
    await userEvent.type(screen.getByLabelText(/password/i), 'testpass')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
    })

    await act(async () => {
      resolvePromise({ ok: true, status: 200 })
    })
  })
})
