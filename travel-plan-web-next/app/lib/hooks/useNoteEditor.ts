import { useState } from 'react'
import type { RouteDay } from '../itinerary'

interface UseNoteEditorOptions {
  days: RouteDay[]
  itineraryId?: string
}

export function useNoteEditor({ days, itineraryId }: UseNoteEditorOptions) {
  const [noteOverrides, setNoteOverrides] = useState<Record<number, string>>({})
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null)
  const [noteEditingValue, setNoteEditingValue] = useState('')

  const saveNote = async (dayIndex: number, note: string) => {
    if (itineraryId) {
      return fetch(`/api/itineraries/${itineraryId}/days/${dayIndex}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
    }
    return fetch('/api/note-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayIndex, note }),
    })
  }

  const handleNoteEdit = (dayIndex: number, currentNote: string) => {
    setEditingNoteIndex(dayIndex)
    setNoteEditingValue(currentNote)
  }

  const handleNoteBlur = async (dayIndex: number) => {
    setEditingNoteIndex(null)
    const currentNote = noteOverrides[dayIndex] ?? days[dayIndex]?.note ?? ''
    if (noteEditingValue === currentNote) return

    setNoteOverrides((prev) => ({ ...prev, [dayIndex]: noteEditingValue }))
    try {
      const response = await saveNote(dayIndex, noteEditingValue)
      if (!response.ok) {
        setNoteOverrides((prev) => ({ ...prev, [dayIndex]: currentNote }))
      }
    } catch {
      setNoteOverrides((prev) => ({ ...prev, [dayIndex]: currentNote }))
    }
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, dayIndex: number) => {
    if (e.key === 'Escape') {
      setEditingNoteIndex(null)
      setNoteEditingValue(noteOverrides[dayIndex] ?? days[dayIndex]?.note ?? '')
    }
  }

  return {
    noteOverrides,
    editingNoteIndex,
    noteEditingValue,
    setNoteEditingValue,
    handleNoteEdit,
    handleNoteBlur,
    handleNoteKeyDown,
  }
}
