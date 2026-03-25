'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { X } from 'lucide-react'
import { useDailyWeather } from '../app/lib/hooks/useWeather'

interface WeatherForecastModalProps {
  cityName: string
  lat: number
  lng: number
  onClose: () => void
}

export default function WeatherForecastModal({ cityName, lat, lng, onClose }: WeatherForecastModalProps) {
  const { data, loading, error } = useDailyWeather(lat, lng)

  // Format date label: "Mar 25"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const chartData = data?.map((entry) => ({
    date: formatDate(entry.date),
    min: entry.minTemp,
    max: entry.maxTemp,
    description: entry.description,
  }))

  return (
    <div
      data-testid="weather-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4"
        style={{ minWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{cityName}</h2>
            <p className="text-sm text-gray-500">5-Day Weather Forecast</p>
          </div>
          <button
            aria-label="Close weather forecast modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="flex justify-center items-center h-48">
            <span
              role="status"
              aria-label="Loading weather data"
              className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
            />
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-48 text-sm text-red-500">
            Failed to load weather data.
          </div>
        )}

        {!loading && !error && chartData && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}°`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const v = typeof value === 'number' ? value : 0
                    if (name === 'max') return [`${v.toFixed(1)}°C`, 'Max']
                    if (name === 'min') return [`${v.toFixed(1)}°C`, 'Min']
                    return [`${v.toFixed(1)}`, String(name)]
                  }}
                  labelFormatter={(label) => label}
                />
                <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} name="max" />
                <Line type="monotone" dataKey="min" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="min" />
              </LineChart>
            </ResponsiveContainer>

            {/* Weather conditions per day */}
            <div className="mt-4 grid grid-cols-5 gap-1">
              {data!.map((entry) => (
                <div key={entry.date} className="flex flex-col items-center text-center">
                  <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                  <span className="text-sm mt-0.5" title={entry.description}>
                    {entry.description.split(' ').pop()}
                  </span>
                  <span className="text-xs font-medium text-red-500">{entry.maxTemp.toFixed(1)}°</span>
                  <span className="text-xs text-blue-500">{entry.minTemp.toFixed(1)}°</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
