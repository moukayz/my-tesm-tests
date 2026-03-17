# Product Brief — Travel Plan Web

**Status:** Live, deployed product (not a greenfield proposal)  
**Date:** 2026-03-16

---

## Overview

Travel Plan Web is a personal, authenticated web app for planning and reviewing a 16-day multi-day European train journey. It combines an editable trip itinerary with real-time timetable lookup and historical delay analytics in a single tab-based interface. Self-hosted on Vercel.

---

## Users & Access Control

| User | Access |
|------|--------|
| **Authenticated traveller** | Full app — Itinerary, Timetable, and Train Delays tabs |
| **Unauthenticated visitor** | Train Delays and Timetable tabs only |

- Auth: Google OAuth via NextAuth.js v5.
- Optional `ALLOWED_EMAIL` allow-list restricts access to a single account.
- Unauthenticated write attempts return HTTP 401.

---

## Feature Set

### Itinerary *(authenticated only)*
- 16-day trip schedule table: Date, Weekday, Day #, Overnight Location, Morning / Afternoon / Evening activity rows.
- Overnight location cells are merged and colour-coded for consecutive same-city days.
- Each day can list associated trains; live departure/arrival times are fetched and shown inline.
- **Inline edit:** double-click any activity cell to edit; commit with Enter or click-away; reverts on API failure.
- **Drag-and-drop reorder:** drag grip handle to swap activity rows within a day; optimistic update reverts on API failure.
- Changes persisted via `POST /api/plan-update` -> Upstash Redis (production) / local JSON (dev).
- Activity text supports Markdown.

### Train Schedule JSON Editor *(authenticated only)*
- Pencil icon on each train row opens a modal with the raw `TrainRoute[]` JSON for that day.
- Modal supports editing and saving via `POST /api/train-update`.
- After save, the UI re-fetches timetable info for that day (`GET /api/train-stops`) and refreshes derived times.
- Train tags with no resolved timetable data are shown in **red** to flag data gaps.
- Modal dismissed via Close button, Escape, or backdrop click.

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
- Trip creation from scratch (data pre-seeded via `route.json`).
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
| Storage | Upstash Redis (prod) / local JSON (dev) for itinerary |

---

## Open Questions

- Is there a planned mechanism to update the itinerary seed data for a future trip?
- Should delay data eventually cover French and Eurostar trains?
