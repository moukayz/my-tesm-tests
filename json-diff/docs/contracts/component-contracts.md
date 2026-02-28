# Frontend Component Contracts — JSON Diff Checker

> **Status:** Draft  
> **Date:** 2026-02-27  
> **Author:** Chief Tech Lead  
> **Source of truth for types:** `src/types/diff.ts`  
> **Rule:** Any change to a component's public props or hook return shape must update this document first, then the type file, then the implementation.

---

## 0. Shared Type Definitions

All types below are defined in `src/types/diff.ts` and imported by every component and hook.

```typescript
// src/types/diff.ts

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export type DiffLineType = "added" | "removed" | "equal";

export interface DiffLine {
  type: DiffLineType;
  /** Line text content (no trailing newline) */
  value: string;
  /** 1-based line number in the LEFT formatted string; undefined for pure "added" lines */
  leftLineNo?: number;
  /** 1-based line number in the RIGHT formatted string; undefined for pure "removed" lines */
  rightLineNo?: number;
}

export type DiffResult =
  | { status: "idle" }
  | { status: "error"; leftError?: string; rightError?: string }
  | { status: "identical" }
  | { status: "diff"; lines: DiffLine[] };

export interface JsonInputState {
  raw: string;
  error: string | null;
}
```

---

## 1. `<App />` — Root Component

### Responsibility
Owns all application state, wires hooks to child components, composes the layout.

### Props
None (root component — no parent).

### Internal State (owned by `useDiff` hook)
| State field | Type | Description |
|---|---|---|
| `leftInput` | `JsonInputState` | Raw text + validation error for left panel |
| `rightInput` | `JsonInputState` | Raw text + validation error for right panel |
| `diffResult` | `DiffResult` | Current diff status/result |

### Renders
```
<App>
  ├── <JsonInputPanel side="left"  … />
  ├── <JsonInputPanel side="right" … />
  ├── <ControlBar … />
  ├── <DiffViewer … />        (only when diffResult.status === "diff")
  └── <NoDiffMessage />       (only when diffResult.status === "identical")
```

### Behaviour Contract
- Passes `onCompare` and `onClear` callbacks down to `<ControlBar />`.
- Passes `value`, `error`, and `onChange` down to each `<JsonInputPanel />`.
- Never performs JSON parsing or diffing directly — delegates to `useDiff`.

---

## 2. `<JsonInputPanel />` — Input Panel

### Responsibility
Renders a labelled `<textarea>` for one side (left or right), displays validation errors inline.

### Props

```typescript
interface JsonInputPanelProps {
  /** Which side this panel represents */
  side: "left" | "right";
  /** Current raw text value */
  value: string;
  /** Validation / parse error to display; null = no error */
  error: string | null;
  /** Called when the user edits the textarea */
  onChange: (value: string) => void;
}
```

### Behaviour Contract
- Renders a `<textarea>` with:
  - `aria-label`: `"Left JSON input"` or `"Right JSON input"` depending on `side`.
  - `aria-describedby`: `"panel-left-error"` or `"panel-right-error"` when `error` is not null.
  - `spellCheck={false}`, `autoCorrect="off"`, `autoCapitalize="off"` for code input UX.
- When `error` is non-null, renders an error container:
  - `id="panel-{side}-error"`
  - `role="alert"`
  - Displays the `error` string as plain text (no HTML injection).
- When `error` is null, the error container is **not rendered** (not just hidden).
- Calls `onChange(newValue)` on every keystroke (`onChange` event of textarea).
- Does **not** trigger compare on any keystroke — compare is initiated only via `<ControlBar />`.
- The textarea value is **controlled** (driven by the `value` prop).

### Visual States
| State | textarea border | Error element |
|---|---|---|
| Default | Neutral (e.g., `#ccc`) | Absent |
| Error | Red (`#d32f2f`) | Present, red text |

---

## 3. `<ControlBar />` — Action Buttons

### Responsibility
Renders the "Compare" and "Clear" action buttons. Contains no business logic.

### Props

