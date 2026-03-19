'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Pencil } from 'lucide-react'

export interface StayEditControlProps {
  stayIndex: number
  city: string
  currentNights: number
  /** Next stay's current nights - 1 (max we can increase by) */
  maxAdditionalNights: number
  isLast: boolean
  isSaving: boolean
  onConfirm: (stayIndex: number, newNights: number) => void
  onCancel: () => void
}

/**
 * Inline edit widget rendered inside the overnight merged cell.
 * Renders null for the last stay (no following stay to absorb/donate days).
 */
export default function StayEditControl({
  stayIndex,
  city,
  currentNights,
  maxAdditionalNights,
  isLast,
  isSaving,
  onConfirm,
  onCancel,
}: StayEditControlProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(currentNights))
  const [validationError, setValidationError] = useState<string | null>(null)
  const pencilRef = useRef<HTMLButtonElement>(null)

  // Last stay: no edit affordance
  if (isLast) return null

  const maxNights = currentNights + maxAdditionalNights

  const openEdit = () => {
    setInputValue(String(currentNights))
    setValidationError(null)
    setIsEditing(true)
  }

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setValidationError(null)
    onCancel()
    // Return focus to pencil button
    setTimeout(() => pencilRef.current?.focus(), 0)
  }, [onCancel])

  const handleConfirm = useCallback(() => {
    const parsed = parseInt(inputValue, 10)

    // No-op if same value
    if (parsed === currentNights) {
      setIsEditing(false)
      setValidationError(null)
      return
    }

    // Validate
    if (!Number.isFinite(parsed) || parsed < 1) {
      setValidationError('A stay must be at least 1 night.')
      return
    }
    if (parsed > maxNights) {
      setValidationError('The next stay has no nights left to borrow.')
      return
    }

    setValidationError(null)
    setIsEditing(false)
    onConfirm(stayIndex, parsed)
  }, [inputValue, currentNights, maxNights, stayIndex, onConfirm])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    // Clear validation error on input change
    if (validationError) setValidationError(null)
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span>{city}</span>
        <button
          ref={pencilRef}
          data-testid={`stay-edit-btn-${stayIndex}`}
          aria-label={`Edit stay duration for ${city}`}
          onClick={openEdit}
          disabled={isSaving}
          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span>{city}</span>
      <div
        role="group"
        aria-label={`Edit nights for ${city}`}
        className="flex flex-col items-center gap-1"
      >
        <input
          data-testid={`stay-edit-input-${stayIndex}`}
          type="number"
          min={1}
          max={maxNights}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-label="Nights"
          aria-describedby={validationError ? `stay-edit-error-${stayIndex}` : undefined}
          disabled={isSaving}
          autoFocus
          className="w-14 text-center border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        {validationError && (
          <span
            id={`stay-edit-error-${stayIndex}`}
            data-testid={`stay-edit-error-${stayIndex}`}
            role="alert"
            className="text-xs text-red-600 text-center max-w-[8rem]"
          >
            {validationError}
          </span>
        )}
        <div className="flex gap-1">
          <button
            data-testid={`stay-edit-confirm-${stayIndex}`}
            aria-label="Confirm"
            disabled={isSaving}
            onClick={handleConfirm}
            className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ✓
          </button>
          <button
            data-testid={`stay-edit-cancel-${stayIndex}`}
            aria-label="Cancel"
            onClick={handleCancel}
            className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
