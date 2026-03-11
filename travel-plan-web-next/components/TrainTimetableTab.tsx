'use client'

import { useState, useEffect } from 'react'
import AutocompleteInput from './AutocompleteInput'
import { formatTime, type TimetableRow } from '../app/lib/trainTimetable'
import { type TrainRow } from '../app/lib/trainDelay'

export default function TrainTimetableTab() {
  const [trains, setTrains] = useState<TrainRow[]>([])
  const [trainInput, setTrainInput] = useState('')
  const [selectedTrain, setSelectedTrain] = useState('')
  const [selectedRailway, setSelectedRailway] = useState('')
  const [timetable, setTimetable] = useState<TimetableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/trains')
      .then((r) => r.json())
      .then((data) => setTrains(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load train list'))
  }, [])

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

  function handleTrainChange(text: string) {
    setTrainInput(text)
    if (text !== selectedTrain) {
      setSelectedTrain('')
      setSelectedRailway('')
    }
  }

  function handleTrainSelect(name: string) {
    setTrainInput(name)
    setSelectedTrain(name)
    setSelectedRailway(trains.find((t) => t.train_name === name)?.railway ?? 'german')
  }

  const rideDate = timetable[0]?.ride_date?.slice(0, 10) ?? null

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex gap-8 p-5 items-end flex-wrap">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <div className="flex items-baseline gap-2">
            <label
              htmlFor="timetable-train-input"
              className="text-xs font-semibold uppercase tracking-wider text-gray-700"
            >
              Train
            </label>
            <span className="text-xs text-gray-400">e.g. ICE 905, TGV 8088, EST 9423</span>
          </div>
          <AutocompleteInput
            id="timetable-train-input"
            value={trainInput}
            onChange={handleTrainChange}
            onSelect={handleTrainSelect}
            options={trains.map((t) => t.train_name)}
            placeholder="Type to search, e.g. ICE 905"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

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
