import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AutocompleteInput from '../../components/AutocompleteInput'

const defaultProps = {
  id: 'test-input',
  value: '',
  onChange: jest.fn(),
  onSelect: jest.fn(),
  options: ['ICE 905', 'ICE 601', 'TGV 6201', 'Eurostar 9001'],
  placeholder: 'Search...',
}

describe('AutocompleteInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the input with the given placeholder', () => {
    render(<AutocompleteInput {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('calls onChange when user types', async () => {
    render(<AutocompleteInput {...defaultProps} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'ICE')
    expect(defaultProps.onChange).toHaveBeenCalled()
  })

  it('does not show dropdown when value is empty', () => {
    render(<AutocompleteInput {...defaultProps} value="" />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByText('ICE 905')).not.toBeInTheDocument()
    expect(screen.queryByText('TGV 6201')).not.toBeInTheDocument()
  })

  it('filters options based on current value', () => {
    render(<AutocompleteInput {...defaultProps} value="ICE" />)
    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    expect(screen.getByText('ICE 601')).toBeInTheDocument()
    expect(screen.queryByText('TGV 6201')).not.toBeInTheDocument()
  })

  it('does not show dropdown when there are no matches for typed input', () => {
    render(<AutocompleteInput {...defaultProps} value="ICE" options={[]} />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('is case-insensitive when filtering', () => {
    render(<AutocompleteInput {...defaultProps} value="ice" />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
  })

  it('calls onSelect and closes dropdown on option click', () => {
    render(<AutocompleteInput {...defaultProps} value="ICE" />)
    fireEvent.focus(screen.getByRole('textbox'))
    fireEvent.mouseDown(screen.getByText('ICE 905'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith('ICE 905')
    expect(screen.queryByText('ICE 601')).not.toBeInTheDocument()
  })

  it('does not show dropdown when disabled', () => {
    render(<AutocompleteInput {...defaultProps} disabled />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByText('ICE 905')).not.toBeInTheDocument()
  })

  it('disables the input element when disabled prop is true', () => {
    render(<AutocompleteInput {...defaultProps} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <AutocompleteInput {...defaultProps} value="ICE" />
        <button>Outside</button>
      </div>
    )
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('Outside'))
    expect(screen.queryByText('ICE 905')).not.toBeInTheDocument()
  })

  it('shows all options when showAllWhenEmpty is true and input is focused with empty value', () => {
    render(<AutocompleteInput {...defaultProps} value="" showAllWhenEmpty />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    expect(screen.getByText('ICE 601')).toBeInTheDocument()
    expect(screen.getByText('TGV 6201')).toBeInTheDocument()
    expect(screen.getByText('Eurostar 9001')).toBeInTheDocument()
  })

  it('filters options even when showAllWhenEmpty is true if user types', () => {
    render(<AutocompleteInput {...defaultProps} value="ICE" showAllWhenEmpty />)
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    expect(screen.getByText('ICE 601')).toBeInTheDocument()
    expect(screen.queryByText('TGV 6201')).not.toBeInTheDocument()
  })

  it('closes dropdown when showAllWhenEmpty is true and user clicks outside', () => {
    render(
      <div>
        <AutocompleteInput {...defaultProps} value="" showAllWhenEmpty />
        <button>Outside</button>
      </div>
    )
    fireEvent.focus(screen.getByRole('textbox'))
    expect(screen.getByText('ICE 905')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('Outside'))
    expect(screen.queryByText('ICE 905')).not.toBeInTheDocument()
  })

})
