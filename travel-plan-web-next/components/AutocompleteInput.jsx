'use client'

import { useState, useRef, useEffect } from 'react'

export default function AutocompleteInput({ id, value, onChange, onSelect, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const filtered = value
    ? options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
    : options

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e) {
    onChange(e.target.value)
    setOpen(true)
  }

  function handleSelect(opt) {
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
          {filtered.map(opt => (
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
