import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: {
    Map: jest.fn(),
    addProtocol: jest.fn(),
    removeProtocol: jest.fn(),
  },
}))

jest.mock('@openmeteo/weather-map-layer', () => ({
  omProtocol: jest.fn(),
  updateCurrentBounds: jest.fn(),
  getValueFromLatLong: jest.fn().mockResolvedValue({ value: 15.5 }),
  defaultOmProtocolSettings: { colorScales: {} },
}))

// eslint-disable-next-line import/first
import maplibregl from 'maplibre-gl'
// eslint-disable-next-line import/first
import { omProtocol, getValueFromLatLong } from '@openmeteo/weather-map-layer'
// eslint-disable-next-line import/first
import ForecastTab from '../../components/ForecastTab'

const MockMap = maplibregl.Map as jest.Mock

function makeMapInstance() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  const layers = new Set<string>()
  const sources = new Set<string>()
  const instance = {
    on: jest.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
      if (event === 'load') cb()
    }),
    off: jest.fn(),
    remove: jest.fn(),
    addSource: jest.fn().mockImplementation((id: string) => { sources.add(id) }),
    addLayer: jest.fn().mockImplementation((cfg: { id: string }) => { layers.add(cfg.id) }),
    getLayer: jest.fn().mockImplementation((id: string) => layers.has(id) ? {} : undefined),
    getSource: jest.fn().mockImplementation((id: string) => sources.has(id) ? {} : undefined),
    removeLayer: jest.fn().mockImplementation((id: string) => { layers.delete(id) }),
    removeSource: jest.fn().mockImplementation((id: string) => { sources.delete(id) }),
    getBounds: jest.fn(),
    trigger: (event: string, ...args: unknown[]) => listeners[event]?.forEach((cb) => cb(...args)),
  }
  return instance
}

describe('ForecastTab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    MockMap.mockImplementation(() => makeMapInstance())
  })

  it('renders the map container', () => {
    render(<ForecastTab />)
    expect(screen.getByTestId('forecast-map')).toBeInTheDocument()
  })

  it('registers the om:// protocol with maplibre using a settings wrapper around omProtocol', () => {
    render(<ForecastTab />)
    // A wrapper is registered (not omProtocol directly) to inject custom protocol settings
    expect(maplibregl.addProtocol).toHaveBeenCalledWith('om', expect.any(Function))
    const registeredFn = (maplibregl.addProtocol as jest.Mock).mock.calls[0][1]
    expect(registeredFn).not.toBe(omProtocol)
  })

  it('creates a MapLibre map', () => {
    render(<ForecastTab />)
    expect(MockMap).toHaveBeenCalledWith(
      expect.objectContaining({ style: expect.stringContaining('openfreemap') })
    )
  })

  it('adds the ECMWF IFS HRES temperature raster source on load by default', () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)

    expect(instance.addSource).toHaveBeenCalledWith(
      'weather',
      expect.objectContaining({
        type: 'raster',
        url: expect.stringContaining('ecmwf_ifs/latest'),
      })
    )
    expect(instance.addSource).toHaveBeenCalledWith(
      'weather',
      expect.objectContaining({
        url: expect.stringContaining('temperature_2m'),
      })
    )
  })

  it('adds the raster layer on load', () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)

    expect(instance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'weather-layer', type: 'raster' })
    )
  })

  it('renders provider selector defaulting to ECMWF IFS HRES', () => {
    render(<ForecastTab />)
    const select = screen.getByTestId('provider-select') as HTMLSelectElement
    expect(select.value).toBe('ecmwf_ifs')
  })

  it('renders variable selector defaulting to temperature', () => {
    render(<ForecastTab />)
    const select = screen.getByTestId('variable-select') as HTMLSelectElement
    expect(select.value).toBe('temperature_2m')
  })

  it('provider selector has ECMWF IFS HRES, ECMWF IFS 0.25° and DWD ICON EU options', () => {
    render(<ForecastTab />)
    const select = screen.getByTestId('provider-select')
    expect(select).toContainElement(screen.getByRole('option', { name: /ECMWF IFS HRES/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /ECMWF IFS 0\.25/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /DWD ICON EU/ }))
  })

  it('variable selector has temperature and cloud cover options', () => {
    render(<ForecastTab />)
    const select = screen.getByTestId('variable-select')
    expect(select).toContainElement(screen.getByRole('option', { name: /Temperature/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /Total Cloud Cover/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /Low Cloud Cover/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /Mid Cloud Cover/ }))
    expect(select).toContainElement(screen.getByRole('option', { name: /High Cloud Cover/ }))
  })

  it('updates source URL when provider changes to DWD ICON EU', async () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)
    const addSourceCallsBefore = instance.addSource.mock.calls.length

    await userEvent.selectOptions(screen.getByTestId('provider-select'), 'dwd_icon_eu')

    // Should have re-added source with new URL
    const newCalls = instance.addSource.mock.calls.slice(addSourceCallsBefore)
    expect(newCalls.length).toBeGreaterThan(0)
    const lastCall = newCalls[newCalls.length - 1]
    expect(lastCall[1].url).toContain('dwd_icon_eu')
    expect(instance.removeLayer).toHaveBeenCalledWith('weather-layer')
    expect(instance.removeSource).toHaveBeenCalledWith('weather')
  })

  it('updates source URL when variable changes to cloud cover', async () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)
    const addSourceCallsBefore = instance.addSource.mock.calls.length

    await userEvent.selectOptions(screen.getByTestId('variable-select'), 'cloud_cover')

    const newCalls = instance.addSource.mock.calls.slice(addSourceCallsBefore)
    expect(newCalls.length).toBeGreaterThan(0)
    const lastCall = newCalls[newCalls.length - 1]
    expect(lastCall[1].url).toContain('cloud_cover')
  })

  it('shows provider and variable label', () => {
    render(<ForecastTab />)
    expect(screen.getByText(/ECMWF IFS HRES/)).toBeInTheDocument()
    expect(screen.getAllByText(/°C/).length).toBeGreaterThan(0)
  })

  it('removes the map on unmount', () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    const { unmount } = render(<ForecastTab />)
    unmount()

    expect(instance.remove).toHaveBeenCalledTimes(1)
  })

  it('calls getValueFromLatLong on mousemove and shows tooltip', async () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)

    await act(async () => {
      instance.trigger('mousemove', {
        point: { x: 100, y: 200 },
        lngLat: { lat: 48.85, lng: 2.35 },
      })
      // Let the async getValueFromLatLong promise resolve
      await Promise.resolve()
    })

    expect(getValueFromLatLong).toHaveBeenCalledWith(
      48.85,
      2.35,
      expect.stringContaining('ecmwf_ifs/latest')
    )
    expect(screen.getByTestId('forecast-tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('forecast-tooltip')).toHaveTextContent('15.5°C')
  })

  it('hides tooltip on mouseleave of the map container', async () => {
    const instance = makeMapInstance()
    MockMap.mockImplementation(() => instance)

    render(<ForecastTab />)

    await act(async () => {
      instance.trigger('mousemove', {
        point: { x: 100, y: 200 },
        lngLat: { lat: 48.85, lng: 2.35 },
      })
      await Promise.resolve()
    })

    expect(screen.getByTestId('forecast-tooltip')).toBeInTheDocument()

    act(() => {
      screen.getByTestId('forecast-map').dispatchEvent(new Event('mouseleave', { bubbles: false }))
    })

    expect(screen.queryByTestId('forecast-tooltip')).not.toBeInTheDocument()
  })
})
