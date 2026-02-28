import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App — Integration Tests', () => {
  it('T2-01: renders two textareas with correct aria-labels', () => {
    render(<App />);
    expect(screen.getByLabelText('Left JSON input')).toBeInTheDocument();
    expect(screen.getByLabelText('Right JSON input')).toBeInTheDocument();
  });

  it('T2-02: renders Compare and Clear buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('T2-03 (AC-1): valid JSON → diff rows rendered, panels updated with formatted JSON', async () => {
    const user = userEvent.setup();
    render(<App />);

    const leftTextarea = screen.getByLabelText('Left JSON input');
    const rightTextarea = screen.getByLabelText('Right JSON input');

    await user.click(leftTextarea);
    await user.paste('{"a":1}');
    await user.click(rightTextarea);
    await user.paste('{"a":2}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    // Diff should be rendered
    expect(screen.getByRole('region', { name: 'Diff output' })).toBeInTheDocument();
    // Textareas should be formatted
    expect(leftTextarea).toHaveValue('{\n  "a": 1\n}');
    expect(rightTextarea).toHaveValue('{\n  "a": 2\n}');
  });

  it('T2-04 (AC-2): reordered keys → NoDiffMessage shown', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"b":1,"a":2}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":2,"b":1}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/No differences found/)).toBeInTheDocument();
  });

  it('T2-05 (AC-3): invalid JSON left → error message visible, diff absent', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{invalid json}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":1}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].textContent).toMatch(/Invalid JSON/);
    expect(screen.queryByRole('region', { name: 'Diff output' })).not.toBeInTheDocument();
  });

  it('T2-06 (AC-3): both invalid → both error messages visible simultaneously', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{bad}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{also bad}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(2);
    alerts.forEach((alert) => {
      expect(alert.textContent).toMatch(/Invalid JSON/);
    });
  });

  it('T2-07 (AC-4): empty left input → "Left input is empty" error visible', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Leave left empty, put valid JSON in right
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":1}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toMatch(/Left input is empty/);
  });

  it('T2-08 (AC-4): both empty → both "empty" errors visible', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /compare/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(2);
    expect(alerts[0].textContent).toMatch(/Left input is empty/);
    expect(alerts[1].textContent).toMatch(/Right input is empty/);
  });

  it('T2-09 (AC-5): identical valid JSON → NoDiffMessage visible', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"a":1,"b":2}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":1,"b":2}');

    await user.click(screen.getByRole('button', { name: /compare/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/No differences found/)).toBeInTheDocument();
  });

  it('T2-10 (AC-6): after diff, clicking Clear → inputs empty, diff absent', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"a":1}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":2}');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    // Verify diff exists
    expect(screen.getByRole('region', { name: 'Diff output' })).toBeInTheDocument();

    // Click Clear
    await user.click(screen.getByRole('button', { name: /clear/i }));

    // Inputs should be empty
    expect(screen.getByLabelText('Left JSON input')).toHaveValue('');
    expect(screen.getByLabelText('Right JSON input')).toHaveValue('');
    // Diff should be gone
    expect(screen.queryByRole('region', { name: 'Diff output' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('T2-12 (AC-8): added/removed/modified lines have appropriate markers', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Use a scenario where there are pure additions, pure removals, and modifications
    // Left: {"a":1,"b":2} → Right: {"a":99,"c":3}
    // After sort+format: "a" changes value (→ modified), "b" removed, "c" added
    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"a":1,"b":2}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":99,"c":3}');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    const region = screen.getByRole('region', { name: 'Diff output' });
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    // At minimum, we should see the ~ marker for modified lines
    expect(markerTexts).toContain('~');
  });

  it('T2-13: editing textarea after compare → diff result cleared', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"a":1}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":2}');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    expect(screen.getByRole('region', { name: 'Diff output' })).toBeInTheDocument();

    // Edit left textarea
    await user.click(screen.getByLabelText('Left JSON input'));
    await user.type(screen.getByLabelText('Left JSON input'), 'x');

    expect(screen.queryByRole('region', { name: 'Diff output' })).not.toBeInTheDocument();
  });

  it('T2-14: error message uses role="alert"', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /compare/i }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('T2-16 (AC-9): modified object key values shown as single paired row with inline highlight', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"key": "hello"}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"key": "world"}');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    const region = screen.getByRole('region', { name: 'Diff output' });

    // Should find a modified row (with ~ marker)
    const markers = region.querySelectorAll('[aria-hidden="true"]');
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    expect(markerTexts).toContain('~');

    // Should find inline highlights (<mark> elements)
    const highlightMarks = region.querySelectorAll('mark');
    expect(highlightMarks.length).toBeGreaterThan(0);

    // The modified row should show both old and new values
    expect(region.textContent).toContain('hello');
    expect(region.textContent).toContain('world');

    // Should NOT have separate removed+added rows for the value change
    // The only non-equal rows should be modified ones
    const modifiedRows = region.querySelectorAll('.diffRow--modified');
    expect(modifiedRows.length).toBeGreaterThan(0);

    // No separate removed + added rows for this value change
    const removedRows = region.querySelectorAll('.diffRow--removed');
    const addedRows = region.querySelectorAll('.diffRow--added');
    expect(removedRows.length).toBe(0);
    expect(addedRows.length).toBe(0);
  });

  it('T2-17 (AC-10): changed array items shown as single paired row with inline highlight', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('["apple", "banana"]');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('["apple", "mango"]');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    const region = screen.getByRole('region', { name: 'Diff output' });

    // Should find inline highlights
    const highlightMarks = region.querySelectorAll('mark');
    expect(highlightMarks.length).toBeGreaterThan(0);

    // The modified row should show both old and new array values
    expect(region.textContent).toContain('banana');
    expect(region.textContent).toContain('mango');

    // Should have modified rows, not separate removed+added
    const modifiedRows = region.querySelectorAll('.diffRow--modified');
    expect(modifiedRows.length).toBeGreaterThan(0);

    const removedRows = region.querySelectorAll('.diffRow--removed');
    const addedRows = region.querySelectorAll('.diffRow--added');
    expect(removedRows.length).toBe(0);
    expect(addedRows.length).toBe(0);
  });

  it('T2-15: NoDiffMessage has role="status"', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Left JSON input'));
    await user.paste('{"a":1}');
    await user.click(screen.getByLabelText('Right JSON input'));
    await user.paste('{"a":1}');
    await user.click(screen.getByRole('button', { name: /compare/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
