'use client'

import { useMemo } from 'react'
import routeData from '../data/route.json'

function getOvernightColor(location) {
  if (location === '—') return '#f5f5f5'
  let hash = 0
  for (let i = 0; i < location.length; i++) {
    hash = location.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 70%, 95%)`
}

export default function ItineraryTab() {
  const processedData = useMemo(() => {
    const data = [...routeData]
    const result = []
    let currentOvernight = null
    let overnightSpan = 0
    let overnightStartIndex = -1

    for (let i = 0; i < data.length; i++) {
      const item = { ...data[i], overnightRowSpan: 0 }
      if (item.overnight !== currentOvernight) {
        if (overnightStartIndex !== -1) {
          result[overnightStartIndex].overnightRowSpan = overnightSpan
        }
        currentOvernight = item.overnight
        overnightSpan = 1
        overnightStartIndex = i
        item.overnightRowSpan = 1
      } else {
        overnightSpan++
      }
      result.push(item)
    }
    if (overnightStartIndex !== -1) {
      result[overnightStartIndex].overnightRowSpan = overnightSpan
    }
    return result
  }, [])

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
                      <li key={i} className="mb-1 last:mb-0">{item}</li>
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
