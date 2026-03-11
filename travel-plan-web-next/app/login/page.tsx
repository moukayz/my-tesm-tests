'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Sign In</h1>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  )
}
