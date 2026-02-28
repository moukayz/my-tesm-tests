import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from './DiffViewer';
import type { DiffLine } from '../../types/diff';

const mockLines: DiffLine[] = [
  { type: 'equal', value: '{', leftLineNo: 1, rightLineNo: 1 },
  {
    type: 'modified',
    value: '',
    leftLineNo: 2,
    rightLineNo: 2,
    leftValue: '  "a": 1',
    rightValue: '  "a": 99',
    leftSegments: [
      { text: '  "a": ', highlight: false },
      { text: '1', highlight: true },
    ],
    rightSegments: [
      { text: '  "a": ', highlight: false },
      { text: '99', highlight: true },
    ],
  },
  { type: 'equal', value: '}', leftLineNo: 3, rightLineNo: 3 },
];

describe('DiffViewer', () => {
  it('renders the correct number of diff rows', () => {
    render(<DiffViewer lines={mockLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    expect(region).toBeInTheDocument();
    // 3 diff rows (2 equal + 1 modified), each has 2 markers = 6 markers
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    expect(markers.length).toBe(6);
  });

  it('has role="region" with aria-label "Diff output"', () => {
    render(<DiffViewer lines={mockLines} />);
    expect(screen.getByRole('region', { name: 'Diff output' })).toBeInTheDocument();
  });

  it('shows "-" marker for removed lines in left column', () => {
    const removedLines: DiffLine[] = [
      { type: 'removed', value: '  "b": 2', leftLineNo: 1 },
    ];
    render(<DiffViewer lines={removedLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    expect(markerTexts).toContain('-');
  });

  it('shows "+" marker for added lines in right column', () => {
    const addedLines: DiffLine[] = [
      { type: 'added', value: '  "c": 3', rightLineNo: 1 },
    ];
    render(<DiffViewer lines={addedLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    expect(markerTexts).toContain('+');
  });

  it('shows space marker for equal lines', () => {
    const equalLines: DiffLine[] = [
      { type: 'equal', value: 'test', leftLineNo: 1, rightLineNo: 1 },
    ];
    render(<DiffViewer lines={equalLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    // Both left and right markers should be space
    expect(markers[0].textContent?.trim()).toBe('');
    expect(markers[1].textContent?.trim()).toBe('');
  });

  it('displays line numbers', () => {
    render(<DiffViewer lines={mockLines} />);
    expect(screen.getByRole('region', { name: 'Diff output' }).textContent).toContain('1');
    expect(screen.getByRole('region', { name: 'Diff output' }).textContent).toContain('2');
    expect(screen.getByRole('region', { name: 'Diff output' }).textContent).toContain('3');
  });

  it('renders column headers', () => {
    render(<DiffViewer lines={mockLines} />);
    expect(screen.getByText('Left (Original)')).toBeInTheDocument();
    expect(screen.getByText('Right (Modified)')).toBeInTheDocument();
  });

  it('shows "~" marker for modified lines', () => {
    render(<DiffViewer lines={mockLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    expect(markerTexts).toContain('~');
  });

  it('renders <mark> elements for inline highlights in modified rows', () => {
    render(<DiffViewer lines={mockLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const marks = region.querySelectorAll('mark');
    expect(marks.length).toBe(2); // "1" on left, "99" on right
    expect(marks[0].textContent).toBe('1');
    expect(marks[1].textContent).toBe('99');
  });

  it('renders modified row with left and right values', () => {
    render(<DiffViewer lines={mockLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    expect(region.textContent).toContain('"a": 1');
    expect(region.textContent).toContain('"a": 99');
  });

  it('applies diffRow--modified class to modified rows', () => {
    render(<DiffViewer lines={mockLines} />);
    const region = screen.getByRole('region', { name: 'Diff output' });
    const modifiedRows = region.querySelectorAll('.diffRow--modified');
    expect(modifiedRows.length).toBe(1);
  });
});
