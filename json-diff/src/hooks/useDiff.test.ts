import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiff } from './useDiff';

describe('useDiff', () => {
  it('has idle initial state', () => {
    const { result } = renderHook(() => useDiff());
    expect(result.current.leftInput).toEqual({ raw: '', error: null });
    expect(result.current.rightInput).toEqual({ raw: '', error: null });
    expect(result.current.diffResult).toEqual({ status: 'idle' });
  });

  it('setLeftRaw updates left input and clears error, resets to idle', () => {
    const { result } = renderHook(() => useDiff());
    act(() => result.current.setLeftRaw('hello'));
    expect(result.current.leftInput.raw).toBe('hello');
    expect(result.current.leftInput.error).toBeNull();
    expect(result.current.diffResult.status).toBe('idle');
  });

  it('setRightRaw updates right input and clears error, resets to idle', () => {
    const { result } = renderHook(() => useDiff());
    act(() => result.current.setRightRaw('world'));
    expect(result.current.rightInput.raw).toBe('world');
    expect(result.current.rightInput.error).toBeNull();
    expect(result.current.diffResult.status).toBe('idle');
  });

  it('compare() with both empty → error state, both panel errors set', () => {
    const { result } = renderHook(() => useDiff());
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('error');
    expect(result.current.leftInput.error).toMatch(/Left input is empty/);
    expect(result.current.rightInput.error).toMatch(/Right input is empty/);
  });

  it('compare() with left empty only → only left error', () => {
    const { result } = renderHook(() => useDiff());
    act(() => result.current.setRightRaw('{"a":1}'));
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('error');
    expect(result.current.leftInput.error).toMatch(/Left input is empty/);
    expect(result.current.rightInput.error).toBeNull();
  });

  it('compare() with right empty only → only right error', () => {
    const { result } = renderHook(() => useDiff());
    act(() => result.current.setLeftRaw('{"a":1}'));
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('error');
    expect(result.current.rightInput.error).toMatch(/Right input is empty/);
    expect(result.current.leftInput.error).toBeNull();
  });

  it('compare() with left invalid JSON → left error, right clean', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{foo: bar}');
      result.current.setRightRaw('{"a":1}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('error');
    expect(result.current.leftInput.error).toMatch(/^Invalid JSON:/);
    expect(result.current.rightInput.error).toBeNull();
  });

  it('compare() with both invalid → both errors set simultaneously', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{bad}');
      result.current.setRightRaw('{also bad}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('error');
    expect(result.current.leftInput.error).toMatch(/^Invalid JSON:/);
    expect(result.current.rightInput.error).toMatch(/^Invalid JSON:/);
  });

  it('compare() with valid, different JSON → diff status with lines', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{"a":1}');
      result.current.setRightRaw('{"a":2}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('diff');
    if (result.current.diffResult.status === 'diff') {
      expect(result.current.diffResult.lines.length).toBeGreaterThan(0);
    }
  });

  it('compare() with identical JSON after normalise → identical status', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{"b":1,"a":2}');
      result.current.setRightRaw('{"a":2,"b":1}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('identical');
  });

  it('compare() formats inputs (pretty-prints)', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{"a":1}');
      result.current.setRightRaw('{"b":2}');
    });
    act(() => result.current.compare());
    expect(result.current.leftInput.raw).toBe('{\n  "a": 1\n}');
    expect(result.current.rightInput.raw).toBe('{\n  "b": 2\n}');
  });

  it('clear() resets all state to initial values', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{"a":1}');
      result.current.setRightRaw('{"a":2}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).not.toBe('idle');

    act(() => result.current.clear());
    expect(result.current.leftInput).toEqual({ raw: '', error: null });
    expect(result.current.rightInput).toEqual({ raw: '', error: null });
    expect(result.current.diffResult).toEqual({ status: 'idle' });
  });

  it('editing textarea after compare → idle', () => {
    const { result } = renderHook(() => useDiff());
    act(() => {
      result.current.setLeftRaw('{"a":1}');
      result.current.setRightRaw('{"a":2}');
    });
    act(() => result.current.compare());
    expect(result.current.diffResult.status).toBe('diff');

    act(() => result.current.setLeftRaw('changed'));
    expect(result.current.diffResult.status).toBe('idle');
  });
});
