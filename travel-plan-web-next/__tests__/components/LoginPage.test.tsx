import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from '../../app/login/page'

const mockSignIn = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignIn.mockClear()
  })

  it('renders "Sign in with Google" button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('calls signIn("google", { callbackUrl: "/" }) on button click', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/' })
  })
})
