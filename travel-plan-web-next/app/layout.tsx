import './globals.css'
import { auth } from '../auth'
import AppHeader from '../components/AppHeader'

export const metadata = {
  title: 'Travel Plan Itinerary',
  description: 'A detailed view of your upcoming trip',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="zh">
      <body className="bg-gray-100 text-gray-800 min-h-screen">
        <AppHeader user={session?.user} />
        {children}
      </body>
    </html>
  )
}
