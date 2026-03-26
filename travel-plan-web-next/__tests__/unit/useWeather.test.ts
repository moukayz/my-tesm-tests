import { renderHook, act } from '@testing-library/react'
import { useDailyWeather, useHourlyCloud, weatherCodeToDescription } from '../../app/lib/hooks/useWeather'

const mockDailyResponse = {
  daily: {
    time: ['2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29'],
    temperature_2m_max: [15, 17, 14, 12, 16],
    temperature_2m_min: [8, 9, 7, 5, 10],
    weathercode: [0, 1, 61, 3, 80],
  },
}

// 48-hour mock spanning two days, cloud_cover = index value for easy verification
const mockHourlyResponse = {
  utc_offset_seconds: 0,
  hourly: {
    time: [
      ...Array.from({ length: 24 }, (_, i) => `2026-03-25T${String(i).padStart(2, '0')}:00`),
      ...Array.from({ length: 24 }, (_, i) => `2026-03-26T${String(i).padStart(2, '0')}:00`),
    ],
    cloud_cover: Array.from({ length: 48 }, (_, i) => i),
    cloud_cover_low: Array.from({ length: 48 }, (_, i) => i + 100),
    cloud_cover_mid: Array.from({ length: 48 }, (_, i) => i + 200),
    cloud_cover_high: Array.from({ length: 48 }, (_, i) => i + 300),
  },
}

// UTC timestamp for 2026-03-25T10:00:00Z
const T_UTC_10 = Date.UTC(2026, 2, 25, 10, 0, 0)

describe('weatherCodeToDescription', () => {
  it('returns "Clear sky ☀️" for code 0', () => {
    expect(weatherCodeToDescription(0)).toBe('Clear sky ☀️')
  })

  it('returns "Partly cloudy 🌤" for codes 1-3', () => {
    expect(weatherCodeToDescription(1)).toBe('Partly cloudy 🌤')
    expect(weatherCodeToDescription(2)).toBe('Partly cloudy 🌤')
    expect(weatherCodeToDescription(3)).toBe('Partly cloudy 🌤')
  })

  it('returns "Fog 🌫" for codes 45 and 48', () => {
    expect(weatherCodeToDescription(45)).toBe('Fog 🌫')
    expect(weatherCodeToDescription(48)).toBe('Fog 🌫')
  })

  it('returns "Drizzle 🌦" for codes 51-57', () => {
    expect(weatherCodeToDescription(51)).toBe('Drizzle 🌦')
    expect(weatherCodeToDescription(56)).toBe('Drizzle 🌦')
  })

  it('returns "Rain 🌧" for codes 61-67', () => {
    expect(weatherCodeToDescription(61)).toBe('Rain 🌧')
    expect(weatherCodeToDescription(65)).toBe('Rain 🌧')
  })

  it('returns "Snow 🌨" for codes 71-77', () => {
    expect(weatherCodeToDescription(71)).toBe('Snow 🌨')
  })

  it('returns "Showers 🌦" for codes 80-82', () => {
    expect(weatherCodeToDescription(80)).toBe('Showers 🌦')
    expect(weatherCodeToDescription(82)).toBe('Showers 🌦')
  })

  it('returns "Thunderstorm ⛈" for codes 95-99', () => {
    expect(weatherCodeToDescription(95)).toBe('Thunderstorm ⛈')
    expect(weatherCodeToDescription(99)).toBe('Thunderstorm ⛈')
  })

  it('returns a string ending with ❓ for unrecognized codes', () => {
    expect(weatherCodeToDescription(999)).toMatch(/❓$/)
  })
})

