import React from 'react'
import { render, screen } from '@testing-library/react'
import TrainSelectorControl from '../../components/TrainSelectorControl'

describe('TrainSelectorControl', () => {
  const defaultProps = {
    id: 'train-input',
    value: '',
    options: [],
    onChange: jest.fn(),
    onSelect: jest.fn(),
    isLoading: false,
  }

  it('renders the default label "Train"', () => {
    render(<TrainSelectorControl {...defaultProps} />)
    expect(screen.getByText('Train')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(<TrainSelectorControl {...defaultProps} label="Railway" />)
    expect(screen.getByText('Railway')).toBeInTheDocument()
  })

  it('renders hint text when provided', () => {
    render(<TrainSelectorControl {...defaultProps} hint="e.g. ICE 905" />)
    expect(screen.getByText('e.g. ICE 905')).toBeInTheDocument()
  })

  it('shows spinner when isLoading is true', () => {
    render(<TrainSelectorControl {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('hides spinner when isLoading is false', () => {
    render(<TrainSelectorControl {...defaultProps} isLoading={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the autocomplete input with provided id', () => {
    render(<TrainSelectorControl {...defaultProps} id="test-input" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
