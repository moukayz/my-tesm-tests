# Backend Low-Level Design — Travel Plan Web (Next.js)

Backend lives entirely inside Next.js API routes under `app/api/`, shared modules under `app/lib/`, and `auth.ts` at the project root. There is no separate backend service; all routes run as Vercel serverless functions.

---

## Module Map

```
app/
|- api/
|  |- auth/[...nextauth]/route.ts   # NextAuth catch-all (GET + POST)
|  |- trains/route.ts               # GET  — combined train list
|  |- timetable/route.ts            # GET  — stop sequence for one train
|  |- stations/route.ts             # GET  — stations for a German train
|  |- delay-stats/route.ts          # GET  — delay percentiles + daily trend
|  |- train-stops/route.ts          # GET  — dep/arr times between two cities
|  |- train-update/route.ts         # POST — persist edited structured train rows (auth-gated)
|  |- note-update/route.ts          # POST — legacy note persist for route tab (auth-gated)
|  |- stay-update/route.ts          # POST — legacy stay-boundary edit (auth-gated)
|  |- attraction-update/route.ts    # POST — legacy attraction persist for route tab (auth-gated)
|  |- upload-image/route.ts         # POST — Vercel Blob client upload token (auth-gated)
|  |- locations/
|  |  `- search/route.ts            # GET  — provider-neutral place search (auth-gated)
|  |- itineraries/
|  |  |- route.ts                   # GET list / POST create
|  |  |- seed/route.ts              # POST — seed a new itinerary from the legacy route store
|  |  `- [itineraryId]/
|  |     |- route.ts                # GET workspace
|  |     |- stays/
|  |     |  |- route.ts             # POST append stay
|  |     |  `- [stayIndex]/
|  |     |     |- route.ts          # PATCH update stay
|  |     |     `- move/route.ts     # POST reorder stay (up/down)
|  |     `- days/[dayIndex]/
|  |        |- plan/route.ts        # PATCH update day plan sections
|  |        |- note/route.ts        # PATCH update day note
|  |        `- attractions/route.ts # PATCH update day attractions
|  `- warmup/route.ts               # GET  — DB readiness probe
`- lib/
   |- pgdb.ts              # pgQuery abstraction (pg.Pool locally / Neon on Vercel)
   |- routeStore.ts        # RouteStore interface + File/Upstash implementations (route tab only)
   |- stayUtils.ts         # Pure stay-boundary domain logic (getStays, validateStayEdit, applyStayEdit)
   |- itinerary.ts         # RouteDay/DayAttraction types, color helpers, normalizeTrainId
   |- itinerary-store/
   |  |- service.ts        # Request validation, ownership checks, error mapping, workspace shaping
   |  |- domain.ts         # Pure stay/date regeneration helpers (applyAppendStay, applyMoveStay, etc.)
   |  |- store.ts          # ItineraryStore interface + File/Upstash implementations
   |  `- types.ts          # ItineraryRecord, ItineraryWorkspace, ItinerarySummary contracts
   |- stayLocation.ts      # normalizeStayLocation — coerce location to StayLocation
   |- attractionValidator.ts # parseAttractions — validates DayAttraction[]
   |- imageStore.ts        # ImageStore interface + VercelBlobImageStore implementation
   |- location-search/     # LocationSearchService + provider adapters (GeoNames)
   |- trainDelay.ts        # DelayStats types + display helpers
   |- trainTimetable.ts    # TimetableRow type + formatTime
   `- logger.ts            # pino instance

auth.ts                    # NextAuth.js v5 config (Google OAuth, ALLOWED_EMAIL guard)
```

---

## Data Access

### `pgdb.ts`

- Single entry point: `pgQuery<T>(sql, params?): Promise<T[]>`
- Uses `pg.Pool` locally
- Uses `@neondatabase/serverless` when `VERCEL` is set
- Logs backend selection once per process lifetime

### `routeStore.ts`

```typescript
type TabKey = 'route'

interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
  updateNote(dayIndex: number, note: string): Promise<RouteDay>
  updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay>
  updateAttractions(dayIndex: number, attractions: DayAttraction[]): Promise<RouteDay>
  updateDays(days: RouteDay[]): Promise<RouteDay[]>  // atomic full-array write
}
```

