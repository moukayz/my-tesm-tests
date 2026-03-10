'use client'

import { useState } from 'react'
import { LogIn, LogOut, User } from 'lucide-react'

interface AuthHeaderProps {
  isLoggedIn: boolean
  username?: string
}

export default function AuthHeader({ isLoggedIn, username }: AuthHeaderProps) {
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    setError(null)
    const res = await fetch('/api/auth/logout', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/'
    } else {
      setError('Logout failed. Please try again.')
    }
  }

  if (!isLoggedIn) {
    return (
      <a
        href="/login"
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
        aria-label="Login"
      >
        <LogIn size={18} />
        <span>Login</span>
      </a>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-sm text-gray-700">
        <User size={16} />
        <span>{username}</span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
        aria-label="Logout"
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  )
}
