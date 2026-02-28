import { describe, it, expect } from 'vitest';
import { prettyPrint } from './prettyPrint';

describe('prettyPrint', () => {
  it('formats an object with 2-space indent', () => {
    expect(prettyPrint({ a: 1, b: 2 })).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('formats an array with 2-space indent', () => {
    expect(prettyPrint([1, 2])).toBe('[\n  1,\n  2\n]');
  });

  it('formats null', () => {
    expect(prettyPrint(null)).toBe('null');
  });

  it('formats a string', () => {
    expect(prettyPrint('hello')).toBe('"hello"');
  });

  it('formats a number', () => {
    expect(prettyPrint(42)).toBe('42');
  });

  it('formats a boolean', () => {
    expect(prettyPrint(true)).toBe('true');
  });

  it('formats nested objects', () => {
    const input = { a: { b: 1 } };
    const expected = '{\n  "a": {\n    "b": 1\n  }\n}';
    expect(prettyPrint(input)).toBe(expected);
  });
});
