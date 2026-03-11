import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import AuthHeader from '../../components/AuthHeader'

const mockSignOut = jest.fn()

jest.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

describe('AuthHeader', () => {
  beforeEach(() => {
    mockSignOut.mockClear()
  })

  it('shows login link when user is null', () => {
    render(<AuthHeader user={null} />)
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
  })

  it('shows login link when user is undefined', () => {
    render(<AuthHeader />)
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login')
  })

  it('shows no login link when user is provided', () => {
    render(<AuthHeader user={{ name: 'Test User', email: 'test@gmail.com' }} />)
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument()
  })

  it('shows user name when logged in', () => {
    render(<AuthHeader user={{ name: 'Test User', email: 'test@gmail.com' }} />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows user email when name is null', () => {
    render(<AuthHeader user={{ name: null, email: 'test@gmail.com' }} />)
    expect(screen.getByText('test@gmail.com')).toBeInTheDocument()
  })

  it('shows logout button when logged in', () => {
    render(<AuthHeader user={{ name: 'Test User', email: 'test@gmail.com' }} />)
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('calls signOut on logout click', () => {
    render(<AuthHeader user={{ name: 'Test User', email: 'test@gmail.com' }} />)
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })
})
