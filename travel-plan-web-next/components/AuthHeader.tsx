'use client'

import { signOut } from 'next-auth/react'
import { LogIn, LogOut, User } from 'lucide-react'

interface AuthHeaderProps {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null
}

export default function AuthHeader({ user }: AuthHeaderProps) {
  if (!user) {
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
        <span>{user.name ?? user.email}</span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
        aria-label="Logout"
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </div>
  )
}
