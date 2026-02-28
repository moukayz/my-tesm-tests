import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonInputPanel } from './JsonInputPanel';

describe('JsonInputPanel', () => {
  it('renders a label and textarea for the left side', () => {
    render(<JsonInputPanel side="left" value="" error={null} onChange={() => {}} />);
    expect(screen.getByLabelText('Left JSON input')).toBeInTheDocument();
    expect(screen.getByText('Left (Original)')).toBeInTheDocument();
  });

  it('renders a label and textarea for the right side', () => {
    render(<JsonInputPanel side="right" value="" error={null} onChange={() => {}} />);
    expect(screen.getByLabelText('Right JSON input')).toBeInTheDocument();
    expect(screen.getByText('Right (Modified)')).toBeInTheDocument();
  });

  it('does not render error message when error is null', () => {
    render(<JsonInputPanel side="left" value="" error={null} onChange={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders error message when error prop is set', () => {
    render(
      <JsonInputPanel
        side="left"
        value=""
        error="Invalid JSON: something"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON: something');
  });

  it('sets aria-describedby and aria-invalid when error is present', () => {
    render(
      <JsonInputPanel
        side="left"
        value=""
        error="Some error"
        onChange={() => {}}
      />,
    );
    const textarea = screen.getByLabelText('Left JSON input');
    expect(textarea).toHaveAttribute('aria-describedby', 'panel-left-error');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-describedby or aria-invalid when no error', () => {
    render(<JsonInputPanel side="left" value="" error={null} onChange={() => {}} />);
    const textarea = screen.getByLabelText('Left JSON input');
    expect(textarea).not.toHaveAttribute('aria-describedby');
    expect(textarea).not.toHaveAttribute('aria-invalid');
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<JsonInputPanel side="left" value="" error={null} onChange={handleChange} />);
    const textarea = screen.getByLabelText('Left JSON input');
    await user.type(textarea, 'a');
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('displays the value prop in the textarea', () => {
    render(
      <JsonInputPanel side="left" value='{"test":true}' error={null} onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Left JSON input')).toHaveValue('{"test":true}');
  });
});
