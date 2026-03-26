import React from 'react'
import { GripVertical } from 'lucide-react'
import type { RouteDay } from '../app/lib/itinerary'
import type { useTrainEditor } from '../app/lib/hooks/useTrainEditor'

interface TrainScheduleEditorModalProps {
  editor: ReturnType<typeof useTrainEditor>
  processedData: RouteDay[]
}

export default function TrainScheduleEditorModal({ editor, processedData }: TrainScheduleEditorModalProps) {
  if (editor.dayIndex === null) return null

  const day = processedData[editor.dayIndex]

  return (
    <div
      data-testid="train-schedule-editor-modal"
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit train schedule"
        className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full max-h-[85vh] overflow-auto"
      >
        <h2 className="text-lg font-semibold text-gray-900">Edit train schedule</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Day {day.dayNum} · {day.date}
        </p>

        {editor.legacyError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {editor.legacyError}
          </div>
        ) : (
          <>
            <div className="sr-only" aria-live="polite">{editor.announcement}</div>

            {editor.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 space-y-3">
                <p>No trains added for this day yet.</p>
                <button
                  type="button"
                  data-testid="train-editor-add-row"
                  onClick={editor.addRow}
                  disabled={editor.saving}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add train
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {editor.rows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    data-testid={`train-editor-row-${rowIndex + 1}`}
                    draggable={!editor.saving}
                    onDragStart={(e) => editor.handleDragStart(row.id, e)}
                    onDragOver={(e) => editor.handleDragOver(row.id, e)}
                    onDrop={(e) => editor.handleDrop(row.id, e)}
                    onDragEnd={editor.handleDragEnd}
                    className={`rounded-lg border border-gray-200 p-3 space-y-2 cursor-grab
                      ${editor.dragSourceRowId === row.id ? 'opacity-40' : ''}
                      ${editor.dragOverRowId === row.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                      ${editor.saving ? 'cursor-wait' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Train {rowIndex + 1}</p>
                      <span aria-label="Drag to reorder trains" className="text-gray-300 shrink-0">
                        <GripVertical size={14} />
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
                      <div>
                        <label htmlFor={`train-id-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                          Train ID
                        </label>
                        <input
                          id={`train-id-${row.id}`}
                          type="text"
                          aria-label={`Train ID for row ${rowIndex + 1}`}
                          value={row.trainId}
                          onChange={(e) => editor.setField(row.id, 'trainId', e.target.value)}
                          disabled={editor.saving}
                          ref={(el) => { editor.inputRefs.current[`${row.id}:trainId`] = el }}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus={rowIndex === 0}
                        />
                        {editor.rowErrors[row.id]?.trainId && (
                          <p className="text-xs text-red-600 mt-1">{editor.rowErrors[row.id].trainId}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`train-start-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                          Start station
                        </label>
                        <input
                          id={`train-start-${row.id}`}
                          type="text"
                          aria-label={`Start station for row ${rowIndex + 1}`}
                          value={row.start}
                          onChange={(e) => editor.setField(row.id, 'start', e.target.value)}
                          disabled={editor.saving}
                          ref={(el) => { editor.inputRefs.current[`${row.id}:start`] = el }}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label htmlFor={`train-end-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
                          End station
                        </label>
                        <input
                          id={`train-end-${row.id}`}
                          type="text"
                          aria-label={`End station for row ${rowIndex + 1}`}
                          value={row.end}
                          onChange={(e) => editor.setField(row.id, 'end', e.target.value)}
                          disabled={editor.saving}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          data-testid={`train-editor-delete-${rowIndex + 1}`}
                          onClick={() => editor.removeRow(row.id)}
                          disabled={editor.saving}
                          className="h-[34px] px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete row ${rowIndex + 1}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {editor.rowErrors[row.id]?.stationPair && (
                      <p className="text-xs text-red-600">{editor.rowErrors[row.id].stationPair}</p>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  data-testid="train-editor-add-row"
                  onClick={editor.addRow}
                  disabled={editor.saving}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Add train
                </button>
              </div>
            )}

            {editor.saveError && (
              <p data-testid="train-editor-save-error" role="alert" className="text-sm text-red-600 mt-3">
                {editor.saveError}
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            data-testid="train-editor-cancel"
            onClick={() => editor.close()}
            disabled={editor.saving}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {editor.legacyError ? 'Close' : 'Cancel'}
          </button>
          {!editor.legacyError && (
            <button
              data-testid="train-editor-save"
              onClick={editor.handleSave}
              disabled={editor.saving}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {editor.saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
