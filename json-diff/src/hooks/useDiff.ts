import { useState, useCallback } from 'react';
import type { JsonInputState, DiffResult } from '../types/diff';
import { parseJson } from '../utils/parseJson';
import { sortKeysDeep } from '../utils/sortKeysDeep';
import { prettyPrint } from '../utils/prettyPrint';
import { computeLineDiff } from '../utils/computeLineDiff';

export interface UseDiffReturn {
  leftInput: JsonInputState;
  rightInput: JsonInputState;
  diffResult: DiffResult;
  setLeftRaw: (value: string) => void;
  setRightRaw: (value: string) => void;
  compare: () => void;
  clear: () => void;
}

export function useDiff(): UseDiffReturn {
  const [leftRaw, setLeftRawState] = useState('');
  const [rightRaw, setRightRawState] = useState('');
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult>({ status: 'idle' });

  const setLeftRaw = useCallback((value: string) => {
    setLeftRawState(value);
    setLeftError(null);
    setDiffResult({ status: 'idle' });
  }, []);

  const setRightRaw = useCallback((value: string) => {
    setRightRawState(value);
    setRightError(null);
    setDiffResult({ status: 'idle' });
  }, []);

  const compare = useCallback(() => {
    // 1. Clear previous errors
    setLeftError(null);
    setRightError(null);

    // 2. Empty check (panel-specific messages)
    const leftEmpty = leftRaw.trim() === '';
    const rightEmpty = rightRaw.trim() === '';
    if (leftEmpty || rightEmpty) {
      const le = leftEmpty ? 'Left input is empty. Please paste JSON to compare.' : undefined;
      const re = rightEmpty ? 'Right input is empty. Please paste JSON to compare.' : undefined;
      setLeftError(le ?? null);
      setRightError(re ?? null);
      setDiffResult({ status: 'error', leftError: le, rightError: re });
      return;
    }

    // 3. Parse
    const leftResult = parseJson(leftRaw);
    const rightResult = parseJson(rightRaw);
    if (!leftResult.ok || !rightResult.ok) {
      const le = !leftResult.ok ? leftResult.error : null;
      const re = !rightResult.ok ? rightResult.error : null;
      setLeftError(le);
      setRightError(re);
      setDiffResult({
        status: 'error',
        leftError: le ?? undefined,
        rightError: re ?? undefined,
      });
      return;
    }

    // 4. Normalise
    const sortedLeft = sortKeysDeep(leftResult.value);
    const sortedRight = sortKeysDeep(rightResult.value);
    const formattedLeft = prettyPrint(sortedLeft);
    const formattedRight = prettyPrint(sortedRight);

    // 5. Update textareas with formatted output
    setLeftRawState(formattedLeft);
    setRightRawState(formattedRight);

    // 6. Compute diff
    try {
      const lines = computeLineDiff(formattedLeft, formattedRight);
      const isIdentical = lines.every((l) => l.type === 'equal');
      setDiffResult(
        isIdentical ? { status: 'identical' } : { status: 'diff', lines },
      );
    } catch {
      setDiffResult({
        status: 'error',
        internalError:
          'An unexpected error occurred while computing the diff. Please try again.',
      });
    }
  }, [leftRaw, rightRaw]);

  const clear = useCallback(() => {
    setLeftRawState('');
    setRightRawState('');
    setLeftError(null);
    setRightError(null);
    setDiffResult({ status: 'idle' });
  }, []);

  return {
    leftInput: { raw: leftRaw, error: leftError },
    rightInput: { raw: rightRaw, error: rightError },
    diffResult,
    setLeftRaw,
    setRightRaw,
    compare,
    clear,
  };
}
