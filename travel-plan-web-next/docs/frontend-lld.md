# Frontend Low-Level Design — Travel Plan Web (Next.js)

## Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `app/page.tsx` (RSC) | Renders `TravelPlan`; passes `isLoggedIn` + `initialRouteData` |
| `/login` | `app/login/page.tsx` (Client) | Google OAuth sign-in button |
| `/auth-error` | `app/auth-error/page.tsx` (Client) | 5-second countdown then `router.push('/')` |

## Client / Server Boundary

`app/layout.tsx` and `app/page.tsx` are RSC. They call `auth()` server-side and pass serializable props into client components.

Client components:
- `AuthHeader` — reads `user` prop; calls `signOut` on logout
- `TravelPlan` — owns tab state
- `ItineraryTab`, `TrainDelayTab`, `TrainTimetableTab` — tab panels
- `AutocompleteInput` — reusable controlled input with local dropdown state
- `LoginPage`, `AuthErrorPage`

RSC to client props are limited to simple values such as `isLoggedIn: boolean` and `initialRouteData: RouteDay[]`.

## TravelPlan

- Four tabs when authenticated: **Itinerary** (`itinerary`), **Itinerary (Test)** (`itinerary-test`), **Train Delays** (`delays`), **Timetable** (`timetable`).
- `tab` defaults to `itinerary` when logged in, otherwise `delays`.
- Tab panels stay mounted and are shown/hidden with Tailwind `hidden`. This preserves loaded data, selected options, and in-progress UI state across tab switches.
- Both `ItineraryTab` instances are rendered only when `isLoggedIn && initialRouteData` are both truthy; both tab buttons hidden for unauthenticated users.
- Each `ItineraryTab` receives a distinct `tabKey` prop (`"route"` or `"route-test"`) that is forwarded to all API calls.

## ItineraryTab

Receives `initialData: RouteDay[]` and `tabKey: 'route' | 'route-test'` (required).

- On mount, fetches timetable details for DB-queryable trains and caches results in `trainSchedules`.
- Non-DB trains display raw `train_id` only.
- `days` is the mutable itinerary overlay (initialized from `initialData`). Stay edits update `days`; optimistic reverts restore the snapshot.
- `planOverrides` is the client-side write layer: `planOverrides[dayIndex] ?? days[dayIndex].plan`.
- `initialData` is never mutated in place.

### Inline Edit

- Triggered by double-click on a plan row.
- Uses a `<textarea autoFocus>`.
- Commits on blur or `Enter`; `Shift+Enter` keeps multiline editing.
- Applies optimistic update to `planOverrides`.
- On save failure, reverts and shows a per-day error.

### Drag-and-Drop Reorder

- Uses native HTML5 drag-and-drop.
- Reordering is same-day only; cross-day drops are ignored.
- Swaps the source and target plan sections, applies optimistic update, and persists via `POST /api/plan-update`.
- Rows are not draggable while a save is in flight for that day.

### Train Schedule JSON Modal / Editor

- Each train schedule cell includes a pencil button.
- Clicking opens a modal for the current day's raw `TrainRoute[]` JSON.
- Modal supports close via button, Escape, and backdrop click.
- Authenticated save flow posts to `POST /api/train-update`.
- After save, the tab re-fetches derived timetable data for that day so displayed times refresh immediately.
- Train tags with unresolved timetable data are shown in red.

## TrainDelayTab

Self-contained client state with three fetch stages:
1. Mount -> `GET /api/trains?railway=german`
2. Selected train -> `GET /api/stations?train=<name>`
3. Selected train + station -> `GET /api/delay-stats?train=<name>&station=<name>`

- Renders loading, error, empty, and success states explicitly.
- Success state shows a 7-item stats grid plus a Recharts line chart.
- Station autocomplete stays disabled until a train is selected and stations are available.

## TrainTimetableTab

Self-contained client state with two fetch stages:
1. Mount -> `GET /api/trains`
2. Selected train + detected railway -> `GET /api/timetable?train=<name>&railway=<railway>`

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
| `ItineraryTab` | timetable loading, edit mode, DnD drag visuals, save error, JSON modal open/closed, stay edit mode, stay saving, stay edit error toast |
| `StayEditControl` | hidden (last stay), read (pencil visible), editing (input form), validating (inline error), saving (confirm disabled) |
| `TrainDelayTab` | trains loading, stations loading, stats loading, error, empty, success |
| `TrainTimetableTab` | trains loading, timetable loading, error, empty, success |
| `AutocompleteInput` | open, closed, disabled |
| `AuthErrorPage` | countdown then redirect |

## Accessibility Baseline

Implemented:
- `<label htmlFor>` for train and station inputs
- `role="status"` and loading labels on spinners
- `aria-label` on icon-only controls such as login, logout, drag handle, and pencil button
- Dialog semantics on the train JSON modal
- `<html lang="zh">`

Known gaps:
- Autocomplete dropdown does not implement full combobox/listbox keyboard semantics
- Tab bar does not use `role="tab"` / `role="tabpanel"`
- Focus is not fully managed for modal open/close or inline edit exit

## State Ownership

- All frontend state is local `useState`; there is no global store.
- `days` and `planOverrides` are the two mutable overlays on top of server-provided itinerary data in `ItineraryTab`. `days` is replaced atomically by the `stay-update` server response; `planOverrides` applies inline text edits on top of `days`.
- Each `ItineraryTab` instance owns its state independently — no sharing between the `route` and `route-test` instances.
- `AutocompleteInput` owns only dropdown visibility; parents own values and selections.

## Feature-Specific LLD Addenda

| Feature | Document |
|---------|----------|
| Itinerary Export (`itinerary-export`) | [`docs/itinerary-export/LLD.md`](./itinerary-export/LLD.md) |
| Editable Itinerary Stays (`editable-itinerary-stays`) | [`docs/editable-itinerary-stays/frontend-design.md`](./editable-itinerary-stays/frontend-design.md) |

---

## Test Focus

| Tier | Tool | Scope |
|---|---|---|
| 0 | `next lint` + TypeScript | Lint and type safety |
| 1 | Jest + RTL | Utility functions and component interactions |
| 2 | Jest | API route handlers with mocked dependencies |
| 3 | Playwright | End-to-end browser flows |

Frontend coverage should stay focused on tab persistence, itinerary edit/reorder flows, autocomplete behavior, timetable and delay loading states, and train JSON modal/editor behavior.
