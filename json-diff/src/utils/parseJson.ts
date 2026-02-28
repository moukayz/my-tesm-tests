import type { ParseResult } from '../types/diff';

export function parseJson(raw: string): ParseResult {
  if (raw.trim() === '') {
    return { ok: false, error: 'Input is empty. Please paste JSON to compare.' };
  }
  try {
    const value: unknown = JSON.parse(raw);
    return { ok: true, value };
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }
}
