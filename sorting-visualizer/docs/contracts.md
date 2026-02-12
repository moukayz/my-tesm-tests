# Contracts: Sorting Visualizer (Internal)

This document defines the stable internal contracts for a single, static-site sorting visualizer. It is designed to allow parallel implementation of UI, playback controller, renderer, dataset generation, and algorithms.

Non-goals:
- Network/API contracts (there is no backend in v1).
- UI layout/visual design details.

## 1) Core Types (Language-Agnostic, TypeScript-Friendly)

### 1.1 Identifiers and Shared Primitives

- `AlgorithmId` (string enum): `'bubble' | 'selection' | 'insertion' | 'merge'` (merge may be added later).
- `PatternId` (string enum): `'random' | 'nearlySorted' | 'reversed'`.
- `RunId` (string): unique per generated event list/stream.
- `EventId` (string | number): unique within a run.

### 1.2 Dataset Generation Settings

```ts
type DatasetGenerationSettings = {
  size: number; // integer, 2..maxSize
  pattern: 'random' | 'nearlySorted' | 'reversed';
  seed?: string; // if omitted, generator must create and persist one
  valueRange?: { min: number; max: number }; // inclusive; defaults defined by UI
  uniqueValues?: boolean; // default true when range allows; false otherwise
  nearlySortedFactor?: number; // 0..1, default 0.1 (fraction of indices disturbed)
};

type DatasetSnapshot = {
  values: number[]; // current mutable values
  initialValues: number[]; // immutable snapshot used for reset/replay
  generation: DatasetGenerationSettings & { seed: string };
};
```

Normative constraints:
- `size` MUST be an integer.
- `values.length` and `initialValues.length` MUST equal `size`.
- `initialValues` MUST NOT be mutated after generation.

### 1.3 Playback / App State (High Level)

```ts
type PlaybackStatus = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error';

type SpeedSettings = {
  eventsPerSecond: number; // > 0; controller may clamp
};

type HighlightKind = StepEvent['type'] | 'none';

type HighlightState = {
  indices: number[]; // deduped, in-bounds
  kind: HighlightKind;
};

type PlaybackState = {
  status: PlaybackStatus;
  algorithmId: AlgorithmId;
  speed: SpeedSettings;
  reducedMotion: boolean;

  runId?: string; // present when events belong to a generated run
  cursor: number; // index of next event to apply (0..events.length)
  events: StepEvent[]; // v1 default: precomputed list

  highlight: HighlightState;
  sorted: boolean[]; // length=size; renderer uses this for persistent styling

  error?: {
    code: 'invalid-state' | 'generation-failed' | 'contract-violation';
    message: string;
  };
};

type AppState = {
  dataset: DatasetSnapshot;
  playback: PlaybackState;
  metrics: Metrics;
};
```

Notes:
- Streaming/worker mode MAY replace `events` with a bounded buffer later; the `StepEvent` contract stays the same.

### 1.4 StepEvent Schema

All events are applied in-order. `swap` and `write` are the only events that mutate `dataset.values`.

```ts
type StepEventBase = {
  id: string | number;
  type: 'compare' | 'swap' | 'write' | 'markSorted' | 'done';
  runId?: string; // optional redundancy; if present must match playback.runId
  note?: string; // optional, for tooltips/debug only
};

type CompareEvent = StepEventBase & {
  type: 'compare';
  i: number;
  j: number;
};

type SwapEvent = StepEventBase & {
  type: 'swap';
  i: number;
  j: number;
};

type WriteEvent = StepEventBase & {
  type: 'write';
  i: number;
  value: number;
  prevValue?: number; // optional; controller may fill during apply
};

type MarkSortedEvent = StepEventBase & {
  type: 'markSorted';
  i: number;
};

type DoneEvent = StepEventBase & {
  type: 'done';
};

type StepEvent = CompareEvent | SwapEvent | WriteEvent | MarkSortedEvent | DoneEvent;
```

Contract invariants (must hold for every event applied):
- `i`/`j` indices (when present) MUST be integers in `[0, values.length - 1]` at the time of application.
- `swap.i !== swap.j` (swap with equal indices is a contract violation).
- `done` SHOULD appear exactly once as the final event in a precomputed list.

### 1.5 Metrics Schema and Semantics

Metrics are derived from events as they are applied (not from algorithm source code). Metrics MUST only change when an event is applied (manual step or automatic playback).

```ts
type Metrics = {
  comparisons: number; // count of applied compare events
  swaps: number; // count of applied swap events
  writes: number; // count of element writes into values
  arrayAccesses: number; // logical reads+writes of values, derived per event rules

  appliedEvents: number; // number of events applied so far (including done if applied)
  elapsedMs: number; // wall-clock time spent in status=running (paused time excluded)
};
```

