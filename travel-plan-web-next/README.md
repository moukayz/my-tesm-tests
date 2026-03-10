# Travel Plan Web (Next.js)

A travel itinerary viewer with train delay analytics, built with Next.js 15, Tailwind CSS, and Recharts.

---

## Features

- **Itinerary tab** — full trip schedule rendered as a table with merged overnight-location cells and pastel color-coding per destination
  - **Inline editing** — double-click any activity cell to edit it in place; commit with Enter or by clicking away
  - **Drag-and-drop reordering** — drag the grip handle on any plan row to swap Morning / Afternoon / Evening activities within a day; auto-saves on drop
  - Changes persist to `data/route.json` via `POST /api/plan-update`
- **Train Timetable tab** — unified search across German (DB), French (SNCF), and Eurostar trains; type any train ID and the correct data source is queried automatically — no railway selector needed
- **Train Delays tab** — search any train and station to see delay statistics (avg, median, p75/p90/p95, max) and a daily trend chart over the last 3 months
- Autocomplete inputs for both train and station with filtered dropdowns and scroll
- Tab state is persistent — switching tabs does not reset the delay query
- Data is sourced from DuckDB parquet files via Next.js API routes (no separate server process needed)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS v3 + lucide-react |
| Charts | Recharts |
| Data (static) | `data/route.json` |
| Data (dynamic) | DuckDB querying parquet files via Node.js API routes |
| Runtime | Node.js 18+ |
| Auth | iron-session (encrypted cookie sessions) |
| Rate limiting | Upstash Redis (`@upstash/redis`) via Next.js Middleware |
| Testing | Jest 30 + React Testing Library |

---

## Project Structure

