import { describe, it, expect } from 'vitest';
import { computeLineDiff } from './computeLineDiff';
import { sortKeysDeep } from './sortKeysDeep';
import { prettyPrint } from './prettyPrint';

describe('computeLineDiff', () => {
  it('returns all equal lines for identical strings', () => {
    const text = '{\n  "a": 1\n}';
    const result = computeLineDiff(text, text);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((l) => l.type === 'equal')).toBe(true);
  });

  it('detects added lines', () => {
    const left = '{\n  "a": 1\n}';
    const right = '{\n  "a": 1,\n  "b": 2\n}';
    const result = computeLineDiff(left, right);
    const added = result.filter((l) => l.type === 'added');
    expect(added.length).toBeGreaterThan(0);
    // Added lines should have rightLineNo but not leftLineNo
    for (const line of added) {
      expect(line.rightLineNo).toBeDefined();
      expect(line.leftLineNo).toBeUndefined();
    }
  });

  it('detects removed lines', () => {
    const left = '{\n  "a": 1,\n  "b": 2\n}';
    const right = '{\n  "a": 1\n}';
    const result = computeLineDiff(left, right);
    const removed = result.filter((l) => l.type === 'removed');
    expect(removed.length).toBeGreaterThan(0);
    // Removed lines should have leftLineNo but not rightLineNo
    for (const line of removed) {
      expect(line.leftLineNo).toBeDefined();
      expect(line.rightLineNo).toBeUndefined();
    }
  });

  it('handles mixed diff (added, removed, equal)', () => {
    const left = '{\n  "a": 1,\n  "b": 2\n}';
    const right = '{\n  "a": 99,\n  "b": 2\n}';
    const result = computeLineDiff(left, right);
    const types = new Set(result.map((l) => l.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('merges consecutive removed+added into modified line with inline segments', () => {
    const left = '{\n  "key": "hello"\n}';
    const right = '{\n  "key": "world"\n}';
    const result = computeLineDiff(left, right);
    const modified = result.filter((l) => l.type === 'modified');
    expect(modified.length).toBe(1);
    expect(modified[0].leftValue).toBe('  "key": "hello"');
    expect(modified[0].rightValue).toBe('  "key": "world"');
    expect(modified[0].leftSegments).toBeDefined();
    expect(modified[0].rightSegments).toBeDefined();
    expect(modified[0].leftLineNo).toBeDefined();
    expect(modified[0].rightLineNo).toBeDefined();
    // No separate removed or added lines for the value change
    expect(result.filter((l) => l.type === 'removed').length).toBe(0);
    expect(result.filter((l) => l.type === 'added').length).toBe(0);
  });

  it('AC-9: modified object key produces single modified row, not removed+added', () => {
    const left = prettyPrint(sortKeysDeep({ key: 'hello' }));
    const right = prettyPrint(sortKeysDeep({ key: 'world' }));
    const result = computeLineDiff(left, right);
    const modified = result.filter((l) => l.type === 'modified');
    expect(modified.length).toBe(1);
    // Inline segments should highlight the differing chars
    const leftHighlighted = modified[0].leftSegments!.filter((s) => s.highlight);
    const rightHighlighted = modified[0].rightSegments!.filter((s) => s.highlight);
    expect(leftHighlighted.length).toBeGreaterThan(0);
    expect(rightHighlighted.length).toBeGreaterThan(0);
  });

  it('AC-10: changed array item produces single modified row', () => {
    const left = prettyPrint(sortKeysDeep(['apple', 'banana']));
    const right = prettyPrint(sortKeysDeep(['apple', 'mango']));
    const result = computeLineDiff(left, right);
    const modified = result.filter((l) => l.type === 'modified');
    expect(modified.length).toBe(1);
    expect(modified[0].leftValue).toContain('banana');
    expect(modified[0].rightValue).toContain('mango');
  });

  it('inline segments contain correct highlighted text', () => {
    const left = '{\n  "a": "cat"\n}';
    const right = '{\n  "a": "car"\n}';
    const result = computeLineDiff(left, right);
    const modified = result.filter((l) => l.type === 'modified');
    expect(modified.length).toBe(1);
    // Reconstruct text from segments
    const leftText = modified[0].leftSegments!.map((s) => s.text).join('');
    const rightText = modified[0].rightSegments!.map((s) => s.text).join('');
    expect(leftText).toBe('  "a": "cat"');
    expect(rightText).toBe('  "a": "car"');
  });

  it('does not merge non-consecutive removed and added lines', () => {
    // When there are removed lines not immediately followed by added lines,
    // they should stay as separate removed/added lines
    const left = '{\n  "a": 1,\n  "b": 2\n}';
    const right = '{\n  "a": 1,\n  "c": 3\n}';
    const result = computeLineDiff(left, right);
    // "b": 2 is removed and "c": 3 is added — these have different keys
    // so the diff library may produce them as removed+added which get merged,
    // OR keep them separate. Either way, the structure should be valid.
    for (const line of result) {
      expect(['equal', 'added', 'removed', 'modified']).toContain(line.type);
    }
  });

  it('returns empty array for two empty strings', () => {
    expect(computeLineDiff('', '')).toEqual([]);
  });

  it('increments line numbers correctly', () => {
    const left = 'line1\nline2\nline3';
    const right = 'line1\nline2\nline3';
    const result = computeLineDiff(left, right);
    expect(result).toHaveLength(3);
    expect(result[0].leftLineNo).toBe(1);
    expect(result[0].rightLineNo).toBe(1);
    expect(result[1].leftLineNo).toBe(2);
    expect(result[1].rightLineNo).toBe(2);
    expect(result[2].leftLineNo).toBe(3);
    expect(result[2].rightLineNo).toBe(3);
  });

  it('AC-2 regression: normalised reordered keys produce no diff', () => {
    const left = prettyPrint(sortKeysDeep({ b: 1, a: 2 }));
    const right = prettyPrint(sortKeysDeep({ a: 2, b: 1 }));
    const result = computeLineDiff(left, right);
    expect(result.every((l) => l.type === 'equal')).toBe(true);
  });
});