Exact counting rules:
- `comparisons += 1` per `compare`.
- `swaps += 1` per `swap`.
- `writes += 1` per `write`.
- `writes += 2` per `swap` (a swap is defined as two element writes: `values[i]` and `values[j]`).

`arrayAccesses` counts logical array reads and writes to `dataset.values`, standardized across algorithms:
- `compare`: `+2` (read `values[i]` and read `values[j]`).
- `swap`: `+4` (read `values[i]`, read `values[j]`, write `values[i]`, write `values[j]`).
- `write`: `+2` (read `values[i]` as `prevValue`, write `values[i] = value`).
- `markSorted`: `+0`.
- `done`: `+0`.

Time semantics:
- `elapsedMs` increases only while `playback.status === 'running'`.
- `elapsedMs` MUST NOT increase while paused, idle, ready, done, or error.

## 2) Event Semantics (Normative)

Unless stated otherwise:
- Preconditions are checked at apply-time by the playback controller.
- If a precondition fails, the controller transitions to `status='error'` with `code='contract-violation'` and MUST stop automatic playback.

### 2.1 `compare`

Preconditions:
- `i` and `j` are in-bounds.
- `i !== j` (recommended; if equal, treat as contract violation).

State mutations to `values`:
- None.

Highlight behavior:
- Set `playback.highlight = { indices: [i, j], kind: 'compare' }`.
- Highlight is ephemeral: it MAY be cleared on the next applied event; it MUST be updated to reflect the latest applied event.

Metrics increments:
- `comparisons += 1`
- `arrayAccesses += 2`
- `appliedEvents += 1`

### 2.2 `swap`

Preconditions:
- `i` and `j` are in-bounds.
- `i !== j`.

State mutations to `values`:
- Swap the two elements:
  - `tmp = values[i]`
  - `values[i] = values[j]`
  - `values[j] = tmp`

Highlight behavior:
- Set `playback.highlight = { indices: [i, j], kind: 'swap' }`.

Metrics increments:
- `swaps += 1`
- `writes += 2`
- `arrayAccesses += 4`
- `appliedEvents += 1`

### 2.3 `write`

Preconditions:
- `i` is in-bounds.
- `value` is a finite number.

State mutations to `values`:
- Let `prev = values[i]` (read at apply-time).
- If `event.prevValue` is present, it MUST equal `prev` (otherwise contract violation).
- Set `values[i] = value`.

Highlight behavior:
- Set `playback.highlight = { indices: [i], kind: 'write' }`.

Metrics increments:
- `writes += 1`
- `arrayAccesses += 2`
- `appliedEvents += 1`

### 2.4 `markSorted`

Preconditions:
- `i` is in-bounds.

State mutations:
- `playback.sorted[i] = true`.
- `values` MUST NOT be mutated.

Highlight behavior:
- Set `playback.highlight = { indices: [i], kind: 'markSorted' }`.
- Renderer should apply persistent "sorted" styling whenever `sorted[i] === true`.

Metrics increments:
- `appliedEvents += 1`

### 2.5 `done`

Preconditions:
- No indices.
- In precomputed mode, `done` SHOULD be last.

State mutations:
- No `values` mutation.
- Controller transitions `status` to `'done'`.
- Controller MAY clear `highlight`.

Metrics increments:
- `appliedEvents += 1` if `done` is applied as an event.

## 3) Action Semantics (UI -> Playback Controller)

Actions are commands from UI to the controller/store. Each action is either applied or rejected (rejection transitions to error with `code='invalid-state'` and a user-facing message).

```ts
type Action =
  | { type: 'GENERATE'; settings: DatasetGenerationSettings }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STEP' }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; speed: SpeedSettings }
  | { type: 'SET_ALGO'; algorithmId: AlgorithmId };
```

Normative action behaviors:

### 3.1 `GENERATE`

Allowed from: `idle | ready | done | error`.

Effects:
- Generate `initialValues` using the Determinism Rules.
- Set `dataset.values = copy(initialValues)`.
- Set `dataset.generation = settings` with a concrete `seed`.
- Set `playback.status = 'ready'`.
- Clear `events`, set `cursor = 0`, reset `sorted[]` to all `false`, clear `highlight`.
- Reset metrics to zero.

Disallowed while: `running | paused` (reject or treat as implicit `RESET` + `GENERATE`; v1 default is reject).

### 3.2 `START`

Allowed from: `ready | done`.