describe('useDailyWeather', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts with loading true and no data', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useDailyWeather(48.85, 2.35))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns data after successful fetch', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDailyResponse),
    })
    const { result } = renderHook(() => useDailyWeather(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toHaveLength(5)
    expect(result.current.data![0]).toMatchObject({
      date: '2026-03-25',
      maxTemp: 15,
      minTemp: 8,
      description: 'Clear sky ☀️',
    })
    expect(result.current.data![2]).toMatchObject({
      date: '2026-03-27',
      description: 'Rain 🌧',
    })
  })

  it('fetches the correct Open-Meteo URL with lat/lng', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDailyResponse),
    })
    renderHook(() => useDailyWeather(51.5, -0.12))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('latitude=51.5')
    expect(url).toContain('longitude=-0.12')
    expect(url).toContain('daily=temperature_2m_max,temperature_2m_min,weathercode')
    expect(url).toContain('forecast_days=5')
  })

  it('sets error on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    })
    const { result } = renderHook(() => useDailyWeather(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeNull()
  })

  it('does not fetch when lat/lng are null', () => {
    renderHook(() => useDailyWeather(null, null))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('useHourlyCloud', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts with loading true and no data', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useHourlyCloud(48.85, 2.35))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('returns 12 hours starting from the current local hour (UTC+0, hour 10)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(T_UTC_10)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHourlyResponse), // utc_offset_seconds: 0
    })
    const { result } = renderHook(() => useHourlyCloud(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toHaveLength(12)
    // Local hour = 10 (UTC+0), so slice starts at index 10
    expect(result.current.data![0]).toMatchObject({ time: '2026-03-25T10:00', cloudCover: 10, cloudCoverLow: 110, cloudCoverMid: 210, cloudCoverHigh: 310 })
    expect(result.current.data![11]).toMatchObject({ time: '2026-03-25T21:00', cloudCover: 21, cloudCoverLow: 121, cloudCoverMid: 221, cloudCoverHigh: 321 })
  })

  it('applies utc_offset_seconds to find local hour (UTC+2 → local 12:00)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(T_UTC_10) // UTC 10:00
    const responseWithOffset = { ...mockHourlyResponse, utc_offset_seconds: 7200 } // UTC+2
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithOffset),
    })
    const { result } = renderHook(() => useHourlyCloud(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    // Local hour = 10 + 2 = 12, so slice starts at index 12
    expect(result.current.data![0]).toMatchObject({ time: '2026-03-25T12:00', cloudCover: 12 })
    expect(result.current.data![11]).toMatchObject({ time: '2026-03-25T23:00', cloudCover: 23 })
  })

  it('wraps correctly across midnight (UTC 22:00, UTC+2 → local 00:00 next day)', async () => {
    const T_UTC_22 = Date.UTC(2026, 2, 25, 22, 0, 0)
    jest.spyOn(Date, 'now').mockReturnValue(T_UTC_22)
    const responseWithOffset = { ...mockHourlyResponse, utc_offset_seconds: 7200 } // UTC+2
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithOffset),
    })
    const { result } = renderHook(() => useHourlyCloud(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    // Local time = 2026-03-26T00:00, which is index 24 in the 48-hour array
    expect(result.current.data![0]).toMatchObject({ time: '2026-03-26T00:00', cloudCover: 24 })
    expect(result.current.data![11]).toMatchObject({ time: '2026-03-26T11:00', cloudCover: 35 })
  })

  it('fetches forecast_days=2 with timezone=auto and all cloud cover fields', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(T_UTC_10)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHourlyResponse),
    })
    renderHook(() => useHourlyCloud(51.5, -0.12))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('latitude=51.5')
    expect(url).toContain('cloud_cover')
    expect(url).toContain('cloud_cover_low')
    expect(url).toContain('cloud_cover_mid')
    expect(url).toContain('cloud_cover_high')
    expect(url).toContain('forecast_days=2')
    expect(url).toContain('timezone=auto')
  })

  it('sets error on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 })
    const { result } = renderHook(() => useHourlyCloud(48.85, 2.35))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeNull()
  })

  it('does not fetch when lat/lng are null', () => {
    renderHook(() => useHourlyCloud(null, null))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
