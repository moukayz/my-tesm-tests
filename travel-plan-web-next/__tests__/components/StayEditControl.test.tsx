import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StayEditControl from '../../components/StayEditControl'

const baseProps = {
  stayIndex: 0,
  city: 'Paris',
  currentNights: 4,
  maxAdditionalNights: 3, // next stay has 4 nights; max additional = 4 - 1 = 3
  isLast: false,
  isSaving: false,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
}

describe('StayEditControl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Rendering: isLast guard ─────────────────────────────────────────────

  it('renders null (nothing) for the last stay', () => {
    const { container } = render(<StayEditControl {...baseProps} isLast={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('does NOT render a pencil button for the last stay', () => {
    render(<StayEditControl {...baseProps} isLast={true} />)
    expect(screen.queryByRole('button', { name: /edit stay duration/i })).not.toBeInTheDocument()
  })

  // ── Read mode ───────────────────────────────────────────────────────────

  it('renders a pencil button for a non-last stay', () => {
    render(<StayEditControl {...baseProps} />)
    expect(screen.getByRole('button', { name: /edit stay duration for Paris/i })).toBeInTheDocument()
  })

  it('pencil button has correct aria-label including city name', () => {
    render(<StayEditControl {...baseProps} city="Berlin" />)
    expect(screen.getByRole('button', { name: /edit stay duration for Berlin/i })).toBeInTheDocument()
  })

  it('does NOT show the number input in read mode', () => {
    render(<StayEditControl {...baseProps} />)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  // ── Edit mode: opening ─────────────────────────────────────────────────

  it('clicking the pencil button shows the number input', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration for Paris/i }))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('input is initialized with currentNights value', async () => {
    render(<StayEditControl {...baseProps} currentNights={4} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('4')
  })

  it('edit group has role="group" with aria-label for city', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    expect(screen.getByRole('group', { name: /edit nights for Paris/i })).toBeInTheDocument()
  })

  // ── Edit mode: validation ───────────────────────────────────────────────

  it('shows validation error when value is below 1', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 1 night/i)
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
  })

  it('shows validation error when value exceeds max nights', async () => {
    // currentNights=4, maxAdditionalNights=3, so max=7
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/no nights left to borrow/i)
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
  })

  it('inline error has the correct id for aria-describedby', async () => {
    render(<StayEditControl {...baseProps} stayIndex={2} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    const error = screen.getByRole('alert')
    expect(error.id).toBe('stay-edit-error-2')
    expect(input).toHaveAttribute('aria-describedby', 'stay-edit-error-2')
  })

  it('clearing validation error when user changes input', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Fix the value
    fireEvent.change(input, { target: { value: '3' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // ── Edit mode: confirm ──────────────────────────────────────────────────

  it('clicking confirm with valid value calls onConfirm with stayIndex and newNights', async () => {
    render(<StayEditControl {...baseProps} stayIndex={1} currentNights={4} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(baseProps.onConfirm).toHaveBeenCalledWith(1, 3)
  })

  it('pressing Enter in the input triggers onConfirm', async () => {
    render(<StayEditControl {...baseProps} currentNights={4} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(baseProps.onConfirm).toHaveBeenCalledWith(0, 2)
  })

  it('no-op confirm (same value) closes edit mode without calling onConfirm', async () => {
    render(<StayEditControl {...baseProps} currentNights={4} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    // Value is already 4 (currentNights)
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
    // Edit mode should close
    await waitFor(() => {
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })

  // ── Edit mode: cancel ───────────────────────────────────────────────────

  it('clicking cancel calls onCancel', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(baseProps.onCancel).toHaveBeenCalled()
  })

  it('pressing Escape in the input calls onCancel', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(baseProps.onCancel).toHaveBeenCalled()
  })

  it('closes edit mode after cancel', async () => {
    render(<StayEditControl {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })

  // ── isSaving state ──────────────────────────────────────────────────────

  it('pencil button is disabled when isSaving=true', () => {
    render(<StayEditControl {...baseProps} isSaving={true} />)
    expect(screen.getByTestId('stay-edit-btn-0')).toBeDisabled()
  })

  it('confirm button is disabled when isSaving=true (after opening edit)', async () => {
    // Open edit first (isSaving=false), then re-render with isSaving=true
    const { rerender } = render(<StayEditControl {...baseProps} isSaving={false} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    rerender(<StayEditControl {...baseProps} isSaving={true} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('input is disabled when isSaving=true (after opening edit)', async () => {
    const { rerender } = render(<StayEditControl {...baseProps} isSaving={false} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    rerender(<StayEditControl {...baseProps} isSaving={true} />)
    expect(screen.getByRole('spinbutton')).toBeDisabled()
  })

  // ── data-testid attributes ──────────────────────────────────────────────

  it('pencil button has data-testid="stay-edit-btn-{stayIndex}"', () => {
    render(<StayEditControl {...baseProps} stayIndex={3} />)
    expect(screen.getByTestId('stay-edit-btn-3')).toBeInTheDocument()
  })

  it('input has data-testid="stay-edit-input-{stayIndex}"', async () => {
    render(<StayEditControl {...baseProps} stayIndex={2} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    expect(screen.getByTestId('stay-edit-input-2')).toBeInTheDocument()
  })

  it('confirm button has data-testid="stay-edit-confirm-{stayIndex}"', async () => {
    render(<StayEditControl {...baseProps} stayIndex={1} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    expect(screen.getByTestId('stay-edit-confirm-1')).toBeInTheDocument()
  })

  it('cancel button has data-testid="stay-edit-cancel-{stayIndex}"', async () => {
    render(<StayEditControl {...baseProps} stayIndex={0} />)
    await userEvent.click(screen.getByRole('button', { name: /edit stay duration/i }))
    expect(screen.getByTestId('stay-edit-cancel-0')).toBeInTheDocument()
  })
})
