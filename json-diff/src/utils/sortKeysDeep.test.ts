import { describe, it, expect } from 'vitest';
import { sortKeysDeep } from './sortKeysDeep';

describe('sortKeysDeep', () => {
  it('sorts a flat object alphabetically', () => {
    expect(sortKeysDeep({ b: 2, a: 1 })).toEqual({ a: 1, b: 2 });
    // Check key order
    expect(Object.keys(sortKeysDeep({ b: 2, a: 1 }) as Record<string, unknown>)).toEqual(['a', 'b']);
  });

  it('sorts nested objects', () => {
    const input = { z: { b: 2, a: 1 } };
    const expected = { z: { a: 1, b: 2 } };
    expect(sortKeysDeep(input)).toEqual(expected);
  });

  it('preserves array order (does not sort array items)', () => {
    expect(sortKeysDeep([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('sorts keys inside array elements', () => {
    const input = [{ b: 2, a: 1 }];
    const result = sortKeysDeep(input) as Record<string, unknown>[];
    expect(Object.keys(result[0])).toEqual(['a', 'b']);
  });

  it('returns a primitive string unchanged', () => {
    expect(sortKeysDeep('hello')).toBe('hello');
  });

  it('returns a number unchanged', () => {
    expect(sortKeysDeep(42)).toBe(42);
  });

  it('returns a boolean unchanged', () => {
    expect(sortKeysDeep(true)).toBe(true);
  });

  it('returns null unchanged', () => {
    expect(sortKeysDeep(null)).toBeNull();
  });

  it('sorts mixed nesting (objects and arrays)', () => {
    const input = { z: [{ b: 1, a: 2 }], a: null };
    const result = sortKeysDeep(input);
    expect(result).toEqual({ a: null, z: [{ a: 2, b: 1 }] });
    expect(Object.keys(result as Record<string, unknown>)).toEqual(['a', 'z']);
  });

  it('AC-2 regression: reordered keys produce same output', () => {
    const left = sortKeysDeep({ b: 1, a: 2 });
    const right = sortKeysDeep({ a: 2, b: 1 });
    expect(left).toEqual(right);
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
  });
});
