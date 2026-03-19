/**
 * Component tests for ExportSuccessToast
 * Written BEFORE implementation (TDD mandate from CLAUDE.md).
 * Slice 1 — F-01: Export Success Toast
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ExportSuccessToast does not exist yet — these tests are intentionally failing.
import ExportSuccessToast from '../../components/ExportSuccessToast'

describe('ExportSuccessToast', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  // T1-S1-01: renders testid
  it('renders data-testid="export-success-toast"', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    expect(screen.getByTestId('export-success-toast')).toBeInTheDocument()
  })

  // T1-S1-02: role="status"
  it('has role="status" for live region', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    expect(screen.getByTestId('export-success-toast')).toHaveAttribute('role', 'status')
  })

  // T1-S1-03: aria-live="polite"
  it('has aria-live="polite"', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    expect(screen.getByTestId('export-success-toast')).toHaveAttribute('aria-live', 'polite')
  })

  // T1-S1-04: renders message text
  it('renders the message text in the body', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    expect(screen.getByText('Itinerary exported!')).toBeInTheDocument()
  })

  // T1-S1-05: renders dismiss button
  it('renders dismiss button with data-testid="export-toast-dismiss" and aria-label="Dismiss"', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    const btn = screen.getByTestId('export-toast-dismiss')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Dismiss')
  })

  // T1-S1-06: clicking dismiss calls onDismiss
  it('clicking the dismiss button calls onDismiss', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('export-toast-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  // T1-S1-07: auto-dismisses after default 3000ms
  it('auto-dismisses after 3000ms (default autoDismissMs)', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  // T1-S1-08: does NOT call onDismiss before autoDismissMs elapses
  it('does NOT call onDismiss before autoDismissMs elapses', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} />)
    act(() => {
      jest.advanceTimersByTime(2999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  // T1-S1-09: custom autoDismissMs is respected
  it('respects custom autoDismissMs=5000', () => {
    const onDismiss = jest.fn()
    render(<ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} autoDismissMs={5000} />)
    act(() => {
      jest.advanceTimersByTime(4999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  // T1-S1-10: timer cleared on unmount — no stale call
  it('timer is cleared on unmount — onDismiss is NOT called after unmount', () => {
    const onDismiss = jest.fn()
    const { unmount } = render(
      <ExportSuccessToast message="Itinerary exported!" onDismiss={onDismiss} autoDismissMs={3000} />
    )
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    unmount()
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
