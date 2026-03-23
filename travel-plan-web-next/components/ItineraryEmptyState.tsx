'use client'

interface ItineraryEmptyStateProps {
  itineraryName: string
  startDate: string
  onAddFirstStay: () => void
}

export default function ItineraryEmptyState({ itineraryName, startDate, onAddFirstStay }: ItineraryEmptyStateProps) {
  return (
    <section className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-6" data-testid="itinerary-empty-state">
      <h2 className="text-xl font-semibold text-gray-900">{itineraryName}</h2>
      <p className="mt-1 text-sm text-gray-600">Start date: {startDate}</p>
      <p className="mt-4 text-sm text-gray-700">Add your first stay to start building this itinerary workspace.</p>
      <p className="mt-1 text-sm text-gray-500">Plan details and train schedules become available after your first stay exists.</p>
      <button
        type="button"
        onClick={onAddFirstStay}
        className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add first stay
      </button>
    </section>
  )
}
