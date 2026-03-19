/**
 * Component tests for ExportToolbar
 * Written BEFORE implementation (TDD mandate from CLAUDE.md).
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ExportToolbar from '../../components/ExportToolbar'

const defaultProps = {
  hasData: true,
  isPickerOpen: false,
  onOpen: jest.fn(),
}

describe('ExportToolbar', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the export button', () => {
    render(<ExportToolbar {...defaultProps} />)
    expect(screen.getByTestId('export-button')).toBeInTheDocument()
  })

  it('button is enabled when hasData is true', () => {
    render(<ExportToolbar {...defaultProps} hasData={true} />)
    expect(screen.getByTestId('export-button')).not.toBeDisabled()
  })

  it('button is disabled when hasData is false', () => {
    render(<ExportToolbar {...defaultProps} hasData={false} />)
    expect(screen.getByTestId('export-button')).toBeDisabled()
  })

  it('disabled button has a tooltip (title attribute)', () => {
    render(<ExportToolbar {...defaultProps} hasData={false} />)
    const btn = screen.getByTestId('export-button')
    expect(btn).toHaveAttribute('title')
    expect(btn.getAttribute('title')).toBeTruthy()
  })

  it('enabled button does not have a title attribute', () => {
    render(<ExportToolbar {...defaultProps} hasData={true} />)
    const btn = screen.getByTestId('export-button')
    // No tooltip needed when data is available
    expect(btn).not.toHaveAttribute('title')
  })

  it('clicking the button calls onOpen callback', () => {
    const onOpen = jest.fn()
    render(<ExportToolbar {...defaultProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('export-button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('button has aria-haspopup attribute', () => {
    render(<ExportToolbar {...defaultProps} />)
    expect(screen.getByTestId('export-button')).toHaveAttribute('aria-haspopup', 'true')
  })

  it('aria-expanded is false when picker is closed', () => {
    render(<ExportToolbar {...defaultProps} isPickerOpen={false} />)
    const btn = screen.getByTestId('export-button')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('aria-expanded is true when picker is open', () => {
    render(<ExportToolbar {...defaultProps} isPickerOpen={true} />)
    const btn = screen.getByTestId('export-button')
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('button label contains "Export"', () => {
    render(<ExportToolbar {...defaultProps} />)
    expect(screen.getByTestId('export-button').textContent).toContain('Export')
  })
})
