import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlBar } from './ControlBar';

describe('ControlBar', () => {
  it('renders Compare and Clear buttons', () => {
    render(<ControlBar onCompare={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls onCompare when Compare button is clicked', async () => {
    const user = userEvent.setup();
    const handleCompare = vi.fn();
    render(<ControlBar onCompare={handleCompare} onClear={() => {}} />);
    await user.click(screen.getByRole('button', { name: /compare/i }));
    expect(handleCompare).toHaveBeenCalledOnce();
  });

  it('calls onClear when Clear button is clicked', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    render(<ControlBar onCompare={() => {}} onClear={handleClear} />);
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(handleClear).toHaveBeenCalledOnce();
  });

  it('disables Compare button when isComparing is true', () => {
    render(<ControlBar onCompare={() => {}} onClear={() => {}} isComparing={true} />);
    expect(screen.getByRole('button', { name: /compare/i })).toBeDisabled();
  });

  it('Clear button is never disabled', () => {
    render(<ControlBar onCompare={() => {}} onClear={() => {}} isComparing={true} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeEnabled();
  });

  it('has toolbar role', () => {
    render(<ControlBar onCompare={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