```typescript
interface ControlBarProps {
  /** Called when the user clicks "Compare" */
  onCompare: () => void;
  /** Called when the user clicks "Clear" */
  onClear: () => void;
  /** When true, the Compare button is disabled (e.g., during computation) */
  isComparing?: boolean;
}
```

### Behaviour Contract
- "Compare" button:
  - `type="button"`, calls `onCompare()` on click.
  - `disabled` when `isComparing === true`.
  - `aria-label="Compare JSON inputs"`.
- "Clear" button:
  - `type="button"`, calls `onClear()` on click.
  - Always enabled (never disabled).
  - `aria-label="Clear all inputs and results"`.
- Neither button has any internal state.

---

## 4. `<DiffViewer />` — Side-by-Side Diff Display

### Responsibility
Renders the computed diff as two parallel columns (left = original, right = modified) with line-by-line colour coding and text markers.

### Props

```typescript
interface DiffViewerProps {
  /** The array of diff lines to display */
  lines: DiffLine[];
}
```

### Behaviour Contract
- Rendered only when `diffResult.status === "diff"` (parent `<App />` controls visibility).
- Wraps the entire output in a `<div role="region" aria-label="Diff output">`.
- For each `DiffLine`:
  - **`type === "added"`**: green background; right column shows `"+ "` prefix + `value`; left column is blank/empty.
  - **`type === "removed"`**: red background; left column shows `"- "` prefix + `value`; right column is blank/empty.
  - **`type === "equal"`**: neutral background; both columns show `"  "` prefix + `value`.
- Prefix characters (`+`, `-`, space) satisfy AC-8 (colour + text marker for accessibility).
- Line numbers are displayed in a gutter column when `leftLineNo` / `rightLineNo` are present.
- All text content is rendered as plain text nodes — no `dangerouslySetInnerHTML`.
- Long lines wrap (CSS `word-break: break-all`) and are not truncated.
- The component is **pure** (no internal state); re-renders only when `lines` reference changes.

### Visual Layout (conceptual)

```
┌──────────────────────────────────────────────────────────┐
│  Left (Original)             │  Right (Modified)         │
├──────────────────────────────┼───────────────────────────┤
│   1    {                     │   1    {                  │
│ - 2  -   "a": 1,             │                           │
│          ...                 │ + 2  +   "a": 99,         │
│   3    "b": 2                │   3    "b": 2             │
└──────────────────────────────────────────────────────────┘
```

---

## 5. `<NoDiffMessage />` — Identical Result Banner

### Responsibility
Displays a user-friendly message when both inputs are identical after normalisation.

### Props
None.

### Behaviour Contract
- Rendered only when `diffResult.status === "identical"`.
- Displays the text: **"No differences found — both JSON inputs are identical after formatting and key sorting."**
- Styled as a success/info banner (e.g., green or blue background).
- Has `role="status"` so screen readers announce it without interrupting the user.

---

## 6. `useDiff()` — Core Orchestration Hook

### Responsibility
Owns all diff-related state and logic. Called once at the `<App />` level.

### Signature

```typescript
interface UseDiffReturn {
  leftInput: JsonInputState;
  rightInput: JsonInputState;
  diffResult: DiffResult;
  setLeftRaw: (value: string) => void;
  setRightRaw: (value: string) => void;
  compare: () => void;
  clear: () => void;
}

function useDiff(): UseDiffReturn;
```

### Behaviour Contract

| Action | Description |
|---|---|
| `setLeftRaw(v)` | Updates `leftInput.raw`; clears `leftInput.error`; sets `diffResult` to `{ status: "idle" }` |
| `setRightRaw(v)` | Same as above for right panel |
| `compare()` | Runs the full pipeline: validate → normalise → pretty-print → diff; updates `diffResult` accordingly |
| `clear()` | Resets `leftInput`, `rightInput`, and `diffResult` to initial values |

#### `compare()` Pipeline (step-by-step)

