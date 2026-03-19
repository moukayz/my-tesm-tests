/**
 * Component tests for FloatingExportButton
 * Written BEFORE implementation (TDD mandate from CLAUDE.md).
 * Slice 3 — F-03: Floating Export Icon
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// FloatingExportButton does not exist yet — these tests are intentionally failing.
import FloatingExportButton from '../../components/FloatingExportButton'

const defaultProps = {
  hasData: true,
  isPickerOpen: false,
  onOpen: jest.fn(),
}

describe('FloatingExportButton', () => {
  afterEach(() => jest.clearAllMocks())

  // T1-S3-01: renders testid
  it('renders data-testid="export-fab"', () => {
    render(<FloatingExportButton {...defaultProps} />)
    expect(screen.getByTestId('export-fab')).toBeInTheDocument()
  })

  // T1-S3-02: enabled when hasData=true
  it('button is NOT disabled when hasData=true', () => {
    render(<FloatingExportButton {...defaultProps} hasData={true} />)
    expect(screen.getByTestId('export-fab')).not.toBeDisabled()
  })

  // T1-S3-03: disabled when hasData=false
  it('button is disabled when hasData=false', () => {
    render(<FloatingExportButton {...defaultProps} hasData={false} />)
    const btn = screen.getByTestId('export-fab')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-disabled', 'true')
  })

  // T1-S3-04: disabled button has title tooltip
  it('disabled button has title="Nothing to export"', () => {
    render(<FloatingExportButton {...defaultProps} hasData={false} />)
    expect(screen.getByTestId('export-fab')).toHaveAttribute('title', 'Nothing to export')
  })

  // T1-S3-05: enabled button has correct aria-label
  it('enabled button has aria-label="Export itinerary"', () => {
    render(<FloatingExportButton {...defaultProps} hasData={true} />)
    expect(screen.getByTestId('export-fab')).toHaveAttribute('aria-label', 'Export itinerary')
  })

  // T1-S3-06: disabled button has descriptive aria-label
  it('disabled button has aria-label containing "nothing to export"', () => {
    render(<FloatingExportButton {...defaultProps} hasData={false} />)
    const label = screen.getByTestId('export-fab').getAttribute('aria-label') ?? ''
    expect(label.toLowerCase()).toContain('nothing to export')
  })

  // T1-S3-07: aria-haspopup="true" always present
  it('has aria-haspopup="true" always', () => {
    render(<FloatingExportButton {...defaultProps} />)
    expect(screen.getByTestId('export-fab')).toHaveAttribute('aria-haspopup', 'true')
  })

  // T1-S3-08: aria-expanded="false" when picker closed
  it('aria-expanded is "false" when isPickerOpen=false', () => {
    render(<FloatingExportButton {...defaultProps} isPickerOpen={false} />)
    expect(screen.getByTestId('export-fab').getAttribute('aria-expanded')).toBe('false')
  })

  // T1-S3-09: aria-expanded="true" when picker open
  it('aria-expanded is "true" when isPickerOpen=true', () => {
    render(<FloatingExportButton {...defaultProps} isPickerOpen={true} />)
    expect(screen.getByTestId('export-fab').getAttribute('aria-expanded')).toBe('true')
  })

  // T1-S3-10: clicking enabled button calls onOpen once
  it('clicking enabled button calls onOpen once', () => {
    const onOpen = jest.fn()
    render(<FloatingExportButton {...defaultProps} hasData={true} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  // T1-S3-11: clicking disabled button does NOT call onOpen
  it('clicking disabled button does NOT call onOpen', () => {
    const onOpen = jest.fn()
    render(<FloatingExportButton {...defaultProps} hasData={false} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('export-fab'))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
