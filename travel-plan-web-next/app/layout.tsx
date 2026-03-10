import './globals.css'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from './lib/session'
import AuthHeader from '../components/AuthHeader'

export const metadata = {
  title: 'Travel Plan Itinerary',
  description: 'A detailed view of your upcoming trip',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return (
    <html lang="zh">
      <body className="bg-gray-100 text-gray-800 min-h-screen">
        <header className="max-w-6xl mx-auto px-8 py-3 flex justify-end">
          <AuthHeader isLoggedIn={session.isLoggedIn ?? false} username={session.username} />
        </header>
        {children}
      </body>
    </html>
  )
}
