# High-Level Design — Travel Plan Web

## System Overview

Single-tenant Next.js 15 App Router app deployed on Vercel. No separate backend process — all API logic runs as serverless functions co-located with the UI. React Server Components handle SSR and initial data fetching; Client Components own interactive state.

**Core capabilities:** itinerary management (view/edit/reorder), train timetable lookup (DB/SNCF/Eurostar), German train delay analytics, Google OAuth with optional single-email allow-list.

---

## Architecture

```
Browser
  RootLayout (RSC) -> AuthHeader (Client)
  page.tsx (RSC) -> TravelPlan (Client)
    |- ItineraryTab      — inline edit, drag-and-drop; POST /api/plan-update
    |- TrainDelayTab     — two-step autocomplete; delay stats + Recharts chart
    `- TrainTimetableTab — single-step autocomplete; stop sequence table

Next.js API Routes (serverless)
  GET  /api/trains         — combined train list (all or filtered by railway)
  GET  /api/timetable      — planned stop sequence for a train
  GET  /api/stations       — stations for a German train
  GET  /api/delay-stats    — delay percentiles + 90-day trend
  GET  /api/train-stops    — dep/arr times between two stops
  POST /api/plan-update    — persist itinerary (auth required)
  GET|POST /api/auth/[...nextauth] — Google OAuth handler
  GET  /api/warmup         — DB readiness probe

Shared Server Libs (app/lib/)
  pgdb.ts       — pg.Pool (local) | @neondatabase/serverless (Vercel)
  routeStore.ts — FileRouteStore (local) | UpstashRouteStore (production)
  itinerary.ts  — RouteDay/ProcessedDay types, processItinerary, city aliases
  auth.ts       — NextAuth.js v5, Google provider, ALLOWED_EMAIL check
  logger.ts     — pino (JSON in prod, pretty in dev)
```

---

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router + TypeScript 5 |
| UI | React 19 + Tailwind CSS v3 + Recharts 3 |
| Auth | NextAuth.js v5 — Google OAuth |
| Relational DB | PostgreSQL (Docker local) / Neon serverless (production) |
| KV Store | Local JSON file (dev) / Upstash Redis (production) |
| Analytics DB | DuckDB local parquets / MotherDuck — optional; active app uses PostgreSQL/Neon |
| Logging | pino |
| Testing | Jest 30 + React Testing Library + Playwright |
| Deployment | Vercel (serverless) |

---

## Data Storage

**Itinerary:** Single Redis key `route` stores `RouteDay[]` JSON. Seeds from `data/route.json` on first read.

**GTFS (PostgreSQL/Neon):** `gtfs_trips`, `gtfs_stops`, `gtfs_stop_times`, `gtfs_calendar_dates`, `gtfs_routes`, `gtfs_agency`. Covers DB, SNCF, Eurostar (trip_id prefixes: `de:`, `fr:`, `eu:`).

**German delay (PostgreSQL/Neon):** `de_db_delay_events` (historical, long-distance only — ICE/IC/EC/EN/RJX/RJ/NJ/ECE), `de_db_train_latest_stops`. Data is static snapshot, not live.

---

## API Contract

All routes return `application/json`. Errors: `{ "error": "<message>" }`.

| Route | Auth | Key params | Notes |
|---|---|---|---|
| `GET /api/trains` | None | `railway` (optional filter) | Partial failure degrades gracefully |
| `GET /api/timetable` | None | `train`, `railway` | Returns `TimetableRow[]` |
| `GET /api/stations` | None | `train` | German trains only |
| `GET /api/delay-stats` | None | `train`, `station` | Last 3 months; excludes cancellations |
| `GET /api/train-stops` | None | `train`, `from`, `to` | Returns null if no match |
| `POST /api/plan-update` | Session | `{ dayIndex, plan }` | 401 if unauthenticated |
| `GET /api/warmup` | None | — | `{ ok: true }` |

**HTTP statuses:** 200 OK, 400 Bad Request (missing/invalid params), 401 Unauthorized (write without session), 500 Internal Server Error (DB/unexpected).

---

## Auth & Authorization

- Google OAuth via NextAuth.js v5; `ALLOWED_EMAIL` env var restricts to one account.
- Server-side `auth()` called in `page.tsx` (RSC) and `POST /api/plan-update`.
- Client-side `isLoggedIn` prop gates the Itinerary tab UI — enforcement is server-side.
- CSRF handled by NextAuth. Auth error page at `/auth-error` (redirects to `/login`).

---

## Deployment

- **Production:** Vercel serverless. `@neondatabase/serverless` (HTTP) for PostgreSQL; Upstash Redis via REST. No persistent in-process state.
- **Local dev (`dev:local`):** Docker PostgreSQL + local parquets + FileRouteStore.
- **Local dev (`dev:cloud`):** Neon + MotherDuck + Upstash (via `.env.local`).
- `serverExternalPackages: ['pg', 'pino', 'pino-pretty']` — not bundled by webpack.

---

## Observability

pino structured logs per request: route, key params, response time (ms), row counts, user email on writes. Levels: `info` (normal), `warn` (degraded/auth), `error` (DB failures). No distributed tracing currently.

---

## Test Strategy

| Tier | Tool | Scope |
|---|---|---|
| 0 | `next lint` + tsc | Lint, types |
| 1 | Jest + RTL | Pure functions, RouteStore, pgdb, components |
| 2 | Jest | API route handlers with mocked DB/auth/store |
| 3 | Playwright | Full browser flows; 45 E2E tests |

211 Jest tests across 21 suites. Gates: Tier 0+1 before PR merge; Tier 2 before integration; Tier 3 before release.

---

## Known Risks

| ID | Description | Severity |
|---|---|---|
| R-01 | Delay data is a static snapshot — historical only, not live | Medium / accepted |
| R-02 | GTFS data goes stale when carrier schedules change; requires manual re-run of `merge_gtfs.py` | Medium / manual |
| R-03 | MotherDuck cold-start ~80s; mitigated by `/api/warmup` in E2E; production risk accepted | Medium |
| R-04 | `pg.Pool` unsafe on Vercel — mitigated by `@neondatabase/serverless` when `VERCEL=1` | High / mitigated |
| R-05 | No mechanism to reset Redis itinerary to a new `route.json` without direct key edit | Low / open |
| R-06 | Login rate-limit tested but no deployed Edge middleware rate limiter | Medium / open |