```
travel-plan-web-next/
├── middleware.ts                # Edge rate-limit check for POST /api/auth/login
├── app/
│   ├── layout.tsx               # Root layout, imports globals.css
│   ├── page.tsx                 # Entry page, renders <TravelPlan />
│   ├── login/page.tsx           # Login form
│   ├── globals.css              # Tailwind base/components/utilities
│   ├── lib/
│   │   ├── db.ts                # DuckDB singleton + query helper + convertBigInt
│   │   ├── itinerary.ts         # RouteDay/ProcessedDay types, getOvernightColor, processItinerary
│   │   ├── rateLimiter.ts       # Upstash Redis rate limiter (5 failures → 60s block, per IP)
│   │   ├── session.ts           # iron-session config + SessionData type
│   │   └── trainDelay.ts        # DelayStats/TrendPoint types, formatDay, buildStatItems
│   └── api/
│       ├── auth/login/route.ts  # POST /api/auth/login
│       ├── auth/logout/route.ts # POST /api/auth/logout
│       ├── trains/route.ts      # GET /api/trains
│       ├── stations/route.ts    # GET /api/stations?train=<name>
│       ├── delay-stats/route.ts # GET /api/delay-stats?train=<name>&station=<name>
│       ├── plan-update/route.ts # POST /api/plan-update (auth required)
│       └── train-stops/route.ts # GET /api/train-stops
├── components/
│   ├── AuthHeader.tsx           # Login/logout header with session state
│   ├── TravelPlan.tsx           # Tab switcher (keeps both tabs mounted)
│   ├── ItineraryTab.tsx         # Trip table with rowspan + color logic, inline editing, drag-and-drop
│   ├── TrainDelayTab.tsx        # Delay search UI + stats grid + chart
│   └── AutocompleteInput.tsx    # Reusable text input with filtered dropdown
├── __tests__/
│   ├── unit/
│   │   ├── itinerary.test.ts    # getOvernightColor, processItinerary
│   │   ├── db.test.ts           # convertBigInt
│   │   └── trainDelay.test.ts   # formatDay, buildStatItems
│   ├── middleware/
│   │   └── login-rate-limit.test.ts  # Edge middleware 429 behaviour
│   ├── integration/
│   │   ├── api-auth-login.test.ts    # POST /api/auth/login + rate limit recording
│   │   ├── api-auth-logout.test.ts
│   │   ├── api-auth-plan-update.test.ts
│   │   ├── api-trains.test.ts
│   │   ├── api-stations.test.ts
│   │   ├── api-delay-stats.test.ts
│   │   ├── api-plan-update.test.ts
│   │   └── api-train-stops.test.ts
│   └── components/
│       ├── AuthHeader.test.tsx
│       ├── LoginPage.test.tsx
│       ├── AutocompleteInput.test.tsx
│       ├── ItineraryTab.test.tsx
│       └── TravelPlan.test.tsx
├── data/
│   └── route.json               # Static trip itinerary data (16 days)
├── next.config.ts
├── tsconfig.json
├── jest.config.ts
├── jest.setup.ts
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Architecture

### Frontend

`TravelPlan` manages the active tab and always renders both `ItineraryTab` and `TrainDelayTab`, toggling Tailwind's `hidden` class to show/hide them. This keeps component state alive across tab switches.

`AutocompleteInput` is a controlled component that accepts an `options` string array and filters it case-insensitively against the current input value. It uses `onMouseDown` (not `onClick`) for list item selection so the event fires before the input's `onBlur`, preventing the dropdown from closing before a selection registers.

### Itinerary Plan Editing

Each plan row (Morning / Afternoon / Evening) supports two interaction modes:

- **Inline edit** — double-click a row to replace the activity text with an `<input>`. Commit with Enter or by clicking away (blur). Only one row is editable at a time. On blur, if the value changed a `POST /api/plan-update` is issued; on failure the value reverts and an error message is shown.
- **Drag-and-drop reorder** — drag the grip handle (right side of each row) to swap activity values within the same day. An optimistic update is applied immediately; on API failure the swap reverts. The time-of-day labels (icons for Morning / Afternoon / Evening) are fixed and are not draggable. Drag handles are hidden while a row is in edit mode.

`planOverrides` in `ItineraryTab` is a client-side override layer (keyed by day index) that sits on top of the static `route.json` import so both interactions compose correctly without a page reload.

### Authentication

Session-based auth using iron-session (encrypted HttpOnly cookies). `POST /api/auth/login` validates credentials against `AUTH_USERNAME` / `AUTH_PASSWORD` env vars. `POST /api/auth/logout` destroys the session. `POST /api/plan-update` requires an active session (`isLoggedIn: true`).

### Login Rate Limiting

`middleware.ts` runs at the Edge for every request to `/api/auth/login`. It reads a `login:blocked:{ip}` key from Upstash Redis — if the TTL is positive the request is rejected with 429 before reaching the Node.js lambda.

The login route records failures in Redis (`login:failures:{ip}`). After 5 consecutive failures the IP is blocked for 60 seconds (`login:blocked:{ip} EX 60`). A successful login clears both keys.

If Redis is unreachable (e.g. credentials not set in local dev) all rate-limit operations are silently skipped — the login still works, rate limiting is simply inactive.

### API Routes

All three train-data API routes (`/api/trains`, `/api/stations`, `/api/delay-stats`) follow the same pattern:

1. Parse and validate query params
2. Build a parameterised SQL string (single-quotes escaped)
3. Call `query()` from `app/lib/db.ts`, which runs the SQL against an in-memory DuckDB instance pointed at `db_railway_stats/*.parquet`
4. Return the result as JSON (BigInt values are converted to numbers before serialisation)

### Data Flow (Train Delays)

```
User types train name
  → AutocompleteInput filters train list locally
  → User selects a train
    → fetch /api/stations?train=<name>
    → station list populated
    → User selects a station
      → fetch /api/delay-stats?train=<name>&station=<name>
      → stats grid + trend chart rendered
```

---

## Prerequisites

- Node.js 18+
- The `db_railway_stats/` directory at the project root must contain the parquet files
- (Optional) Upstash Redis credentials in `.env.local` to enable login rate limiting — see comments in `.env.local`

## Environment Files

| File | Purpose | Tracked |
|---|---|---|
| `.env.local` | Local development credentials and optional Redis config | No (gitignored) |
| `.env.test` | Fixed credentials for E2E and Jest integration tests | Yes |
| `.env.test.local` | Local override of `.env.test` values | No (gitignored) |

**Local development** — copy `.env.test` as a starting point:

```bash
cp .env.test .env.local
# then edit .env.local with real credentials / Redis config
```

**Jest** (`npm test`) — Next.js automatically loads `.env.test` when `NODE_ENV=test`.

**Playwright** (`npm run test:e2e`) — `playwright.config.ts` loads `.env.test` and injects it into the webServer process, so the built Next.js server uses the same test credentials.

---

## Runbook

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). Next.js dev server handles both the frontend and API routes — no separate server process is needed (unlike the original Vite + Express setup).

### Production build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

### Tests

```bash
npm test                # run all tests
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

193 tests across 21 suites covering unit logic, API route integration, middleware, and component behaviour (including inline editing, drag-and-drop, multi-railway timetable, auth, and login rate limiting).

### Merge GTFS timetables

Use the reusable Python merge script to combine multiple operator GTFS folders into one output folder:

```bash
python3 scripts/merge_gtfs.py --base-dir . --output euro-railway-timetable
```

Defaults:

- Sources: `french-railway-timetable:fr eurostar-railway-timetable:eu german-railway-timetable:de`
- Rebuild mode: output folder is recreated on every run
- ID prefixing: enabled by default (`fr:`, `eu:`, `de:`) to avoid collisions while preserving references
- `trips.txt` enrichment: merged output includes `train_brand`; `trip_headsign` is normalized to branded labels for French (`TGV 9242`, `TER 860001`, etc.) and Eurostar (`EST 9002`)

Default-load mode (auto-discover countries):

```bash
python3 scripts/merge_gtfs.py --base-dir . --output euro-railway-timetable --default-load
```

Run with verification (recommended):

```bash
python3 scripts/merge_gtfs.py --base-dir . --output euro-railway-timetable --default-load --verify
```

`--verify` checks that merged row counts and headers match inputs, CSV rows are structurally valid, and key GTFS references are intact (`stop_times -> trips/stops`, `trips -> routes/services`). The command exits non-zero when verification fails.

`--default-load` includes all subfolders matching `*-railway-timetable` except the output folder (for example `french-railway-timetable`, `german-railway-timetable`) and derives prefixes from country names (for example `french -> fr`, `german -> de`).

Override sources (future operators), with optional explicit prefixes:

```bash
python3 scripts/merge_gtfs.py --base-dir . --output euro-railway-timetable --sources french-railway-timetable:fr eurostar-railway-timetable:eu german-railway-timetable:de italy-railway-timetable:it
```

You can also omit prefixes and let the script infer them from folder names:

```bash
python3 scripts/merge_gtfs.py --base-dir . --output euro-railway-timetable --sources french-railway-timetable german-railway-timetable italy-railway-timetable
```

---

## Itinerary Data

The trip data lives in `data/route.json` as a JSON array. Each entry has the following shape:

```json
{
  "date": "2026/9/25",
  "weekDay": "星期五",
  "dayNum": 1,
  "overnight": "巴黎",
  "plan": "...",
  "train": ["Paris → Cologne (time TBD)"]
}
```

Edit this file to update the itinerary. The overnight column cells are automatically merged (rowspan) for consecutive days in the same location, and each location gets a deterministic pastel background color.

---

## API Reference

### `GET /api/trains`

Returns the combined train list from all three sources: German DB parquet, French SNCF GTFS, and Eurostar GTFS.

**Response:** `[{ train_name: string, train_type: string, railway: 'german' | 'french' | 'eurostar' }]`

---

### `GET /api/timetable?train=<train_name>&railway=<railway>`

Returns the planned stop sequence for a given train. The `railway` param selects the data source:

- `german` (default/omitted) — queries DB parquet; returns `ride_date` of the latest observed run
- `french` — queries French SNCF GTFS (`french-railway-timetable/`); `ride_date` is always `null`
- `eurostar` — queries Eurostar GTFS (`eurostar-timetable/`); `ride_date` from the most recent calendar entry

Unknown `railway` values return `400`.

**Response:** `[{ station_name, station_num, arrival_planned_time, departure_planned_time, ride_date }]`

Times are returned as `"HH:MM:SS"` for GTFS sources or `"YYYY-MM-DD HH:MM:SS"` for German parquet; the UI formats both as `HH:MM`.

---

### `GET /api/stations?train=<train_name>`

Returns all stations for a given train, ordered by their position on the line.

**Response:** `[{ station_name: string, station_num: number }]`

---

### `POST /api/plan-update`

Persists an updated plan object for a single day to `data/route.json`.

**Body:** `{ "dayIndex": 0, "plan": { "morning": "...", "afternoon": "...", "evening": "..." } }`

**Response:** `200` with the updated day object, `400` for validation errors, `500` for file errors.

---

### `GET /api/delay-stats?train=<train_name>&station=<station_name>`

Returns delay statistics and a daily trend series for the given train/station over the last 3 months of available data. Cancelled stops are excluded.

**Response:**
```json
{
  "stats": {
    "total_stops": 120,
    "avg_delay": 3.4,
    "p50": 2.0,
    "p75": 5.0,
    "p90": 9.0,
    "p95": 12.0,
    "max_delay": 47
  },
  "trends": [
    { "day": "2025-01-01T00:00:00", "avg_delay": 1.5, "stops": 3 }
  ]
}
```