```
1. Validate both inputs (EMPTY_INPUT check)
   → if empty, set diffResult { status: "error", leftError?, rightError? } and return

2. parseJson(leftInput.raw) + parseJson(rightInput.raw)
   → if either fails, set diffResult { status: "error", leftError?, rightError? } and return

3. sortKeysDeep(leftValue) + sortKeysDeep(rightValue)

4. prettyPrint(sortedLeft) + prettyPrint(sortedRight)
   → update leftInput.raw and rightInput.raw with formatted text

5. computeLineDiff(formattedLeft, formattedRight) → DiffLine[]

6. if all lines are type "equal" → diffResult { status: "identical" }
   else → diffResult { status: "diff", lines }
```

### State Invariants
- `leftInput.error` and `rightInput.error` are only set during a `compare()` call; `setLeftRaw` / `setRightRaw` always clear them.
- `diffResult.status` is `"idle"` on mount and after `clear()`.
- `diffResult.status` is never `"diff"` or `"identical"` while an error is active.

---

## 7. `useJsonInput()` — Per-Panel Input Hook (optional helper)

> This hook is optional. `useDiff` may manage panel state directly. It is defined here as a contract if the FE Tech Lead chooses to extract it.

### Signature

```typescript
interface UseJsonInputReturn {
  state: JsonInputState;
  setValue: (value: string) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

function useJsonInput(initial?: string): UseJsonInputReturn;
```

---

## 8. Utility Function Contracts

All utilities are pure functions with no side effects.

### 8.1 `parseJson(raw: string): ParseResult`

```typescript
function parseJson(raw: string): ParseResult;
```

| Input | Output |
|---|---|
| Valid JSON string | `{ ok: true, value: <parsed value> }` |
| Invalid JSON string | `{ ok: false, error: "Invalid JSON: <native message>" }` |
| Empty / whitespace-only | `{ ok: false, error: "Input is empty. Please paste JSON to compare." }` |

**Note:** Empty check is done **before** `JSON.parse` so the error message is distinct.

---

### 8.2 `sortKeysDeep(value: unknown): unknown`

```typescript
function sortKeysDeep(value: unknown): unknown;
```

| Input type | Behaviour |
|---|---|
| Plain object (`{…}`) | Returns a new object with keys sorted alphabetically; recurses into values |
| Array (`[…]`) | Returns a new array; recurses into each element (array order is preserved) |
| Primitive (string, number, boolean, null) | Returns the value unchanged |

- **Pure** — never mutates the input.
- **Recursive** — handles arbitrary nesting depth.
- Arrays are preserved in order (not sorted) — only object keys are sorted.

---

### 8.3 `prettyPrint(value: unknown): string`

```typescript
function prettyPrint(value: unknown): string;
```

Equivalent to `JSON.stringify(value, null, 2)`.

Returns a string with 2-space indentation. Never throws (input is always already a valid parsed value by the time this is called).

---

### 8.4 `computeLineDiff(left: string, right: string): DiffLine[]`

```typescript
function computeLineDiff(left: string, right: string): DiffLine[];
```

| Input | Output |
|---|---|
| Two formatted JSON strings | Array of `DiffLine` objects, one per logical line |

- Uses `diff.diffLines(left, right)` from the `diff` npm package under the hood.
- Maps `diff` output to `DiffLine[]`:
  - `added: true` → `type: "added"`
  - `removed: true` → `type: "removed"`
  - neither → `type: "equal"`
- Splits multi-line chunks into individual `DiffLine` entries.
- Attaches `leftLineNo` and `rightLineNo` (1-based, incremented per side).
- Returns an empty array `[]` if both strings are empty.
- Never throws — wraps internals in try/catch; re-throws as `DIFF_INTERNAL` error string for the hook to handle.

---

## 9. Contract Enforcement Rules

1. **Spec-change-first:** Any change to props, hook signatures, or utility signatures must update this document first.
2. **Type file is canonical:** `src/types/diff.ts` is the runtime-enforced source of truth; this document and the type file must stay in sync.
3. **No `any`:** All component props and utility signatures must use explicit types — `eslint` rule `@typescript-eslint/no-explicit-any: error`.
4. **No prop drilling beyond one level:** State is owned by `useDiff` at `<App />`; it is never passed through intermediate components.
5. **Pure utilities:** Utility functions in `src/utils/` have zero side effects and are independently unit-testable.
