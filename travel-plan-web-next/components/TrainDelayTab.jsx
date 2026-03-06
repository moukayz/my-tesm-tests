'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import AutocompleteInput from './AutocompleteInput'

export default function TrainDelayTab() {
  const [trains, setTrains] = useState([])
  const [trainInput, setTrainInput] = useState('')
  const [selectedTrain, setSelectedTrain] = useState('')
  const [stations, setStations] = useState([])
  const [stationInput, setStationInput] = useState('')
  const [selectedStation, setSelectedStation] = useState('')
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/trains')
      .then(r => r.json())
      .then(data => setTrains(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load train list'))
  }, [])

  useEffect(() => {
    if (!selectedTrain) { setStations([]); setStationInput(''); setSelectedStation(''); return }
    fetch(`/api/stations?train=${encodeURIComponent(selectedTrain)}`)
      .then(r => r.json())
      .then(rows => { setStations(Array.isArray(rows) ? rows : []); setStationInput(''); setSelectedStation('') })
      .catch(() => setError('Failed to load stations'))
  }, [selectedTrain])

  useEffect(() => {
    if (!selectedTrain || !selectedStation) { setStats(null); setTrends([]); return }
    setLoading(true)
    setError(null)
    fetch(`/api/delay-stats?train=${encodeURIComponent(selectedTrain)}&station=${encodeURIComponent(selectedStation)}`)
      .then(r => r.json())
      .then(data => { setStats(data.stats); setTrends(data.trends); setLoading(false) })
      .catch(() => { setError('Failed to load delay stats'); setLoading(false) })
  }, [selectedTrain, selectedStation])

  function handleTrainChange(text) {
    setTrainInput(text)
    // Clear selection if user edited the text away from the confirmed value
    if (text !== selectedTrain) setSelectedTrain('')
  }

  function handleTrainSelect(name) {
    setTrainInput(name)
    setSelectedTrain(name)
  }

  function handleStationChange(text) {
    setStationInput(text)
    if (text !== selectedStation) setSelectedStation('')
  }

  function handleStationSelect(name) {
    setStationInput(name)
    setSelectedStation(name)
  }

  const formatDay = (day) => {
    if (!day) return ''
    const d = new Date(day)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const statItems = stats ? [
    { label: 'Total Stops', value: stats.total_stops, unit: '' },
    { label: 'Avg Delay', value: stats.avg_delay, unit: ' min' },
    { label: 'Median (p50)', value: stats.p50, unit: ' min' },
    { label: 'p75', value: stats.p75, unit: ' min' },
    { label: 'p90', value: stats.p90, unit: ' min' },
    { label: 'p95', value: stats.p95, unit: ' min' },
    { label: 'Max Delay', value: stats.max_delay, unit: ' min' },
  ] : []

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex gap-8 p-5 items-end flex-wrap">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label htmlFor="train-input" className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Train
          </label>
          <AutocompleteInput
            id="train-input"
            value={trainInput}
            onChange={handleTrainChange}
            onSelect={handleTrainSelect}
            options={trains.map(t => t.train_name)}
            placeholder="Type to search, e.g. ICE 905"
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label htmlFor="station-input" className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Station
          </label>
          <AutocompleteInput
            id="station-input"
            value={stationInput}
            onChange={handleStationChange}
            onSelect={handleStationSelect}
            options={stations.map(s => s.station_name)}
            placeholder="Type to search station"
            disabled={!selectedTrain || stations.length === 0}
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!loading && stats && (
        <>
          {/* Stats grid */}
          <div className="grid gap-4 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {statItems.map(({ label, value, unit }) => (
              <div key={label} className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex flex-col gap-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}{unit}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <h3 className="m-0 mb-4 text-sm font-semibold text-gray-700">Daily Avg Delay — Last 3 Months</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 12 }} />
                <YAxis unit=" min" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`${v} min`, 'Avg Delay']}
                  labelFormatter={(l) => `Date: ${l?.slice(0, 10)}`}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2" />
                <Line
                  type="monotone"
                  dataKey="avg_delay"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!loading && !stats && selectedTrain && selectedStation && (
        <p className="text-gray-500 text-sm italic">No data found for this train/station combination in the last 3 months.</p>
      )}
    </div>
  )
}
