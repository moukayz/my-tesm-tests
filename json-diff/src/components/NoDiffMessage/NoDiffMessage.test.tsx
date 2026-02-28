import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoDiffMessage } from './NoDiffMessage';

describe('NoDiffMessage', () => {
  it('renders the expected text', () => {
    render(<NoDiffMessage />);
    expect(
      screen.getByText(/No differences found/),
    ).toBeInTheDocument();
  });

  it('has role="status"', () => {
    render(<NoDiffMessage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('mentions formatting and key sorting', () => {
    render(<NoDiffMessage />);
    expect(
      screen.getByText(/identical after formatting and key sorting/),
    ).toBeInTheDocument();
  });
});
