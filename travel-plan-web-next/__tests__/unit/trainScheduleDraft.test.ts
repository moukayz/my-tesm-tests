import {
  parseTrainScheduleForDraft,
  serializeDraftRows,
  validateTrainScheduleDraftRows,
  type TrainScheduleDraftRow,
} from '../../app/lib/trainScheduleDraft'

describe('trainScheduleDraft helpers', () => {
  it('parses supported train rows into draft rows', () => {
    const result = parseTrainScheduleForDraft([
      { train_id: 'ICE 123', start: 'Berlin', end: 'Munich' },
      { train_id: 'TGV 8088' },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual(
      expect.objectContaining({ trainId: 'ICE 123', start: 'Berlin', end: 'Munich' })
    )
    expect(result.rows[1]).toEqual(
      expect.objectContaining({ trainId: 'TGV 8088', start: '', end: '' })
    )
  })

  it('rejects rows that contain unsupported extra keys', () => {
    const result = parseTrainScheduleForDraft([
      { train_id: 'ICE 123', start: 'Berlin', end: 'Munich', foo: 'bar' },
    ])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/legacy train data/i)
  })

  it('serializes draft rows using trimmed contract shape', () => {
    const rows: TrainScheduleDraftRow[] = [
      { id: 'row-1', trainId: ' ICE123 ', start: ' Berlin ', end: ' Munich ' },
      { id: 'row-2', trainId: ' TGV 42 ', start: ' ', end: '' },
    ]

    expect(serializeDraftRows(rows)).toBe(
      JSON.stringify([
        { train_id: 'ICE123', start: 'Berlin', end: 'Munich' },
        { train_id: 'TGV 42' },
      ])
    )
  })

  it('validates blank train_id and half-filled station pairs', () => {
    const rows: TrainScheduleDraftRow[] = [
      { id: 'row-1', trainId: '   ', start: '', end: '' },
      { id: 'row-2', trainId: 'ICE 123', start: 'Berlin', end: '' },
    ]

    const result = validateTrainScheduleDraftRows(rows)
    expect(result.isValid).toBe(false)
    expect(result.errors['row-1'].trainId).toMatch(/train id is required/i)
    expect(result.errors['row-2'].stationPair).toMatch(/start and end/i)
    expect(result.firstInvalidField).toEqual({ rowId: 'row-1', field: 'trainId' })
  })

  it('accepts remove-all flow as valid and serializes to empty array', () => {
    const rows: TrainScheduleDraftRow[] = []
    const validation = validateTrainScheduleDraftRows(rows)

    expect(validation.isValid).toBe(true)
    expect(serializeDraftRows(rows)).toBe('[]')
  })
})
