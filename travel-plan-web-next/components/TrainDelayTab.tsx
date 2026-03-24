'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import AutocompleteInput from './AutocompleteInput'
import TrainSelectorControl from './TrainSelectorControl'
import { useTrainList } from '../app/lib/hooks/useTrainList'
import {
  formatDay,
  buildStatItems,
  type DelayStats,
  type TrendPoint,
  type StationRow,
} from '../app/lib/trainDelay'

export default function TrainDelayTab() {
  const {
    trains,
    trainInput,
    selectedTrain,
    trainsLoading,
    error: trainListError,
    handleTrainChange,
    handleTrainSelect,
  } = useTrainList({ url: '/api/trains?railway=german' })

  const [stations, setStations] = useState<StationRow[]>([])
  const [stationInput, setStationInput] = useState('')
  const [selectedStation, setSelectedStation] = useState('')
  const [stats, setStats] = useState<DelayStats | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [stationsLoading, setStationsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (trainListError) setError(trainListError)
  }, [trainListError])

  useEffect(() => {
    if (!selectedTrain) {
      setStations([])
      setStationInput('')
      setSelectedStation('')
      return
    }
    setStationsLoading(true)
    fetch(`/api/stations?train=${encodeURIComponent(selectedTrain)}`)
      .then((r) => r.json())
      .then((rows) => {
        setStations(Array.isArray(rows) ? rows : [])
        setStationInput('')
        setSelectedStation('')
      })
      .catch(() => setError('Failed to load stations'))
      .finally(() => setStationsLoading(false))
  }, [selectedTrain])

  useEffect(() => {
    if (!selectedTrain || !selectedStation) {
      setStats(null)
      setTrends([])
      return
    }
    setLoading(true)
    setError(null)
    fetch(
      `/api/delay-stats?train=${encodeURIComponent(selectedTrain)}&station=${encodeURIComponent(selectedStation)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats)
        setTrends(data.trends)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load delay stats')
        setLoading(false)
      })
  }, [selectedTrain, selectedStation])

  function handleStationChange(text: string) {
    setStationInput(text)
    if (text !== selectedStation) setSelectedStation('')
  }

  function handleStationSelect(name: string) {
    setStationInput(name)
    setSelectedStation(name)
  }

  const statItems = stats ? buildStatItems(stats) : []

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex gap-8 p-5 items-end flex-wrap">
        <TrainSelectorControl
          id="train-input"
          value={trainInput}
          options={trains.map((t) => t.train_name)}
          onChange={handleTrainChange}
          onSelect={handleTrainSelect}
          isLoading={false}
          hint="e.g. ICE 905, TGV 8088, EST 9423"
          placeholder="Type to search, e.g. ICE 905"
        />

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <label
              htmlFor="station-input"
              className="text-xs font-semibold uppercase tracking-wider text-gray-700"
            >
              Station
            </label>
            {stationsLoading && (
              <span
                role="status"
                aria-label="Loading"
                className="inline-block w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"
              />
            )}
          </div>
          <AutocompleteInput
            id="station-input"
            value={stationInput}
            onChange={handleStationChange}
            onSelect={handleStationSelect}
            options={stations.map((s) => s.station_name)}
            placeholder="Type to search station"
            disabled={!selectedTrain || stations.length === 0}
            showAllWhenEmpty
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {(trainsLoading || loading) && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            role="status"
            aria-label="Loading"
            className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          />
          <span>{trainsLoading ? 'Loading trains…' : 'Loading stats…'}</span>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Stats grid */}
          <div
            className="grid gap-4 w-full"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
          >
            {statItems.map(({ label, value, unit }) => (
              <div
                key={label}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex flex-col gap-1"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {label}
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">
                  {value}
                  {unit}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5">
            <h3 className="m-0 mb-4 text-sm font-semibold text-gray-700">
              Daily Avg Delay — Last 3 Months
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 12 }} />
                <YAxis unit=" min" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => [`${v} min`, 'Avg Delay']}
                  labelFormatter={(l) => `Date: ${String(l)?.slice(0, 10)}`}
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
        <p className="text-gray-500 text-sm italic">
          No data found for this train/station combination in the last 3 months.
        </p>
      )}
    </div>
  )
}
