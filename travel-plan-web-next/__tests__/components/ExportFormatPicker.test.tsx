/**
 * Component tests for ExportFormatPicker
 * Written BEFORE implementation (TDD mandate from CLAUDE.md).
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ExportFormatPicker from '../../components/ExportFormatPicker'

const defaultProps = {
  onExportMarkdown: jest.fn(),
  onExportPdf: jest.fn(),
  onClose: jest.fn(),
  exportError: null,
  isPdfGenerating: false,
}

describe('ExportFormatPicker', () => {
  afterEach(() => jest.clearAllMocks())

  it('renders the format picker root element', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-format-picker')).toBeInTheDocument()
  })

  it('renders Markdown export button', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-md')).toBeInTheDocument()
  })

  it('renders PDF export button', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument()
  })

  it('renders close/cancel button', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-close')).toBeInTheDocument()
  })

  it('clicking Markdown button calls onExportMarkdown', () => {
    const onExportMarkdown = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onExportMarkdown={onExportMarkdown} />)
    fireEvent.click(screen.getByTestId('export-md'))
    expect(onExportMarkdown).toHaveBeenCalledTimes(1)
  })

  it('clicking PDF button does NOT call onExportPdf (PDF export temporarily disabled)', () => {
    const onExportPdf = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onExportPdf={onExportPdf} />)
    fireEvent.click(screen.getByTestId('export-pdf'))
    expect(onExportPdf).not.toHaveBeenCalled()
  })

  it('clicking close/cancel button calls onClose', () => {
    const onClose = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('export-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key press calls onClose', () => {
    const onClose = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('outside click (mousedown on body) calls onClose', () => {
    const onClose = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT show error message when exportError is null', () => {
    render(<ExportFormatPicker {...defaultProps} exportError={null} />)
    expect(screen.queryByTestId('export-pdf-error')).not.toBeInTheDocument()
  })

  it('shows role="alert" error message when exportError is set', () => {
    render(<ExportFormatPicker {...defaultProps} exportError="PDF generation failed" />)
    const alert = screen.getByTestId('export-pdf-error')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute('role', 'alert')
    expect(alert.textContent).toContain('PDF generation failed')
  })

  it('does NOT show PDF spinner when isPdfGenerating is false (PDF export disabled)', () => {
    render(<ExportFormatPicker {...defaultProps} isPdfGenerating={false} />)
    expect(screen.queryByTestId('export-pdf-spinner')).not.toBeInTheDocument()
  })

  it('does NOT show PDF spinner even when isPdfGenerating is true (PDF export disabled)', () => {
    // PDF export is temporarily disabled — spinner is never shown regardless of isPdfGenerating
    render(<ExportFormatPicker {...defaultProps} isPdfGenerating={true} />)
    expect(screen.queryByTestId('export-pdf-spinner')).not.toBeInTheDocument()
  })

  it('Markdown button is NOT disabled (PDF export disabled has no effect on Markdown)', () => {
    render(<ExportFormatPicker {...defaultProps} isPdfGenerating={true} />)
    expect(screen.getByTestId('export-md')).not.toBeDisabled()
  })

  it('PDF button is always disabled (PDF export temporarily disabled)', () => {
    render(<ExportFormatPicker {...defaultProps} isPdfGenerating={false} />)
    expect(screen.getByTestId('export-pdf')).toBeDisabled()
  })

  it('PDF button shows "(unavailable)" text when PDF export is disabled', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-pdf').textContent).toContain('unavailable')
  })

  it('PDF button has a title attribute indicating it is temporarily unavailable', () => {
    render(<ExportFormatPicker {...defaultProps} />)
    expect(screen.getByTestId('export-pdf')).toHaveAttribute('title', 'PDF export is temporarily unavailable')
  })

  it('mousedown inside the picker does NOT call onClose', () => {
    const onClose = jest.fn()
    render(<ExportFormatPicker {...defaultProps} onClose={onClose} />)
    const picker = screen.getByTestId('export-format-picker')
    fireEvent.mouseDown(picker)
    expect(onClose).not.toHaveBeenCalled()
  })
})
