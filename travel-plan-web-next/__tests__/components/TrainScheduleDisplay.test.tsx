import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TrainScheduleDisplay, { TrainScheduleSkeleton } from '../../components/TrainScheduleDisplay'
import type { RouteDay } from '../../app/lib/itinerary'

type Train = RouteDay['train']

const DB_TRAIN: Train = [{ train_id: 'ICE123', start: 'augsburg', end: 'munich' }]
const NON_DB_TRAIN: Train = [{ train_id: 'TGV456' }]
const SCHEDULE_KEY = 'ICE 123|augsburg|munich'
const RESOLVED_SCHEDULE = {
  fromStation: 'Augsburg Hbf',
  depTime: '10:00',
  toStation: 'München Hbf',
  arrTime: '10:42',
}

function makeOnEdit() {
  return jest.fn()
}

describe('TrainScheduleSkeleton', () => {
  it('renders with role="status" and aria-label="Loading"', () => {
    render(<TrainScheduleSkeleton />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('renders animated pulse elements', () => {
    const { container } = render(<TrainScheduleSkeleton />)
    const pulseEls = container.querySelectorAll('.animate-pulse')
    expect(pulseEls.length).toBeGreaterThan(0)
  })
})

describe('TrainScheduleDisplay', () => {
  describe('empty train', () => {
    it('renders only the edit button when train is empty', () => {
      const onEdit = makeOnEdit()
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={[]}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={onEdit}
        />
      )
      expect(screen.getByTestId('train-json-edit-btn-0')).toBeInTheDocument()
      expect(screen.queryByTestId('train-tag')).not.toBeInTheDocument()
    })
  })

  describe('DB train (has start/end)', () => {
    it('renders a train tag with normalized train ID', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={DB_TRAIN}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      expect(screen.getByTestId('train-tag')).toHaveTextContent('ICE 123')
    })

    it('renders schedule grid when schedule is resolved', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={DB_TRAIN}
          trainSchedules={{ [SCHEDULE_KEY]: RESOLVED_SCHEDULE }}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      const grid = screen.getByTestId('schedule-grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveTextContent('Augsburg Hbf')
      expect(grid).toHaveTextContent('10:00')
      expect(grid).toHaveTextContent('München Hbf')
      expect(grid).toHaveTextContent('10:42')
    })

    it('renders skeleton while loading', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={DB_TRAIN}
          trainSchedules={{}}
          schedulesLoading={true}
          onEdit={makeOnEdit()}
        />
      )
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByTestId('schedule-grid')).not.toBeInTheDocument()
    })

    it('renders nothing for schedule when scheduleKey is in trainSchedules (done loading)', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={DB_TRAIN}
          trainSchedules={{ [SCHEDULE_KEY]: null }}
          schedulesLoading={true}
          onEdit={makeOnEdit()}
        />
      )
      // scheduleKey is already in trainSchedules → not loading for this key
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('non-DB train (no start/end)', () => {
    it('renders a dash instead of a train tag', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={NON_DB_TRAIN}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      expect(screen.getByTestId('invalid-train-dash')).toBeInTheDocument()
      expect(screen.queryByTestId('train-tag')).not.toBeInTheDocument()
    })

    it('renders the normalized train ID as italic comment', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={NON_DB_TRAIN}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      expect(screen.getByTestId('invalid-train-comment')).toHaveTextContent('TGV 456')
    })
  })

  describe('edit button', () => {
    it('renders edit button with correct data-testid', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={3}
          train={[]}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      expect(screen.getByTestId('train-json-edit-btn-3')).toBeInTheDocument()
    })

    it('calls onEdit with the button element when clicked', () => {
      const onEdit = makeOnEdit()
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={[]}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={onEdit}
        />
      )
      const btn = screen.getByTestId('train-json-edit-btn-0')
      fireEvent.click(btn)
      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(onEdit).toHaveBeenCalledWith(btn)
    })

    it('has opacity-0 class by default (hover-only on desktop)', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={[]}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      const btn = screen.getByTestId('train-json-edit-btn-0')
      expect(btn.className).toContain('opacity-0')
    })

    it('does not have opacity-0 class when alwaysShowEdit=true', () => {
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={[]}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
          alwaysShowEdit
        />
      )
      const btn = screen.getByTestId('train-json-edit-btn-0')
      expect(btn.className).not.toContain('opacity-0')
    })
  })

  describe('multiple trains in one day', () => {
    it('renders a tag for each DB train', () => {
      const multipleTrain: Train = [
        { train_id: 'ICE123', start: 'a', end: 'b' },
        { train_id: 'TGV99', start: 'c', end: 'd' },
      ]
      render(
        <TrainScheduleDisplay
          dayIndex={0}
          train={multipleTrain}
          trainSchedules={{}}
          schedulesLoading={false}
          onEdit={makeOnEdit()}
        />
      )
      const tags = screen.getAllByTestId('train-tag')
      expect(tags).toHaveLength(2)
    })
  })
})