`getRouteStore(): RouteStore` — factory; returns `KvRouteStore` if `KV_REST_API_URL` is set, else `FileRouteStore`.

| Condition | Implementation | Storage key |
|---|---|---|
| Upstash env set | `KvRouteStore` | `ROUTE_REDIS_KEY` or `"route"` |
| No Upstash env | `FileRouteStore` | `ROUTE_DATA_PATH` or `data/route.json` |

- Upstash auto-seeds from the bundled JSON on first read if Redis is empty.
- Update flow is read-mutate-write; there is no distributed lock.

---

## API Routes

All routes follow the same pattern: validate input, run DB/store work, return JSON. Standard error envelope: `{ "error": "<code>" }`.

| Route | Auth | Key behavior |
|---|---|---|
| `GET /api/trains` | None | Combines German, French, and Eurostar sources; degrades gracefully on partial failure |
| `GET /api/timetable` | None | Returns stop sequence; railway decides German, French, or Eurostar query path |
| `GET /api/stations` | None | German only; returns stations for one train |
| `GET /api/delay-stats` | None | German only; stats + daily trend for the last 3 months of available data |
| `GET /api/train-stops` | None | Resolves dep/arr between two city names using city aliases; returns `null` if no match |
| `GET /api/locations/search` | Session | Queries location provider (GeoNames); returns up to 5 normalized place candidates |
| `GET /api/itineraries` | Session | Lists owned itinerary summaries ordered by `updatedAt desc` |
| `POST /api/itineraries` | Session | Creates a new itinerary shell; `name` optional, `startDate` required |
| `POST /api/itineraries/seed` | Session | Copies the legacy route store into a new owned itinerary |
| `GET /api/itineraries/[id]` | Session | Returns owned itinerary workspace (itinerary + derived stays + days) |
| `POST /api/itineraries/[id]/stays` | Session | Appends a new stay at the end |
| `PATCH /api/itineraries/[id]/stays/[idx]` | Session | Updates stay city, nights, and/or location |
| `POST /api/itineraries/[id]/stays/[idx]/move` | Session | Reorders a stay up or down; regenerates day dates |
| `PATCH /api/itineraries/[id]/days/[idx]/plan` | Session | Updates one day's morning/afternoon/evening plan sections |
| `PATCH /api/itineraries/[id]/days/[idx]/note` | Session | Updates one day's free-form note |
| `PATCH /api/itineraries/[id]/days/[idx]/attractions` | Session | Replaces one day's attractions list |
| `POST /api/train-update` | Session | Persists structured train rows for a day (legacy route tab) |
| `POST /api/note-update` | Session | Legacy note persist for the route tab |
| `POST /api/stay-update` | Session | Legacy stay-boundary mutation for the route tab |
| `POST /api/attraction-update` | Session | Legacy attraction persist for the route tab |
| `POST /api/upload-image` | Session | Issues a Vercel Blob client upload token |
| `GET\|POST /api/auth/[...nextauth]` | None | Delegates entirely to NextAuth |
| `GET /api/warmup` | None | Lightweight DB readiness probe |

### Route-specific rules

- `/api/trains` may return partial results instead of failing the whole request.
- `/api/timetable` rejects unknown `railway` values with 400.
- `/api/delay-stats` excludes canceled stops.
- `/api/train-stops` uses `CITY_ALIASES`; `from` resolves to the first match, `to` to the last match.
- All `/api/itineraries*` write routes authorize by `ownerEmail === session.user.email`; missing record → 404, wrong owner → 403, validation → 400, stale workspace → 409.
- `/api/stay-update` requires `tabKey='route'`; validates it before any I/O. Returns 400 with typed error codes.

### `stayUtils.ts` domain rules (enforced by `/api/stay-update`)

- `newNights ≥ 1` (integer)
- `stayIndex` must not be the last stay (no following stay to absorb days)
- next stay nights after transfer must remain `≥ 1`
- day-conservation postcondition: `sum(updatedDays) === sum(originalDays)` (defence-in-depth)

