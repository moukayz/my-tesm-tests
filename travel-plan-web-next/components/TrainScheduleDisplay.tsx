'use client'

import React from 'react'
import { Pencil } from 'lucide-react'
import { normalizeTrainId, type RouteDay } from '../app/lib/itinerary'
import { buildScheduleKey } from '../app/lib/hooks/useTrainSchedules'

export type ScheduleEntry = {
  fromStation: string
  depTime: string
  toStation: string
  arrTime: string
}

export interface TrainScheduleDisplayProps {
  dayIndex: number
  train: RouteDay['train']
  trainSchedules: Record<string, ScheduleEntry | null>
  schedulesLoading: boolean
  onEdit: (triggerButton: HTMLButtonElement) => void
  alwaysShowEdit?: boolean
}

export function TrainScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 pl-1"
    >
      <div className="h-4 rounded bg-gray-200 animate-pulse w-28" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-8" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-20" />
      <div className="h-4 rounded bg-gray-200 animate-pulse w-8" />
    </div>
  )
}

export default function TrainScheduleDisplay({
  dayIndex,
  train,
  trainSchedules,
  schedulesLoading,
  onEdit,
  alwaysShowEdit,
}: TrainScheduleDisplayProps) {
  const editBtnClass = alwaysShowEdit
    ? 'shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
    : 'shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/train-cell:opacity-100'

  return (
    <div className="flex items-center gap-2">
      {train && train.length > 0 ? (
        <div className="flex-1 min-w-0 space-y-2">
          {train.map((item, i) => {
            const trainId = normalizeTrainId(item.train_id)
            const isDbTrain = !!(item.start && item.end)
            const scheduleKey = isDbTrain ? buildScheduleKey(trainId, item.start, item.end) : null
            const schedule = scheduleKey ? trainSchedules[scheduleKey] : null
            const isLoading = scheduleKey && schedulesLoading && !(scheduleKey in trainSchedules)

            return (
              <div key={i} className="flex flex-col gap-0.5">
                {isDbTrain ? (
                  <div>
                    <span
                      data-testid="train-tag"
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"
                    >
                      {trainId}
                    </span>
                  </div>
                ) : (
                  <>
                    <span data-testid="invalid-train-dash" className="text-gray-400 italic">—</span>
                    <span data-testid="invalid-train-comment" className="text-xs text-gray-400 italic">({trainId})</span>
                  </>
                )}

                {isLoading ? (
                  <TrainScheduleSkeleton />
                ) : schedule ? (
                  <div
                    data-testid="schedule-grid"
                    className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-xs text-gray-500 pl-1 items-baseline"
                  >
                    <span className="truncate">{schedule.fromStation}</span>
                    <span className="tabular-nums text-right">{schedule.depTime}</span>
                    <span className="truncate">{schedule.toStation}</span>
                    <span className="tabular-nums text-right">{schedule.arrTime}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : <div className="flex-1" />}
      <button
        data-testid={`train-json-edit-btn-${dayIndex}`}
        onClick={(e) => onEdit(e.currentTarget)}
        className={editBtnClass}
        aria-label="Edit train schedule"
      >
        <Pencil size={14} />
      </button>
    </div>
  )
}
