/** Result of parsing a raw JSON string */
export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/** A single line in the diff output */
export type DiffLineType = 'added' | 'removed' | 'equal' | 'modified';

/** A segment of inline character-level diff within a modified line */
export interface InlineSegment {
  /** The text content of this segment */
  text: string;
  /** Whether this segment is highlighted (i.e., changed) */
  highlight: boolean;
}

export interface DiffLine {
  type: DiffLineType;
  /** The line content (without trailing newline). Used for equal/added/removed lines. */
  value: string;
  /** Line number in the LEFT formatted string (undefined for added-only lines) */
  leftLineNo?: number;
  /** Line number in the RIGHT formatted string (undefined for removed-only lines) */
  rightLineNo?: number;
  /** Left-side value for modified lines */
  leftValue?: string;
  /** Right-side value for modified lines */
  rightValue?: string;
  /** Inline diff segments for the left side of a modified line */
  leftSegments?: InlineSegment[];
  /** Inline diff segments for the right side of a modified line */
  rightSegments?: InlineSegment[];
}

/** The complete result returned by useDiff */
export type DiffResult =
  | { status: 'idle' }
  | { status: 'error'; leftError?: string; rightError?: string; internalError?: string }
  | { status: 'identical' }
  | { status: 'diff'; lines: DiffLine[] };

/** State held per input panel */
export interface JsonInputState {
  raw: string;
  error: string | null;
}
