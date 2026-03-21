export interface TrainScheduleDraftRow {
  id: string
  trainId: string
  start: string
  end: string
}

export interface TrainScheduleDraftRowErrors {
  trainId?: string
  stationPair?: string
}

export interface TrainScheduleValidationResult {
  isValid: boolean
  errors: Record<string, TrainScheduleDraftRowErrors>
  firstInvalidField?: {
    rowId: string
    field: 'trainId' | 'start'
  }
}

type ParseOk = {
  ok: true
  rows: TrainScheduleDraftRow[]
}

type ParseError = {
  ok: false
  error: string
}

export type TrainScheduleParseResult = ParseOk | ParseError

const ALLOWED_KEYS = new Set(['train_id', 'start', 'end'])

let rowCounter = 0

function createRowId() {
  rowCounter += 1
  return `train-row-${rowCounter}`
}

export function createEmptyTrainScheduleDraftRow(): TrainScheduleDraftRow {
  return {
    id: createRowId(),
    trainId: '',
    start: '',
    end: '',
  }
}

export function parseTrainScheduleForDraft(trainData: unknown): TrainScheduleParseResult {
  if (!Array.isArray(trainData)) {
    return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
  }

  const rows: TrainScheduleDraftRow[] = []

  for (const entry of trainData) {
    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
    }

    const item = entry as Record<string, unknown>
    for (const key of Object.keys(item)) {
      if (!ALLOWED_KEYS.has(key)) {
        return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
      }
    }

    if (typeof item.train_id !== 'string' || item.train_id.trim().length === 0) {
      return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
    }

    if (item.start != null && typeof item.start !== 'string') {
      return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
    }

    if (item.end != null && typeof item.end !== 'string') {
      return { ok: false, error: 'This day contains legacy train data that cannot be edited here.' }
    }

    rows.push({
      id: createRowId(),
      trainId: item.train_id,
      start: typeof item.start === 'string' ? item.start : '',
      end: typeof item.end === 'string' ? item.end : '',
    })
  }

  return { ok: true, rows }
}

export function validateTrainScheduleDraftRows(rows: TrainScheduleDraftRow[]): TrainScheduleValidationResult {
  const errors: Record<string, TrainScheduleDraftRowErrors> = {}
  let firstInvalidField: TrainScheduleValidationResult['firstInvalidField']

  for (const row of rows) {
    const rowErrors: TrainScheduleDraftRowErrors = {}
    const trainId = row.trainId.trim()
    const start = row.start.trim()
    const end = row.end.trim()

    if (trainId.length === 0) {
      rowErrors.trainId = 'Train ID is required.'
      if (!firstInvalidField) {
        firstInvalidField = { rowId: row.id, field: 'trainId' }
      }
    }

    if ((start.length > 0 && end.length === 0) || (start.length === 0 && end.length > 0)) {
      rowErrors.stationPair = 'Start and end must both be filled or both left empty.'
      if (!firstInvalidField) {
        firstInvalidField = { rowId: row.id, field: 'start' }
      }
    }

    if (rowErrors.trainId || rowErrors.stationPair) {
      errors[row.id] = rowErrors
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstInvalidField,
  }
}

export function serializeDraftRows(rows: TrainScheduleDraftRow[]): string {
  const payload = rows.map((row) => {
    const trainId = row.trainId.trim()
    const start = row.start.trim()
    const end = row.end.trim()
    if (start.length > 0 && end.length > 0) {
      return { train_id: trainId, start, end }
    }
    return { train_id: trainId }
  })

  return JSON.stringify(payload)
}

export function moveDraftRow(rows: TrainScheduleDraftRow[], fromIndex: number, toIndex: number): TrainScheduleDraftRow[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
    return rows
  }

  const next = [...rows]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}
