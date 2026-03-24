'use client'

import React from 'react'
import AutocompleteInput from './AutocompleteInput'

interface TrainSelectorControlProps {
  id: string
  value: string
  options: string[]
  onChange: (text: string) => void
  onSelect: (name: string) => void
  isLoading: boolean
  label?: string
  hint?: string
  placeholder?: string
}

export default function TrainSelectorControl({
  id,
  value,
  options,
  onChange,
  onSelect,
  isLoading,
  label = 'Train',
  hint,
  placeholder,
}: TrainSelectorControlProps) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
      <div className="flex items-baseline gap-2">
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-gray-700"
        >
          {label}
        </label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
        {isLoading && (
          <span
            role="status"
            aria-label="Loading"
            className="inline-block w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          />
        )}
      </div>
      <AutocompleteInput
        id={id}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        options={options}
        placeholder={placeholder}
      />
    </div>
  )
}
