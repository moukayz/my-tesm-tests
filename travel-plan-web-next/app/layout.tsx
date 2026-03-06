import './globals.css'

export const metadata = {
  title: 'Travel Plan Itinerary',
  description: 'A detailed view of your upcoming trip',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-100 text-gray-800 min-h-screen">{children}</body>
    </html>
  )
}
