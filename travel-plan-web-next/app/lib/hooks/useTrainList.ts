import { useState, useEffect } from 'react'
import type { TrainRow } from '../trainDelay'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 350

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchTrainsWithRetry(url: string): Promise<TrainRow[]> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url)
      const data = await response.json()
      const rows = Array.isArray(data) ? data : []
      if (rows.length > 0) return rows as TrainRow[]
      lastError = new Error('empty_train_list')
    } catch (error) {
      lastError = error
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  throw lastError ?? new Error('train_list_unavailable')
}

interface UseTrainListOptions {
  url?: string
}

interface UseTrainListResult {
  trains: TrainRow[]
  trainInput: string
  selectedTrain: string
  selectedRailway: string
  trainsLoading: boolean
  error: string | null
  handleTrainChange: (text: string) => void
  handleTrainSelect: (name: string) => void
}

export function useTrainList(options: UseTrainListOptions = {}): UseTrainListResult {
  const { url = '/api/trains' } = options

  const [trains, setTrains] = useState<TrainRow[]>([])
  const [trainInput, setTrainInput] = useState('')
  const [selectedTrain, setSelectedTrain] = useState('')
  const [selectedRailway, setSelectedRailway] = useState('')
  const [trainsLoading, setTrainsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    setTrainsLoading(true)
    setError(null)

    fetchTrainsWithRetry(url)
      .then((rows) => {
        if (!isActive) return
        setTrains(rows)
      })
      .catch(() => {
        if (!isActive) return
        setError('Failed to load train list')
      })
      .finally(() => {
        if (!isActive) return
        setTrainsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [url])

  function handleTrainChange(text: string) {
    setTrainInput(text)
    if (text !== selectedTrain) {
      setSelectedTrain('')
      setSelectedRailway('')
    }
  }

  function handleTrainSelect(name: string) {
    setTrainInput(name)
    setSelectedTrain(name)
    setSelectedRailway(trains.find((t) => t.train_name === name)?.railway ?? 'german')
  }

  return {
    trains,
    trainInput,
    selectedTrain,
    selectedRailway,
    trainsLoading,
    error,
    handleTrainChange,
    handleTrainSelect,
  }
}
