import { describe, it, expect } from 'vitest';
import { parseJson } from './parseJson';

describe('parseJson', () => {
  it('parses a valid object', () => {
    const result = parseJson('{"a":1}');
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses a valid array', () => {
    const result = parseJson('[1,2,3]');
    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('parses a valid primitive string', () => {
    const result = parseJson('"hello"');
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('parses null', () => {
    const result = parseJson('null');
    expect(result).toEqual({ ok: true, value: null });
  });

  it('parses a valid number', () => {
    const result = parseJson('42');
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('parses a valid boolean', () => {
    const result = parseJson('true');
    expect(result).toEqual({ ok: true, value: true });
  });

  it('returns error for empty string', () => {
    const result = parseJson('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Input is empty. Please paste JSON to compare.');
    }
  });

  it('returns error for whitespace-only string', () => {
    const result = parseJson('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Input is empty. Please paste JSON to compare.');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = parseJson('{foo: bar}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/^Invalid JSON:/);
    }
  });

  it('returns error for truncated JSON', () => {
    const result = parseJson('{"a":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/^Invalid JSON:/);
    }
  });
});
