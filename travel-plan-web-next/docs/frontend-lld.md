# Frontend Low-Level Design — Travel Plan Web (Next.js)

## Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `app/page.tsx` (RSC) | Renders `TravelPlan`; passes `isLoggedIn` + itinerary bootstrap props |
| `/login` | `app/login/page.tsx` (Client) | Google OAuth sign-in button |
| `/auth-error` | `app/auth-error/page.tsx` (Client) | 5-second countdown then `router.push('/')` |

## Client / Server Boundary

`app/layout.tsx` and `app/page.tsx` are RSC. They call `auth()` server-side and pass serializable props into client components.

RSC props passed to `TravelPlan`:
- `isLoggedIn: boolean`
- `initialItineraryWorkspace: ItineraryWorkspace | null` — server-fetched workspace for the URL's `itineraryId` param
- `initialItinerarySummaries: ItinerarySummary[]` — list summaries (only populated when `itineraryId` is present in URL)
- `initialItineraryId: string | undefined`
- `initialItineraryErrorCode: string | null`

Client components:
- `AuthHeader` — reads `user` prop; calls `signOut` on logout
- `TravelPlan` — owns tab state and itinerary selection
- `ItineraryPanel` — cards vs detail routing + unsaved-edit back guard
- `ItineraryCardsView` — cards list with empty state and open/create actions
- `ItineraryWorkspace` — workspace shell: trip summary banner, stay mutations, stay sheet wiring
- `ItineraryTab` — day-level editing table (note, train schedule, attractions, export)
- `CreateItineraryModal`, `StaySheet` — creation and stay add/edit dialogs
- `TrainScheduleEditorModal` — structured per-day train row editor
- `AttractionCell`, `AttractionMiniMap`, `AttractionImageViewer` — attraction column UI
- `TrainDelayTab`, `TrainTimetableTab` — tab panels
- `AutocompleteInput` — reusable controlled input with local dropdown state
- `LoginPage`, `AuthErrorPage`

## TravelPlan

- Three tabs when authenticated: **Itinerary** (`itinerary`), **Train Delays** (`delays`), **Timetable** (`timetable`).
- Unauthenticated users see only **Train Delays** and **Timetable**.
- `tab` defaults to `itinerary` when logged in, otherwise `delays`.
- Tab panels stay mounted and are shown/hidden with Tailwind `hidden`. This preserves loaded data and in-progress UI state across tab switches.
- Owns `selectedItineraryId` state; syncs with `?itineraryId=` URL param.
- Lazy-fetches `GET /api/itineraries` for summaries when none are server-provided.

## ItineraryPanel

- Renders `ItineraryCardsView` when no itinerary is selected; `ItineraryWorkspace` when one is selected.
- Guards "back to cards" navigation: if `ItineraryTab` reports unsaved inline edits, shows a discard confirmation dialog before allowing the back action.

## ItineraryWorkspace

Receives `selectedItineraryId`, `initialWorkspace`, and stay-mutation callbacks.

- Fetches `GET /api/itineraries/[id]` when `selectedItineraryId` changes and the workspace doesn't match.
- Derives `tripSummary` (date range, total days, country/city breakdown) from workspace stays.
- Manages stay sheet state: open/close, mode (`add-first` | `add-next` | `edit`), submit, error.
- Handles optimistic stay reorder: calls `POST /api/itineraries/[id]/stays/[index]/move`, reverts on failure.
- Stay add/edit submits to `POST /api/itineraries/[id]/stays` or `PATCH /api/itineraries/[id]/stays/[index]`.

## ItineraryTab

Receives `initialData: RouteDay[]`, `itineraryId?: string`, and optional stay-action callbacks.

- Table columns: **Overnight**, **Date**, **Attractions**, **Train Schedule**, **Note**.
- Overnight cells are merged (rowspan) and colour-coded per stay.
- Delegates functionality to custom hooks:
  - `useTrainSchedules` — fetches timetable data for all trains in the itinerary on mount; caches results.
  - `useTrainEditor` — manages structured train row editor state and `POST /api/train-update` persistence.
  - `useNoteEditor` — manages per-day note editing state; saves via `PATCH /api/itineraries/[id]/days/[dayIndex]/note` (itinerary-scoped) or `POST /api/note-update` (legacy).
  - `useStayEdit` — manages legacy inline stay-duration edit; saves via `PATCH /api/itineraries/[id]/stays/[index]` (itinerary-scoped) or `POST /api/stay-update` (legacy).
  - `useExport` — controls the floating export picker state and triggers Markdown/PDF download.
- `trainOverrides` and `noteOverrides` are client-side write overlays on top of server `days`.
- `initialData` is never mutated in place.

### Note Column Editing

- Click the pencil icon (visible on hover) to enter edit mode for a day's note.
- Uses a `<textarea>` that fills the cell; blur commits; Escape discards.
- Applies optimistic update to `noteOverrides`; reverts on save failure.

### Train Schedule Editor

