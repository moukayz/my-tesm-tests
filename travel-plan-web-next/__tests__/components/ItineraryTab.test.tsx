import React from 'react'
import { render, screen } from '@testing-library/react'
import ItineraryTab from '../../components/ItineraryTab'

describe('ItineraryTab', () => {
  it('renders all table header columns', () => {
    render(<ItineraryTab />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Weekday')).toBeInTheDocument()
    expect(screen.getByText('Day')).toBeInTheDocument()
    expect(screen.getByText('Overnight')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Train Schedule')).toBeInTheDocument()
  })

  it('renders a row for every entry in route.json', async () => {
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)
    // Each row has a date cell — count them
    const dateCells = screen.getAllByText(/^\d{4}\/\d+\/\d+$/)
    expect(dateCells).toHaveLength(routeData.length)
  })

  it('renders the first day date and plan', async () => {
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)
    expect(screen.getByText(routeData[0].date)).toBeInTheDocument()
    expect(screen.getByText(routeData[0].plan)).toBeInTheDocument()
  })

  it('renders a dash for days with no train schedule', () => {
    render(<ItineraryTab />)
    // Days with empty train array render an em-dash placeholder
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders train schedule as a list for days that have trains', async () => {
    const routeData = (await import('../../data/route.json')).default
    const dayWithTrain = routeData.find((d) => d.train.length > 0)!
    render(<ItineraryTab />)
    expect(screen.getByText(dayWithTrain.train[0])).toBeInTheDocument()
  })

  it('renders overnight location cells with merged rowspans', async () => {
    const routeData = (await import('../../data/route.json')).default
    render(<ItineraryTab />)
    // Each unique overnight location should appear in the DOM.
    // Skip '—' since it also appears as the train-schedule placeholder spans.
    const uniqueLocations = [...new Set(routeData.map((d) => d.overnight))].filter(
      (l) => l !== '—'
    )
    for (const location of uniqueLocations) {
      expect(screen.getByText(location)).toBeInTheDocument()
    }
  })
})