---

## Auth Rules

- Auth uses NextAuth.js v5 with Google OAuth.
- `ALLOWED_EMAIL` optionally restricts access to one account.
- Write endpoints use server-side `auth()` and return 401 when no session is present.
- Client-side auth state only affects UI visibility; backend enforcement is authoritative.

```typescript
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Data Model

### `RouteDay` (shared type — itinerary days and legacy route tab)

```typescript
interface RouteDay {
  date: string
  weekDay: string
  dayNum: number
  overnight: string
  location?: StayLocation        // resolved place or custom label
  plan: { morning: string; afternoon: string; evening: string }
  note?: string                  // free-form per-day note (Markdown)
  train: Array<{ train_id: string; start?: string; end?: string }>
  attractions?: DayAttraction[]  // per-day attractions list
}

interface DayAttraction {
  id: string
  label: string
  coordinates?: { lat: number; lng: number }
  images?: string[]              // Vercel Blob URLs
}
```

`StayLocation` is either `{ kind: 'custom'; label: string; queryText: string }` or a resolved place with coordinates and place metadata.

### `ItineraryRecord` (itinerary-scoped store)

`id`, `ownerEmail`, `name`, `startDate`, `status`, `createdAt`, `updatedAt`, `days: RouteDay[]`.

Stays are derived from contiguous `RouteDay.overnight` blocks; there is no separate stay table.

### Timetable and Delay Data

- GTFS tables in PostgreSQL/Neon: `gtfs_trips`, `gtfs_stop_times`, `gtfs_stops`, `gtfs_calendar_dates` (French/Eurostar).
- German tables: `de_train_latest_stops` (planned stop times), `de_delay_events_slim` (historical delay events).
- Delay analytics support German long-distance trains only.
- Data is static and script-loaded, not live.

---

## Error Conventions

| Status | Meaning |
|---|---|
| `200` | Success |
| `200` with `null` | Valid request but no matching data (`/api/train-stops`) |
| `201` | Resource created (`POST /api/itineraries`, `POST /api/itineraries/seed`) |
| `400` | Missing or invalid params/body |
| `401` | Missing session on write endpoint |
| `403` | Ownership check failed |
| `404` | Record not found |
| `409` | Stale workspace write conflict |
| `500` | Unhandled DB or server error |

- Validation runs before DB work where possible.
- Most routes catch DB errors locally and return `500`.

---

## Config Model

Key runtime dependencies:
- `DATABASE_URL` for PostgreSQL / Neon
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for Upstash
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` for auth
- `ALLOWED_EMAIL` for optional single-user restriction
- `ROUTE_DATA_PATH` for local route store override
- `ROUTE_REDIS_KEY` — Redis key for the route tab (default `"route"`)
- `GEONAMES_USERNAME` for location search provider
- `BLOB_READ_WRITE_TOKEN` for Vercel Blob image storage
- `LOG_LEVEL` for pino

Backend selection is environment-driven; no code changes are needed to switch local file vs. Upstash or local `pg` vs. Neon serverless.

---

## Validation Strategy

| Tier | Scope |
|---|---|
| 0 | Linting and type safety for route contracts, shared types, and config-driven backend selection |
| 1 | Pure backend domain and data-access logic, including invariants, store selection, and transformation helpers |
| 2 | API handler behavior across request validation, auth enforcement, persistence failures, and success/error envelopes |
| 3 | End-to-end confirmation of browser-visible flows that depend on backend contracts and seeded runtime environments |

---

## Risks

| ID | Risk / tradeoff |
|---|---|
| T-01 | Raw parameterized SQL is explicit and safe, but verbose and harder to refactor than an ORM |
| T-02 | Delay stats queries may become expensive because `de_delay_events_slim` lacks a composite index for the main filter pattern |
| T-03 | `/api/stations` derives station order from delay events, not the canonical latest-stop table |
| T-04 | `KvRouteStore` and `UpstashItineraryStore` use read-mutate-write with no distributed lock; race risk is accepted for single-tenant use |
| T-05 | Timetable and delay datasets are historical/static, so freshness depends on manual reload scripts |
