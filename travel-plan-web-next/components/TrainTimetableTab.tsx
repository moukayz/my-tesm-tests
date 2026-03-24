'use client'

import { useState, useEffect } from 'react'
import TrainSelectorControl from './TrainSelectorControl'
import { useTrainList } from '../app/lib/hooks/useTrainList'
import { formatTime, type TimetableRow } from '../app/lib/trainTimetable'

export default function TrainTimetableTab() {
  const {
    trains,
    trainInput,
    selectedTrain,
    selectedRailway,
    trainsLoading,
    error: trainListError,
    handleTrainChange,
    handleTrainSelect,
  } = useTrainList()

  const [timetable, setTimetable] = useState<TimetableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (trainListError) setError(trainListError)
  }, [trainListError])

  useEffect(() => {
    if (!selectedTrain) {
      setTimetable([])
      return
    }
    setLoading(true)
    setError(null)
    const railwayParam = selectedRailway ? `&railway=${selectedRailway}` : ''
    fetch(`/api/timetable?train=${encodeURIComponent(selectedTrain)}${railwayParam}`)
      .then((r) => r.json())
      .then((data) => {
        setTimetable(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load timetable')
        setLoading(false)
      })
  }, [selectedTrain, selectedRailway])

  const rideDate = timetable[0]?.ride_date?.slice(0, 10) ?? null

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex gap-8 p-5 items-end flex-wrap">
        <TrainSelectorControl
          id="timetable-train-input"
          value={trainInput}
          options={trains.map((t) => t.train_name)}
          onChange={handleTrainChange}
          onSelect={handleTrainSelect}
          isLoading={false}
          hint="e.g. ICE 905, TGV 8088, EST 9423"
          placeholder="Type to search, e.g. ICE 905"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {(trainsLoading || loading) && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            role="status"
            aria-label="Loading"
            className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          />
          <span>{trainsLoading ? 'Loading trains…' : 'Loading timetable…'}</span>
        </div>
      )}

      {!loading && timetable.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-baseline gap-3">
            <h3 className="m-0 text-sm font-semibold text-gray-700">Planned Timetable</h3>
            {rideDate && (
              <span className="text-xs text-gray-400">(latest run: {rideDate})</span>
            )}
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 w-8">
                  #
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Station
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Arrival
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Departure
                </th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((row, i) => (
                <tr
                  key={row.station_num}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-2.5 text-gray-400 tabular-nums">{row.station_num}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.station_name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {formatTime(row.arrival_planned_time)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {formatTime(row.departure_planned_time)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && timetable.length === 0 && selectedTrain && (
        <p className="text-gray-500 text-sm italic">No timetable found for this train.</p>
      )}
    </div>
  )
}
