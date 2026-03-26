'use client'

import { useState, useEffect } from 'react'

// ── WMO weathercode mapping ───────────────────────────────────────────────────

export function weatherCodeToDescription(code: number): string {
  if (code === 0) return 'Clear sky ☀️'
  if (code >= 1 && code <= 3) return 'Partly cloudy 🌤'
  if (code === 45 || code === 48) return 'Fog 🌫'
  if (code >= 51 && code <= 57) return 'Drizzle 🌦'
  if (code >= 61 && code <= 67) return 'Rain 🌧'
  if (code >= 71 && code <= 77) return 'Snow 🌨'
  if (code >= 80 && code <= 82) return 'Showers 🌦'
  if (code >= 95 && code <= 99) return 'Thunderstorm ⛈'
  return 'Unknown ❓'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyWeatherEntry {
  date: string
  maxTemp: number
  minTemp: number
  description: string
}

export interface HourlyCloudEntry {
  time: string
  cloudCover: number
  cloudCoverLow: number
  cloudCoverMid: number
  cloudCoverHigh: number
}

// ── useDailyWeather ───────────────────────────────────────────────────────────

export function useDailyWeather(
  lat: number | null,
  lng: number | null
): { data: DailyWeatherEntry[] | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<DailyWeatherEntry[] | null>(null)
  const [loading, setLoading] = useState(lat !== null && lng !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lat === null || lng === null) return

    setLoading(true)
    setError(null)

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&forecast_days=5&timezone=auto`

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        const { time, temperature_2m_max, temperature_2m_min, weathercode } = json.daily
        const entries: DailyWeatherEntry[] = (time as string[]).map((date, i) => ({
          date,
          maxTemp: temperature_2m_max[i],
          minTemp: temperature_2m_min[i],
          description: weatherCodeToDescription(weathercode[i]),
        }))
        setData(entries)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch')
        setLoading(false)
      })
  }, [lat, lng])

  return { data, loading, error }
}

// ── useHourlyCloud ────────────────────────────────────────────────────────────

export function useHourlyCloud(
  lat: number | null,
  lng: number | null
): { data: HourlyCloudEntry[] | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<HourlyCloudEntry[] | null>(null)
  const [loading, setLoading] = useState(lat !== null && lng !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lat === null || lng === null) return

    setLoading(true)
    setError(null)

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&forecast_days=2&timezone=auto`

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        const { time, cloud_cover, cloud_cover_low, cloud_cover_mid, cloud_cover_high } = json.hourly
        const utcOffsetSeconds: number = json.utc_offset_seconds ?? 0

        // Find current hour in the location's local timezone
        const localMs = Date.now() + utcOffsetSeconds * 1000
        const localHourStr = new Date(localMs).toISOString().slice(0, 13) // "YYYY-MM-DDTHH"
        const startIndex = (time as string[]).findIndex((t) => t.startsWith(localHourStr))
        const safeStart = startIndex >= 0 ? startIndex : 0

        const entries: HourlyCloudEntry[] = (time as string[])
          .slice(safeStart, safeStart + 12)
          .map((t, i) => ({
            time: t,
            cloudCover: cloud_cover[safeStart + i],
            cloudCoverLow: cloud_cover_low[safeStart + i],
            cloudCoverMid: cloud_cover_mid[safeStart + i],
            cloudCoverHigh: cloud_cover_high[safeStart + i],
          }))
        setData(entries)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch')
        setLoading(false)
      })
  }, [lat, lng])

  return { data, loading, error }
}