Effects:
- Ensure `dataset.values` equals `initialValues` at start of a run (if status was `done`, do an implicit `RESET` to the initial snapshot).
- Generate `events` from `initialValues` and `algorithmId` (precomputed v1).
- Initialize `runId`, set `cursor = 0`, clear `sorted[]`, clear `highlight`.
- Set `playback.status = 'running'` and begin scheduled consumption per `speed` and Reduced-Motion Rules.
- Reset metrics to zero and start `elapsedMs` tracking.

### 3.3 `PAUSE`

Allowed from: `running`.

Effects:
- Stop scheduled automatic consumption immediately.
- Set `playback.status = 'paused'`.
- Do not change `cursor`.

### 3.4 `RESUME`

Allowed from: `paused`.

Effects:
- Set `playback.status = 'running'`.
- Restart scheduling using the latest `speed` and Reduced-Motion Rules.

### 3.5 `STEP`

Allowed from: `paused | ready`.

Effects:
- If `ready` and `events` are empty, controller MUST generate `events` first (same as `START` but does not enter automatic playback).
- Apply exactly one event at `events[cursor]` using Event Semantics.
- Increment `cursor` by 1.
- If the applied event is `done` OR `cursor === events.length`, set `playback.status = 'done'`.

### 3.6 `RESET`

Allowed from: any status.

Effects:
- Stop scheduled automatic consumption.
- Restore `dataset.values = copy(dataset.initialValues)`.
- Clear `events`, set `cursor = 0`, reset `sorted[]` to all `false`, clear `highlight`.
- Reset metrics to zero.
- Set `playback.status = 'ready'` if a dataset exists; otherwise `idle`.

### 3.7 `SET_SPEED`

Allowed from: any status.

Effects:
- Update `playback.speed` (controller may clamp to a safe min/max).
- If `running`, new speed MUST take effect on the next scheduling tick.

### 3.8 `SET_ALGO`

Allowed from: `idle | ready | done | error`.

Effects:
- Update `playback.algorithmId`.
- Does not mutate dataset.

Disallowed while: `running | paused` (v1 default is reject).

## 4) Determinism and Reduced-Motion Rules

### 4.1 Determinism (Seed Behavior)

Determinism definition:
- Given the same `DatasetGenerationSettings` (including the resolved `seed`) and the same `algorithmId`, the generated `initialValues` and the resulting `StepEvent[]` MUST be identical.

Seed rules:
- If `settings.seed` is omitted, the generator MUST create a seed string and persist it into `dataset.generation.seed` so the run can be reproduced.
- Seed strings are treated as opaque; implementations MUST normalize by using the exact string bytes (no locale transforms).

Pattern rules (normative intent; exact algorithm can vary but MUST be deterministic):
- `random`: values are generated by a seeded PRNG within `valueRange`.
- `reversed`: generate a deterministic multiset, then sort descending.
- `nearlySorted`: generate a deterministic multiset, sort ascending, then apply a deterministic disturbance derived from seed and `nearlySortedFactor`.

### 4.2 Reduced Motion

Reduced motion definition:
- `playback.reducedMotion` reflects `prefers-reduced-motion: reduce` (and may be overridden by an in-app setting if desired later).

Rules:
- Manual `STEP` MUST always apply exactly one event and produce a visible state change (bar height and/or highlight and/or sorted styling).
- Automatic playback MAY coalesce multiple event applications into a single visual frame when speed is high or reduced motion is enabled, but MUST:
  - Apply events in-order.
  - Update metrics as if each event were applied individually.
  - Ensure the final visual state after the frame reflects all applied events.
  - Set highlight to reflect the last event applied in the coalesced batch.
- Transition durations SHOULD be reduced (or set to 0) under reduced motion.

## 5) Compatibility Notes

### 5.1 Merge Sort (Optional Later)

Merge sort can fit the same schema by expressing its observable operations on the primary `values[]`:
- Use `compare(i, j)` when comparing candidate elements from left/right runs.
- Use `write(i, value)` when writing merged output back into the main array.
- `swap` is typically unnecessary for merge sort.

If a future UX requires visualizing auxiliary buffers, that would require an explicit contract extension (e.g., additional arrays or an `arrayId` field on events). This is intentionally out of scope for v1.

### 5.2 Step-Back (Future) Requirements

To support step-back without storing full snapshots every step, the event log must be reversible:
- `swap` is self-inverse; no extra fields required.
- `write` must have access to the overwritten value. Options:
  - Require `prevValue` on `write` events in a future version.
  - Or, during apply-time, the controller records `prevValue` into an internal applied-event log (enriching events) so undo is possible.
- `markSorted` needs undo semantics; options:
  - Track `prevWasSorted` per event.
  - Or recompute `sorted[]` by replaying from the beginning to `cursor` (acceptable for small n but slower).

Metrics on undo:
- Either (a) maintain reversible metric deltas per event, or (b) recompute metrics from scratch by replaying up to `cursor`.
