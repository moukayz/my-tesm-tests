'use client'

import { useMemo } from 'react'
import routeData from '../data/route.json'
import { getOvernightColor, processItinerary } from '../app/lib/itinerary'

export default function ItineraryTab() {
  const processedData = useMemo(() => processItinerary(routeData), [])

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden w-full border border-gray-200">
      <table className="w-full border-collapse text-left">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            {['Date', 'Weekday', 'Day', 'Overnight', 'Plan', 'Train Schedule'].map((h) => (
              <th
                key={h}
                className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.map((day, index) => (
            <tr key={index} className="group hover:bg-gray-50">
              <td className="px-6 py-4 border-b border-gray-200 align-middle whitespace-nowrap tabular-nums text-gray-600 group-last:border-b-0">
                {day.date}
              </td>
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-gray-500 text-sm group-last:border-b-0">
                {day.weekDay}
              </td>
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-center font-bold text-blue-500 group-last:border-b-0">
                {day.dayNum}
              </td>

              {day.overnightRowSpan > 0 && (
                <td
                  rowSpan={day.overnightRowSpan}
                  className="px-6 py-4 border-b border-gray-200 border-x border-x-gray-200 align-middle text-center font-semibold text-gray-900"
                  style={{ backgroundColor: getOvernightColor(day.overnight) }}
                >
                  {day.overnight}
                </td>
              )}

              <td className="px-6 py-4 border-b border-gray-200 align-middle min-w-[300px] group-last:border-b-0">
                {day.plan}
              </td>
              <td className="px-6 py-4 border-b border-gray-200 align-middle text-sm text-gray-600 group-last:border-b-0">
                {day.train && day.train.length > 0 ? (
                  <ol className="m-0 pl-5 text-gray-700 list-decimal">
                    {day.train.map((item, i) => (
                      <li key={i} className="mb-1 last:mb-0">
                        {item}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <span className="text-gray-400 italic">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
