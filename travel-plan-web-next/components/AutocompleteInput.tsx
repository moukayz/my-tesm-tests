'use client'

import { useState, useRef, useCallback } from 'react'
import { useOutsideClick } from '../app/lib/hooks/useOutsideClick'

interface AutocompleteInputProps {
  id: string
  value: string
  onChange: (text: string) => void
  onSelect: (opt: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  showAllWhenEmpty?: boolean
}

export default function AutocompleteInput({
  id,
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  disabled,
  showAllWhenEmpty,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = value
    ? options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase())).slice(0, 50)
    : showAllWhenEmpty
      ? options.slice(0, 50)
      : []

  const closeDropdown = useCallback(() => setOpen(false), [])
  useOutsideClick(containerRef, closeDropdown)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
    setOpen(true)
  }

  function handleSelect(opt: string) {
    onSelect(opt)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full py-2 px-3 border border-gray-200 rounded-md text-sm text-gray-900 bg-white outline-none transition-colors focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={() => handleSelect(opt)}
              className="px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
