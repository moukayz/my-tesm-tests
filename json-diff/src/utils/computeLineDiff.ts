import { diffLines, diffChars } from 'diff';
import type { DiffLine, InlineSegment } from '../types/diff';

/**
 * Compute inline character-level diff segments for two strings.
 * Returns a pair of segment arrays: [leftSegments, rightSegments].
 */
function computeInlineSegments(
  leftText: string,
  rightText: string,
): [InlineSegment[], InlineSegment[]] {
  const charDiffs = diffChars(leftText, rightText);
  const leftSegments: InlineSegment[] = [];
  const rightSegments: InlineSegment[] = [];

  for (const part of charDiffs) {
    if (part.removed) {
      leftSegments.push({ text: part.value, highlight: true });
    } else if (part.added) {
      rightSegments.push({ text: part.value, highlight: true });
    } else {
      // unchanged text appears on both sides
      leftSegments.push({ text: part.value, highlight: false });
      rightSegments.push({ text: part.value, highlight: false });
    }
  }

  return [leftSegments, rightSegments];
}

/**
 * Post-process raw diff lines: merge consecutive removed+added pairs
 * into single 'modified' entries with inline character diff.
 */
function mergeModifiedLines(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];

    // Check if this is a removed line followed by an added line → merge into modified
    if (
      current.type === 'removed' &&
      i + 1 < lines.length &&
      lines[i + 1].type === 'added'
    ) {
      const next = lines[i + 1];
      const [leftSegments, rightSegments] = computeInlineSegments(
        current.value,
        next.value,
      );

      result.push({
        type: 'modified',
        value: '',
        leftLineNo: current.leftLineNo,
        rightLineNo: next.rightLineNo,
        leftValue: current.value,
        rightValue: next.value,
        leftSegments,
        rightSegments,
      });

      i += 2; // skip both the removed and added lines
    } else {
      result.push(current);
      i += 1;
    }
  }

  return result;
}

export function computeLineDiff(left: string, right: string): DiffLine[] {
  if (left === '' && right === '') return [];

  const changes = diffLines(left, right);
  const rawLines: DiffLine[] = [];
  let leftLineNo = 1;
  let rightLineNo = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    // diffLines always adds a trailing newline to the last chunk — remove the empty string
    if (lines[lines.length - 1] === '') lines.pop();

    const type = change.added ? 'added' : change.removed ? 'removed' : 'equal';

    for (const lineValue of lines) {
      const diffLine: DiffLine = { type, value: lineValue };
      if (type !== 'added') {
        diffLine.leftLineNo = leftLineNo++;
      }
      if (type !== 'removed') {
        diffLine.rightLineNo = rightLineNo++;
      }
      rawLines.push(diffLine);
    }
  }

  return mergeModifiedLines(rawLines);
}
