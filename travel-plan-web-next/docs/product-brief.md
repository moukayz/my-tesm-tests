# Product Brief — Travel Plan Web

**Status:** Live, deployed product (not a greenfield proposal)
**Date:** 2026-03-25 (updated)

---

## Overview

Travel Plan Web is a personal, authenticated web app for planning and reviewing a multi-day European train journey. It combines an editable trip itinerary with real-time timetable lookup and historical delay analytics in a single tab-based interface. Self-hosted on Vercel.

---

## Users & Access Control

| User | Access |
|------|--------|
| **Authenticated traveller** | Full app — Itinerary, Train Delays, and Timetable tabs |
| **Unauthenticated visitor** | Train Delays and Timetable tabs only |

- Auth: Google OAuth via NextAuth.js v5.
- Optional `ALLOWED_EMAIL` allow-list restricts access to a single account.
- Unauthenticated write attempts return HTTP 401.

---

## Feature Set

### Itinerary *(authenticated only)*

**Cards view (entry point)**
- Authenticated users land on a cards list showing all saved itineraries.
- "+ New itinerary" creates a draft via `CreateItineraryModal` (name optional, startDate required).
- Selecting a card opens the itinerary workspace.

**Workspace**
- Trip summary banner: itinerary name, total days, date range, country/city breakdown (when resolved location data is available).
- Day table with columns: **Overnight**, **Date**, **Attractions**, **Train Schedule**, **Note**.
- Overnight location cells are merged and colour-coded for consecutive same-city days.
- "Back to all itineraries" returns to the cards view; unsaved inline edits trigger a discard confirmation.

**Stay management**
- Add first stay, add next stay, and full edit stay (city + nights + location) via `StaySheet`.
- Location autocomplete resolves coordinates and place metadata; custom-location entry also supported.
- Stay reorder via up/down controls; optimistic UI with revert on API failure.

**Note column**
- Each day row has a per-day free-form Note column.
- Click the pencil icon (hover) to open a textarea; blur or Escape to commit/discard.
- Content is rendered as Markdown. Persisted via `PATCH /api/itineraries/[id]/days/[dayIndex]/note` (itinerary-scoped) or `POST /api/note-update` (legacy route).

**Attractions column**
- Each day row has an Attractions column.
- Click "+ Add" to search by name via GeoNames; pick a result to append a colour-coded tag.
- Hover a tag to reveal image (📷) and delete (×) buttons.
- Click the map icon to open a MapLibre minimap popover (280×200 px) showing all day attraction pins connected by a line.
- Supports image upload (paste or pick) stored in Vercel Blob; thumbnail strip shown on hover for tags with images.

**Structured train schedule editor**
- Pencil icon on each Train Schedule cell opens `TrainScheduleEditorModal`.
- Supports add, drag-and-drop reorder, delete, and inline validation of train rows (`train_id`, optional `start`/`end`).
- Save persists via `POST /api/train-update`; the tab re-fetches timetable for that day on success.
- Multi-railway: TGV (French) and EST (Eurostar) trains auto-detected from the train ID prefix.
- Train tags with unresolved timetable data are shown in red.

**Export**
- Floating action button exports the itinerary as Markdown (`.md`) or PDF (`.pdf`).
- Purely client-side; uses the File System Access API with anchor-download fallback.
- PDF CJK characters rendered via lazily-loaded NotoSansSC font subset.
- Exported columns: Date, Day, Overnight, Train Schedule, Note (Weekday omitted).

### Train Timetable *(all users)*
- Autocomplete search across DB (German), SNCF (French), and Eurostar trains.
- Correct data source auto-detected from the train name — no railway selector needed.
- Displays planned stop sequence: station, arrival time, departure time.
- Tab state preserved across tab switches.

### Train Delays *(all users)*
- Two-step autocomplete: select a German long-distance train, then a station.
- Stats grid: total stops, avg, p50, p75, p90, p95, max delay (minutes). Cancelled stops excluded.
- Daily average delay line chart for the last 3 months (Recharts).
- Tab state preserved across tab switches.

---

## Out of Scope

- Multi-user collaboration or shared editing.
- Mobile native app (web only).
- Real-time live train tracking.
- Delay data for French or Eurostar trains.
- Booking, ticketing, or payments.
- Offline mode.

---

## Key Constraints

| Constraint | Detail |
|------------|--------|
| Platform | Vercel serverless — no persistent in-process state |
| Auth | Google OAuth only |
| Delay data | German long-distance trains only (ICE, IC, EC, EN, RJX, RJ, NJ, ECE); last ~3 months |
| Timetable data | Static GTFS data (not live); manual refresh required when schedules change |
| Itinerary storage | `ItineraryStore` — `FileItineraryStore` (local dev) / `UpstashItineraryStore` (production) |
| Legacy route storage | `RouteStore` — `FileRouteStore` (local dev) / `KvRouteStore` (production) |

---

## Open Questions

- Should delay data eventually cover French and Eurostar trains?
