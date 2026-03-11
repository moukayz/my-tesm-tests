import './globals.css'
import { auth } from '../auth'
import AuthHeader from '../components/AuthHeader'

export const metadata = {
  title: 'Travel Plan Itinerary',
  description: 'A detailed view of your upcoming trip',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="zh">
      <body className="bg-gray-100 text-gray-800 min-h-screen">
        <header className="max-w-6xl mx-auto px-8 py-3 flex justify-end">
          <AuthHeader user={session?.user} />
        </header>
        {children}
      </body>
    </html>
  )
}
