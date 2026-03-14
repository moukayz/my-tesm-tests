'use client'

import { usePathname } from 'next/navigation'
import AuthHeader from './AuthHeader'

interface AppHeaderProps {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null
}

export default function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname()

  if (pathname === '/ui_test') {
    return null
  }

  return (
    <header className="max-w-6xl mx-auto px-8 py-3 flex justify-end">
      <AuthHeader user={user} />
    </header>
  )
}