- Each Train Schedule cell includes a pencil button.
- Clicking opens `TrainScheduleEditorModal` with structured rows (`train_id`, optional `start`/`end`).
- Supports add row, drag-and-drop reorder, delete, and inline validation.
- Modal closed via button, Escape, or backdrop click; focus returns to trigger button.
- Save posts to `POST /api/train-update`; re-fetches timetable for that day on success.
- Train tags with unresolved timetable data are shown in red.

### Drag-and-Drop Reorder (Train Rows)

- Native HTML5 drag-and-drop within `TrainScheduleEditorModal`.
- Reordering is within the current day's train list only.
- Rows are not draggable while a save is in flight.

## TrainDelayTab

Self-contained client state with three fetch stages:
1. Mount → `GET /api/trains?railway=german`
2. Selected train → `GET /api/stations?train=<name>`
3. Selected train + station → `GET /api/delay-stats?train=<name>&station=<name>`

- Renders loading, error, empty, and success states explicitly.
- Success state shows a 7-item stats grid plus a Recharts line chart.
- Station autocomplete stays disabled until a train is selected and stations are available.

## TrainTimetableTab

Self-contained client state with two fetch stages:
1. Mount → `GET /api/trains`
2. Selected train + detected railway → `GET /api/timetable?train=<name>&railway=<railway>`

- Railway is auto-detected from the selected train row.
- No separate operator picker exists.
- Renders loading, error, empty, and success states explicitly.

## AutocompleteInput

Parent-owned controlled input with local dropdown visibility state.

- Filters options locally with case-insensitive substring matching.
- Renders at most 50 options.
- Supports `showAllWhenEmpty` for the station picker pattern.
- Uses `onMouseDown` on options so selection happens before input blur closes the dropdown.
- `disabled` prevents interaction and keeps the dropdown closed.

Parent components keep separate `input` and `selected` state so API calls happen only after a committed selection.

## Key UI States

| Component | Important states |
|---|---|
| `ItineraryPanel` | cards view, detail view, discard confirmation dialog |
| `ItineraryWorkspace` | loading, error (not-found/forbidden), empty (no days), filled (with trip summary + table) |
| `ItineraryTab` | timetable loading, note edit mode, train editor modal open/closed, stay edit mode, stay saving, export picker open/closed |
| `TrainScheduleEditorModal` | row editing, drag-in-progress, validation errors, saving, save error |
| `StaySheet` | add-first, add-next, edit; submitting, form error |
| `StayEditControl` | hidden (last stay), read (pencil visible), editing (input form), validating (inline error), saving (confirm disabled) |
| `TrainDelayTab` | trains loading, stations loading, stats loading, error, empty, success |
| `TrainTimetableTab` | trains loading, timetable loading, error, empty, success |
| `AutocompleteInput` | open, closed, disabled |
| `AuthErrorPage` | countdown then redirect |

## Accessibility Baseline

Implemented:
- `<label htmlFor>` for train and station inputs
- `role="status"` and loading labels on spinners
- `aria-label` on icon-only controls such as login, logout, drag handle, pencil buttons
- Dialog semantics (`role="dialog"`, `aria-modal`) on modals and sheets
- `<html lang="zh">`

Known gaps:
- Autocomplete dropdown does not implement full combobox/listbox keyboard semantics
- Tab bar does not use `role="tab"` / `role="tabpanel"`
- Focus is not fully managed for all modal open/close flows

## State Ownership

- All frontend state is local `useState`; there is no global store.
- `ItineraryWorkspace` owns workspace-level state: `workspace`, loading/error flags, sheet open/mode.
- `ItineraryTab` owns day-level state via hooks: `days` (replaced atomically on server response), `trainOverrides` and `noteOverrides` (client write overlays). `initialData` is never mutated in place.
- `AutocompleteInput` owns only dropdown visibility; parents own values and selections.

## Feature-Specific LLD Addenda

| Feature | Document |
|---------|----------|
| Itinerary Export | [`docs/itinerary-export/LLD.md`](./itinerary-export/LLD.md) |
| Editable Itinerary Stays | [`docs/editable-itinerary-stays/frontend-design.md`](./editable-itinerary-stays/frontend-design.md) |
| Stay Planning & Creation | [`docs/itinerary-creation-and-stay-planning/frontend-design.md`](./itinerary-creation-and-stay-planning/frontend-design.md) |
| Train Schedule Editor | [`docs/itinerary-train-schedule-editor/frontend-design.md`](./itinerary-train-schedule-editor/frontend-design.md) |

---

## Test Focus

| Tier | Tool | Scope |
|---|---|---|
| 0 | `next lint` + TypeScript | Lint and type safety |
| 1 | Jest + RTL | Utility functions, hooks, and component interactions |
| 2 | Jest | API route handlers with mocked dependencies |
| 3 | Playwright | End-to-end browser flows |

Frontend coverage should stay focused on: itinerary cards/workspace navigation, stay add/edit flows, note editing, train schedule editor, autocomplete behavior, timetable and delay loading states, and export.
