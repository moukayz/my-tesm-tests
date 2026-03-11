'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AuthErrorPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/')
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-700 mb-6">
          Your account is not authorized to access this application.
        </p>
        <p className="text-gray-500 text-sm">
          Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''}…
        </p>
      </div>
    </main>
  )
}
