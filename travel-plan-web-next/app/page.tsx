import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from './lib/session'
import TravelPlan from '../components/TravelPlan'

export default async function Home() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return (
    <main className="max-w-6xl mx-auto px-8 py-8">
      <TravelPlan isLoggedIn={session.isLoggedIn ?? false} />
    </main>
  )
}
