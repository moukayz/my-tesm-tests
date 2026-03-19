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
|  |- plan-update/route.ts          # POST — persist itinerary plan (auth-gated); accepts optional tabKey
|  |- stay-update/route.ts          # POST — stay-boundary edit (auth-gated); NEW
|  |- train-update/route.ts         # POST — edit raw train JSON (auth-gated)
|  `- warmup/route.ts               # GET  — DB readiness probe
`- lib/
   |- pgdb.ts           # pgQuery abstraction (pg.Pool locally / Neon on Vercel)
   |- routeStore.ts     # RouteStore interface + File/Upstash implementations; tabKey support
   |- stayUtils.ts      # Pure stay-boundary domain logic (getStays, validateStayEdit, applyStayEdit); NEW
   |- itinerary.ts      # RouteDay types, city alias resolution, pure helpers
   |- trainDelay.ts     # DelayStats types + display helpers
   |- trainTimetable.ts # TimetableRow type + formatTime
   `- logger.ts         # pino instance

auth.ts                 # NextAuth.js v5 config (Google OAuth, ALLOWED_EMAIL guard)
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
type TabKey = 'route' | 'route-test'

interface RouteStore {
  getAll(): Promise<RouteDay[]>
  updatePlan(dayIndex: number, plan: PlanSections): Promise<RouteDay>
  updateTrain(dayIndex: number, train: TrainRoute[]): Promise<RouteDay>
  updateDays(days: RouteDay[]): Promise<RouteDay[]>  // atomic full-array write
}
```

`getRouteStore(tabKey: TabKey = 'route'): RouteStore` — factory; accepts optional `tabKey` to select the store backend.

| tabKey | Condition | Implementation | Storage key |
|---|---|---|---|
| `'route'` | Upstash env set | `UpstashRouteStore` | `ROUTE_REDIS_KEY` or `"route"` |
| `'route-test'` | Upstash env set | `UpstashRouteStore` | `ROUTE_TEST_REDIS_KEY` or `"route-test"` |
| `'route'` | No Upstash env | `FileRouteStore` | `ROUTE_DATA_PATH` or `data/route.json` |
| `'route-test'` | No Upstash env | `FileRouteStore` | `ROUTE_TEST_DATA_PATH` or `data/route-test.json` (auto-seeds from `route.json` on first read) |

- Upstash auto-seeds from the bundled JSON on first read if Redis is empty.
- `FileRouteStore` for `route-test` auto-seeds from `data/route.json` if the test file is absent.
- Update flow is read-mutate-write; there is no distributed lock.

---

## API Routes

All routes follow the same pattern: validate input, run DB/store work, return JSON. Standard error envelope: `{ "error": "<message>" }`.

| Route | Auth | Key behavior |
|---|---|---|
| `GET /api/trains` | None | `railway=german` uses German stops only; otherwise combines German, French, and Eurostar sources and degrades gracefully on partial failure |
| `GET /api/timetable` | None | Returns stop sequence for a train; railway decides German, French, or Eurostar query path |
| `GET /api/stations` | None | German only; returns stations for one train |
| `GET /api/delay-stats` | None | German only; returns stats + daily trend for the last 3 months of available data |
| `GET /api/train-stops` | None | Resolves dep/arr between two city names using city aliases; returns `null` if no match |
| `POST /api/plan-update` | Session | Validates `dayIndex` and `plan` strings; optional `tabKey` (`'route'`\|`'route-test'`, default `'route'`); persists updated itinerary plan; returns updated `RouteDay` |
| `POST /api/stay-update` | Session | Validates `tabKey` (required), `stayIndex`, `newNights`; applies stay-boundary mutation via `stayUtils`; persists full `RouteDay[]`; returns `{ updatedDays: RouteDay[] }` |
| `POST /api/train-update` | Session | Persists edited raw train JSON for a day |
| `GET\|POST /api/auth/[...nextauth]` | None | Delegates entirely to NextAuth |
| `GET /api/warmup` | None | Lightweight DB readiness probe for E2E startup |

### Route-specific rules

- `/api/trains` may return partial results instead of failing the whole request.
- `/api/timetable` rejects unknown `railway` values with 400.
- `/api/delay-stats` excludes canceled stops.
- `/api/train-stops` uses `CITY_ALIASES`; `from` resolves to the first match, `to` to the last match.
- `/api/plan-update` and `/api/train-update` check session before allowing writes.
- `/api/plan-update` accepts optional `tabKey`; omitting it defaults to `'route'` (backward-compatible).
- `/api/stay-update` requires `tabKey` (no default); validates it before any I/O. Returns 400 with typed error codes; see `stayUtils.ts` for domain invariants.

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

### Itinerary

Stored as one `RouteDay[]` JSON blob in Redis or local file.

```typescript
interface RouteDay {
  date: string
  weekDay: string
  dayNum: number
  overnight: string
  plan: { morning: string; afternoon: string; evening: string }
  train: Array<{ train_id: string; start?: string; end?: string }>
}
```

- `plan-update` validates `dayIndex` bounds and requires all three plan fields to be strings.

### Timetable and Delay Data

- GTFS tables in PostgreSQL/Neon hold DB, SNCF, and Eurostar timetable data.
- `trip_id` prefixes (`de:`, `fr:`, `eu:`) are used to split operators.
- German historical data lives in `de_db_delay_events` and `de_db_train_latest_stops`.
- Delay analytics support German long-distance trains only.
- Data is static and script-loaded, not live.

---

## Error Conventions

| Status | Meaning |
|---|---|
| `200` | Success |
| `200` with `null` | Valid request but no matching data (`/api/train-stops`) |
| `400` | Missing or invalid params/body |
| `401` | Missing session on write endpoint |
| `500` | Unhandled DB or server error |

- Validation runs before DB work where possible.
- Most routes catch DB errors locally and return `500`.
- Raw error messages may be returned because this is a private single-tenant app.

---

## Config Model

Key runtime dependencies:
- `DATABASE_URL` for PostgreSQL / Neon
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for Upstash
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` for auth
- `ALLOWED_EMAIL` for optional single-user restriction
- `ROUTE_DATA_PATH` for local itinerary override
- `ROUTE_REDIS_KEY` — Redis key for main itinerary tab (default `"route"`)
- `ROUTE_TEST_DATA_PATH` — file path for test-tab local store (default `"data/route-test.json"`)
- `ROUTE_TEST_REDIS_KEY` — Redis key for test-tab store (default `"route-test"`)
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

Backend validation should emphasize request-boundary checks, auth gates, contract/error coverage, and environment-dependent storage behavior rather than implementation-specific test structure.

---

## Risks

| ID | Risk / tradeoff |
|---|---|
| T-01 | Raw parameterized SQL is explicit and safe, but verbose and harder to refactor than an ORM |
| T-02 | Delay stats queries may become expensive because `de_db_delay_events` lacks a composite index for the main filter pattern |
| T-03 | `/api/stations` derives station order from delay events, not the canonical latest-stop table |
| T-04 | `UpstashRouteStore` uses read-mutate-write with no distributed lock; race risk is accepted for single-tenant use |
| T-05 | Raw DB error strings may leak internals; acceptable for this private app but not for a public multi-tenant system |
| T-06 | Timetable and delay datasets are historical/static, so freshness depends on manual reload scripts |
