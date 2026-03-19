import { auth } from '../auth'
import { getRouteStore } from './lib/routeStore'
import TravelPlan from '../components/TravelPlan'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()
  const initialRouteData = session?.user ? await getRouteStore().getAll() : undefined
  return (
    <main className="max-w-6xl mx-auto px-8 py-8">
      <TravelPlan isLoggedIn={!!session?.user} initialRouteData={initialRouteData} />
    </main>
  )
}
