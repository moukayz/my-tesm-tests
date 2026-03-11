import React from 'react'
import { render, screen, act } from '@testing-library/react'
import AuthErrorPage from '../../app/auth-error/page'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (_: string) => 'AccessDenied' }),
}))

describe('AuthErrorPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders "Access Denied" heading', () => {
    render(<AuthErrorPage />)
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
  })

  it('renders unauthorized account message', () => {
    render(<AuthErrorPage />)
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument()
  })

  it('shows initial countdown of 5', () => {
    render(<AuthErrorPage />)
    expect(screen.getByText(/5 second/i)).toBeInTheDocument()
  })

  it('decrements countdown each second', async () => {
    render(<AuthErrorPage />)
    await act(async () => { jest.advanceTimersByTime(1000) })
    expect(screen.getByText(/4 second/i)).toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(1000) })
    expect(screen.getByText(/3 second/i)).toBeInTheDocument()
  })

  it('redirects to home after 5 seconds', async () => {
    render(<AuthErrorPage />)
    for (let i = 0; i < 5; i++) {
      await act(async () => { jest.advanceTimersByTime(1000) })
    }
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
