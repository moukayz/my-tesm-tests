'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { X } from 'lucide-react'
import { useHourlyCloud } from '../app/lib/hooks/useWeather'

interface CloudForecastModalProps {
  cityName: string
  lat: number
  lng: number
  onClose: () => void
}

export default function CloudForecastModal({ cityName, lat, lng, onClose }: CloudForecastModalProps) {
  const { data, loading, error } = useHourlyCloud(lat, lng)

  // Format time label: "14:00" from "2026-03-25T14:00"
  const formatTime = (timeStr: string) => {
    const t = timeStr.split('T')[1] ?? timeStr
    return t.slice(0, 5)
  }

  const chartData = data?.map((entry) => ({
    time: formatTime(entry.time),
    cloudCover: entry.cloudCover,
    cloudCoverLow: entry.cloudCoverLow,
    cloudCoverMid: entry.cloudCoverMid,
    cloudCoverHigh: entry.cloudCoverHigh,
  }))

  return (
    <div
      data-testid="cloud-modal-backdrop"
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
            <p className="text-sm text-gray-500">12-Hour Cloud Forecast</p>
          </div>
          <button
            aria-label="Close cloud forecast modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div data-testid="cloud-skeleton" aria-label="Loading cloud data">
            {/* Legend skeleton */}
            <div className="flex gap-4 mb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-12 rounded bg-gray-200 animate-pulse" />
              ))}
            </div>
            {/* Chart skeleton */}
            <div className="h-[240px] rounded-lg bg-gray-100 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center h-40 text-sm text-red-500">
            Failed to load cloud data.
          </div>
        )}

        {!loading && !error && chartData && (
          <>
          <div className="flex gap-4 mb-2 text-xs text-gray-600 flex-wrap">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />Total</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-400" />Low</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />Mid</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-violet-400" />High</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cloudGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="cloudLowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#86efac" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#86efac" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="cloudMidGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fde68a" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#fde68a" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="cloudHighGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12 }}
                label={{ value: 'Cloud Cover', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
              />
              <Tooltip
                formatter={(value, name) => [`${value ?? 0}%`, name as string]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Area type="monotone" dataKey="cloudCover" stroke="#3b82f6" strokeWidth={2} fill="url(#cloudGradient)" name="Total" />
              <Area type="monotone" dataKey="cloudCoverLow" stroke="#22c55e" strokeWidth={1.5} fill="url(#cloudLowGradient)" name="Low" />
              <Area type="monotone" dataKey="cloudCoverMid" stroke="#f59e0b" strokeWidth={1.5} fill="url(#cloudMidGradient)" name="Mid" />
              <Area type="monotone" dataKey="cloudCoverHigh" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#cloudHighGradient)" name="High" />
            </AreaChart>
          </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}
