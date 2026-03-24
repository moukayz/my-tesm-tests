# Travel Plan Web (Next.js)

A travel itinerary viewer with train delay analytics, built with Next.js 15, Tailwind CSS, and Recharts.

---

## Features

- **Itinerary tab** — cards-first itinerary library with click-to-open workspace + in-app back navigation
  - **Cards-first entry** — authenticated users land on an itinerary cards view (`/?tab=itinerary`) that lists the server-shaped starter route card plus saved itineraries
  - **Starter route handoff** — selecting `Original seeded route` opens seeded-route detail at `/?tab=itinerary&legacyTabKey=route`
  - **Detail workspace handoff** — card selection opens the existing itinerary editor at `/?tab=itinerary&itineraryId=<id>`
  - **Desktop width parity** — itinerary detail shell now uses the same wide desktop content rail as `Itinerary (Test)`
  - **Desktop detail cleanup** — selected itinerary workspace renders a single control row with `Back to all itineraries` (left) and `Add next stay` (right) on the same line, followed by a trip summary banner (date range, total days, city breakdown, country breakdown when location data is available)
  - **Back to cards** — detail mode shows a clear in-app `Back to all itineraries` action in the workspace control row; legacy route mode keeps the back button in the detail shell
  - **New itinerary shell** — authenticated users can create a draft itinerary (`name` optional, `startDate` required) and land on `/?tab=itinerary&itineraryId=<id>`
  - **Empty workspace guidance** — newly created itineraries render an empty state with `Add first stay` before mounting the day table
  - **Stay planning sheet** — reusable add/edit dialog supports `Add first stay`, `Add next stay`, and full `Edit stay` (city + nights) from stay cells
  - **Stay location autocomplete** — `Add next stay` and `Edit stay` use a backend-exposed same-origin location search API that returns up to 5 normalized suggestions; selected places persist coordinates/place metadata while custom saves remain fully supported
  - **Inline editing** — double-click any activity cell to edit it in place; commit with Enter or by clicking away; plan rows have a fixed minimum height so the table layout stays stable during edit mode
  - **Drag-and-drop reordering** — drag the grip handle on any plan row to swap Morning / Afternoon / Evening activities within a day; auto-saves on drop
- **Structured train schedule editor** — click the pencil in Train Schedule to edit day-level train rows (`train_id`, optional `start`+`end`) with add, drag-and-drop reorder, row-end delete, inline validation, and single-save persistence
  - **Multi-railway timetable** — Train Schedule column auto-detects TGV (French) and EST (Eurostar) trains from the train ID prefix and fetches from the correct railway data source; German trains remain the default
  - **Export to files** — A floating action button (FAB, fixed at viewport mid-right) lets authenticated users download their itinerary as Markdown (`.md`) or PDF (`.pdf`). Uses the File System Access API where available (Chrome/Edge native save dialog), with a silent anchor-download fallback for Firefox/Safari. PDF generation is client-side only (jsPDF + jspdf-autotable, dynamically imported). CJK characters (Chinese/Japanese/Korean) render correctly in PDF via a lazily-loaded NotoSansSC font subset. A success toast confirms each export. Exported columns: Date, Day, Overnight, Plan, Train Schedule (Weekday omitted).
- **Editable stay duration** — quick inline nights edit remains for non-last stays; full stay city+nights edits are available from one table stay-cell trigger per stay. Optimistic quick-edit with revert-on-failure is preserved.
- **Itinerary (Test) tab** — sandboxed duplicate of the Itinerary tab backed by an independent persistence key (`route-test`). Edits here never affect the main Itinerary data. Both tabs carry full stay-editing capability.
- Legacy tab edits persist via `POST /api/plan-update` and `POST /api/stay-update` → `RouteStore` (file locally, Upstash Redis in production)
- New itinerary workspace backend is available under `/api/itineraries*` with owner-scoped itinerary listing, itinerary-scoped shell creation, detail load, stay append/edit, and day-plan save backed by `ItineraryStore`
- Server-side backend-selection logs show which persistence services are active (FileRouteStore vs Upstash Redis, local `pg` pool vs Neon serverless)
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
| PDF export | jsPDF + jspdf-autotable (dynamically imported — not on initial bundle) |
| Data (static) | `data/route.json` (seed / local fallback) |
| Data (dynamic) | DuckDB (parquet) + PostgreSQL/Neon (GTFS) via Node.js API routes |
| Route persistence | `app/lib/routeStore.ts` — `FileRouteStore` locally, `UpstashRouteStore` in production |
| Itinerary persistence | `app/lib/itinerary-store/store.ts` — `FileItineraryStore` locally, `UpstashItineraryStore` in production |
| Runtime | Node.js 18+ |
| Auth | NextAuth.js v5 (Auth.js) — Google OAuth |
| Testing | Jest 30 + React Testing Library |

---

## Project Structure

```
travel-plan-web-next/
├── auth.ts                      # NextAuth.js v5 config (Google provider + optional email allow-list)
├── app/
│   ├── layout.tsx               # Root layout, imports globals.css
│   ├── page.tsx                 # Entry page, renders <TravelPlan />
│   ├── login/page.tsx           # Google OAuth sign-in button
│   ├── auth-error/page.tsx      # Access denied error page with 5s auto-redirect
│   ├── globals.css              # Tailwind base/components/utilities
│   ├── lib/
│   │   ├── db.ts                # DuckDB singleton + query helper + convertBigInt
│   │   ├── pgdb.ts              # pgQuery: pg.Pool locally, @neondatabase/serverless on Vercel
│   │   ├── itinerary.ts         # RouteDay/ProcessedDay types, getOvernightColor, processItinerary, getRailwayFromTrainId
│   │   ├── routeStore.ts        # RouteStore interface + FileRouteStore + UpstashRouteStore + getRouteStore(tabKey)
│   │   ├── itinerary-store/
│   │   │   ├── store.ts         # ItineraryStore interface + File/Upstash implementations
│   │   │   ├── domain.ts        # Pure itinerary stay/day mutation helpers
│   │   │   ├── service.ts       # API-facing orchestration + validation/error mapping
│   │   │   └── types.ts         # Itinerary record/workspace contracts
│   │   ├── itineraryCards.ts    # Server-side starter-route card metadata composition for itinerary cards
│   │   ├── stayUtils.ts         # Pure stay utilities: getStays, getStaysWithMeta, validateStayEdit, applyStayEdit, applyStayEditOptimistic
│   │   ├── trainScheduleDraft.ts # Train editor draft parse/validate/serialize/reorder helpers
│   │   └── trainDelay.ts        # DelayStats/TrendPoint types, formatDay, buildStatItems
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # NextAuth.js catch-all handler (GET + POST)
│       ├── trains/route.ts      # GET /api/trains
│       ├── trains/cache.ts      # In-memory trains cache helpers (including test reset hook)
│       ├── stations/route.ts    # GET /api/stations?train=<name>
│       ├── delay-stats/route.ts # GET /api/delay-stats?train=<name>&station=<name>
│       ├── plan-update/route.ts # POST /api/plan-update (auth required; tabKey param)
│       ├── stay-update/route.ts # POST /api/stay-update (auth required; editable stays)
│       ├── itineraries/route.ts # POST /api/itineraries (auth required)
│       ├── itineraries/[itineraryId]/... # GET workspace + stay/day patch routes
│       └── train-stops/route.ts # GET /api/train-stops
├── components/
│   ├── AuthHeader.tsx           # Login/logout header with session state
│   ├── TravelPlan.tsx           # Tab shell + URL query-param sync + itinerary cards/detail panel wiring
│   ├── ItineraryPanel.tsx       # Itinerary subview switcher (cards vs detail) + unsaved back guard
│   ├── ItineraryCardsView.tsx   # Desktop cards list with empty state + open/create actions
│   ├── ItineraryDetailShell.tsx # Detail header with in-app back action + workspace wrapper
│   ├── ItineraryWorkspace.tsx   # Itinerary workspace wrapper: empty state vs table + stay mutations
│   ├── CreateItineraryModal.tsx # Name/startDate shell creation modal
│   ├── ItineraryEmptyState.tsx  # Zero-day workspace card with Add first stay CTA
│   ├── StaySheet.tsx            # Reusable add/edit stay dialog (city + nights)
│   ├── ItineraryTab.tsx         # Trip table with rowspan + color logic, inline editing, drag-and-drop, export, stay editing
│   ├── StayEditControl.tsx      # Inline stay-duration edit widget (pencil → number input → confirm/cancel)
│   ├── ExportToolbar.tsx        # Legacy export toolbar (superseded by FloatingExportButton)
│   ├── FloatingExportButton.tsx # Floating action button (viewport-fixed, portal to body) for export
│   ├── ExportSuccessToast.tsx   # Auto-dismissing success toast after file export
│   ├── ExportFormatPicker.tsx   # Format picker popover: Markdown / PDF (presentational)
│   ├── TrainDelayTab.tsx        # Delay search UI + stats grid + chart
│   └── AutocompleteInput.tsx    # Reusable text input with filtered dropdown
├── __tests__/
│   ├── unit/
│   │   ├── itinerary.test.ts      # getOvernightColor, processItinerary, getRailwayFromTrainId
│   │   ├── itineraryExport.test.ts # buildPlanCell, buildTrainCell, stripMarkdown, buildMarkdownTable, toExportRows
│   │   ├── fileSave.test.ts        # saveFile — File System Access API + anchor fallback paths
│   │   ├── db.test.ts              # convertBigInt
│   │   ├── trainDelay.test.ts      # formatDay, buildStatItems
│   │   ├── routeStore.test.ts      # FileRouteStore + UpstashRouteStore
│   │   ├── routeStore.tabKey.test.ts  # tabKey dual-key isolation, updateDays, auto-seed
│   │   ├── stayUtils.test.ts       # getStays, validateStayEdit, applyStayEdit, StayEditError
│   │   └── pgdb.test.ts            # pgQuery local (pg.Pool) + Vercel (neon) paths
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
│   │   ├── api-plan-update-tabkey.test.ts  # tabKey extension tests (backward compat + route-test)
│   │   ├── api-stay-update.test.ts         # POST /api/stay-update — all error paths + both tabKeys
│   │   └── api-train-stops.test.ts
│   └── components/
│       ├── AuthHeader.test.tsx          # user prop + signOut mock
│       ├── AuthErrorPage.test.tsx       # Access denied page + countdown redirect
│       ├── LoginPage.test.tsx           # Google sign-in button
│       ├── AutocompleteInput.test.tsx
│       ├── ItineraryTab.test.tsx        # includes export integration tests + stay edit tests
│       ├── StayEditControl.test.tsx     # render, validation, confirm/cancel, isSaving, a11y, data-testid
│       ├── ExportToolbar.test.tsx       # button states, disabled tooltip, aria attrs
│       ├── ExportFormatPicker.test.tsx  # format buttons, Escape/outside-click dismiss, spinner, error
│       ├── TravelPlan.test.tsx          # tab/query sync + cards/detail URL transitions + create modal
│       ├── ItineraryPanel.test.tsx      # cards/detail branching + back guard dialog behavior
│       ├── CreateItineraryModal.test.tsx
│       └── ItineraryWorkspace.test.tsx
├── data/
│   └── route.json               # Static trip itinerary data (16 days)
├── next.config.ts
├── tsconfig.json
├── jest.config.ts
├── jest.setup.ts
├── tailwind.config.js
├── postcss.config.js
├── scripts/
│   ├── init-db.sql              # PostgreSQL schema for GTFS tables
│   ├── load-data.sh             # Load GTFS CSV data into PostgreSQL
│   └── build-german-slim-parquets.sh # Build two slim German parquet datasets for app queries
└── package.json
```

---

## Architecture

### Frontend

`TravelPlan` manages top-level tabs and synchronizes `tab`/`itineraryId` with URL search params. The authenticated itinerary flow now enters through `ItineraryPanel`: cards view when `itineraryId` is absent, and detail shell + `ItineraryWorkspace` when present. `ItineraryTab` still powers day-level editing and quick inline nights edits; itinerary-scoped writes use `/api/itineraries/:id/...` while the sandbox `Itinerary (Test)` tab continues using legacy `tabKey` APIs. The home route (`app/page.tsx`) stays `force-dynamic` to always re-read current itinerary summaries and workspace state.

### Editable Stays

`ItineraryTab` owns a `days: RouteDay[]` state (initialized from `initialData`). Overnight cells for non-last stays render a `StayEditControl` component — a pencil icon that opens an inline number input. On confirm:

1. A snapshot of `days` is taken.
2. An optimistic update is applied via `applyStayEditOptimistic` (from `app/lib/stayUtils.ts`).
3. `POST /api/stay-update` is called with `{ tabKey, stayIndex, newNights }`.
4. On success, `days` is replaced with the server-authoritative `updatedDays` response.
5. On failure, `days` is restored from the snapshot and an error toast is shown.

`StayEditControl` performs client-side pre-flight validation (min 1 night; next stay not exhausted) before calling `onConfirm`. The server performs the same checks authoritatively.

`AutocompleteInput` is a controlled component that accepts an `options` string array and filters it case-insensitively against the current input value. It uses `onMouseDown` (not `onClick`) for list item selection so the event fires before the input's `onBlur`, preventing the dropdown from closing before a selection registers.

### Itinerary Plan Editing

Each plan row (Morning / Afternoon / Evening) supports two interaction modes:

- **Inline edit** — double-click a row to replace the activity text with an `<input>`. Commit with Enter or by clicking away (blur). Only one row is editable at a time. On blur, if the value changed a `POST /api/plan-update` is issued; on failure the value reverts and an error message is shown.
- **Drag-and-drop reorder** — drag the grip handle (right side of each row) to swap activity values within the same day. An optimistic update is applied immediately; on API failure the swap reverts. The time-of-day labels (icons for Morning / Afternoon / Evening) are fixed and are not draggable. Drag handles are hidden while a row is in edit mode.

`planOverrides` in `ItineraryTab` is a client-side override layer (keyed by day index) that sits on top of the static `route.json` import so both interactions compose correctly without a page reload.

### Itinerary Train Schedule Editing

Clicking the pencil button in a day's Train Schedule cell opens a structured dialog instead of a raw JSON textarea.

- Each row edits one train entry with `train_id` (required) and optional `start`/`end` as a pair.
- Users can add rows, remove rows via a row-end Delete button, and reorder rows with drag-and-drop.
- Validation blocks save for blank `train_id` or half-filled station pairs.
- Save sends `POST /api/train-update` with `trainJson` (stringified array) and updates `trainOverrides[dayIndex]` from `updatedDay.train`.
- Legacy malformed entries (unsupported keys/shapes) open in a recoverable, non-destructive error state with close-only behavior.

### Authentication

Google OAuth via NextAuth.js v5 (Auth.js). `auth.ts` configures the Google provider and an optional `ALLOWED_EMAIL` allow-list. The NextAuth catch-all handler at `GET|POST /api/auth/[...nextauth]` manages the OAuth callback, session cookies, and CSRF tokens automatically.

`POST /api/plan-update` and `POST /api/stay-update` both call `auth()` server-side and return 401 if no authenticated user is found.

The login page (`/login`) renders a single "Sign in with Google" button that calls `signIn('google', { callbackUrl: '/' })` from `next-auth/react`.

Sign-out calls `signOut({ callbackUrl: '/' })` from `next-auth/react`, which clears the session cookie and redirects to the home page.

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
- Docker (for PostgreSQL)
- The `db_railway_stats_slim/` directory at the project root must contain the slim parquet files (or `db_railway_stats/` + script to build slims)
- The `euro-railway-timetable/` directory at the project root must contain the merged GTFS CSV files
- Google OAuth credentials in `.env.local` (see Environment Files section)

## Environment Files

| File | Purpose | Tracked |
|---|---|---|
| `.env.local` | Local development credentials | No (gitignored) |
| `.env.test` | Fixed credentials for E2E and Jest integration tests | Yes |
| `.env.test.local` | Local override of `.env.test` values | No (gitignored) |

**Local development** — create `.env.local` with your Google OAuth credentials:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
AUTH_SECRET=random_32plus_char_string
ALLOWED_EMAIL=your.email@gmail.com   # optional: restrict to one account
LOCATION_SEARCH_PROVIDER=geonames
GEONAMES_USERNAME=your_geonames_username
# GEONAMES_BASE_URL=https://api.geonames.org   # optional override
# LOCATION_SEARCH_TIMEOUT_MS=1200
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/railway
# KV_REST_API_URL / KV_REST_API_TOKEN — omit to use local file storage (FileRouteStore)
```

German analytics APIs read `db_railway_stats_slim/*.parquet` locally via DuckDB.

**Vercel production** — add an Upstash Redis integration to your project, then set:

```bash
KV_REST_API_URL=...   # set automatically by Upstash Redis integration
KV_REST_API_TOKEN=... # set automatically by Upstash Redis integration
DATABASE_URL=postgresql://user:pass@ep-xxx.pooler.neon.tech/neondb  # Neon pooled connection string
```

`data/route.json` (or the file at `ROUTE_DATA_PATH`) is used as the seed value on the first request if Redis is empty. The Redis key defaults to `"route"` but can be overridden with `ROUTE_REDIS_KEY` (e.g. `route:e2e` for E2E test isolation).

**Neon PostgreSQL (Vercel)** — On Vercel, `pgdb.ts` automatically uses `@neondatabase/serverless` (HTTP-based, ideal for serverless) instead of `pg.Pool`. The switch is driven by the `VERCEL=1` environment variable that Vercel sets automatically.

Setup steps:
1. Create a project at [neon.tech](https://neon.tech)
2. Run `scripts/init-db.sql` against the Neon database once (copy the connection string from the Neon dashboard)
3. Load GTFS data by adapting `scripts/load-data.sh` to target the Neon connection string
4. In Vercel project settings → Environment Variables, set `DATABASE_URL` to the **pooled** connection string (e.g. `postgresql://user:pass@ep-xxx.pooler.neon.tech/neondb` — use the pgbouncer pooler endpoint, not the direct endpoint)

See **Google Cloud Platform Setup** in the plan for how to obtain these credentials (OAuth consent screen → Credentials → Web application, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI).

**Jest** (`npm test`) — Next.js automatically loads `.env.test` when `NODE_ENV=test`.

**Playwright** (`npm run test:e2e`) — `playwright.config.ts` loads `.env.test` and injects it into the webServer process, so the built Next.js server uses the same test credentials.

---

## Runbook

### Install dependencies

```bash
npm install
```

### PostgreSQL setup (GTFS data)

```bash
# Start PostgreSQL via Docker
docker compose up -d

# Check if data is already loaded (expect ~150k rows; error means not yet loaded)
docker exec travel-plan-web-next-postgres-1 psql -U postgres railway -c "SELECT COUNT(*) FROM gtfs_trips;"

# Load schema + CSVs only if not already loaded (loading twice duplicates rows)
npm run db:load
```

### German railway parquet -> two slim parquet files (optional)

If you only need (1) delay queries by train+station and (2) latest stops by train, build two slim parquet outputs:

```bash
bash scripts/build-german-slim-parquets.sh
```

Optional paths via CLI args:

```bash
bash scripts/build-german-slim-parquets.sh --input-dir ./db_railway_stats --output-dir ./db_railway_stats_slim
```

Default output folder: `db_railway_stats_slim/`

- `delay_events_slim.parquet`
- `train_latest_stops.parquet`

### German railway parquet -> PostgreSQL long-distance tables (optional)

`scripts/load-german-railway.sh` now loads only long-distance trains into these tables:

- `de_db_delay_events`
- `de_db_train_latest_stops`
- `de_db_load_state`

Allowed train prefixes: `ICE`, `IC`, `EC`, `EN`, `RJX`, `RJ`, `NJ`, `ECE`.

Schema note: these `de_db_*` tables keep primary-key indexes only.

```bash
bash scripts/load-german-railway.sh full   # one-time full rebuild
bash scripts/load-german-railway.sh        # incremental by source parquet filename
```

### Development

Two modes — pick one based on your data sources:

| Command | German data | PostgreSQL |
|---|---|---|
| `npm run dev:local` | Local parquets (`db_railway_stats_slim/`) | Docker (`localhost:5432`) |
| `npm run dev:cloud` | Local parquets (`db_railway_stats_slim/`) | Neon (requires Neon `DATABASE_URL` in `.env.local`) |

```bash
# Local mode — requires Docker running with GTFS data loaded
docker compose up -d
npm run db:load   # only needed once
npm run dev:local

# Cloud mode — requires Neon DATABASE_URL in .env.local
npm run dev:cloud
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
npm test                  # run all Jest tests (silent: dots + failures only)
npm run test:watch        # watch mode
npm run test:verbose      # full output (test names + results)
npm run test:coverage     # with coverage report
```

E2E tests support the same two data-source modes as the dev server:

| Command | German data | PostgreSQL |
|---|---|---|
| `npm run test:e2e:local` | Local parquets (`db_railway_stats_slim/`) | Docker (`localhost:5432`) |
| `npm run test:e2e` | Local parquets (`db_railway_stats_slim/`) | Neon (from `.env.local`) |

```bash
# Local mode — requires Docker running with GTFS data loaded
docker compose up -d
npm run test:e2e:local

# Cloud mode — requires Neon DATABASE_URL in .env.local
npm run test:e2e
```

Other E2E commands (both modes):

```bash
npm run test:e2e:verbose  # full per-test output
npm run test:e2e:ui       # interactive Playwright UI
```

Jest and Playwright suites cover unit logic, API route integration, component behavior, and Google OAuth auth (including session injection for authenticated flows). Backend API suites prioritize one high-signal test path per validation/error class while preserving critical domain and persistence checks.

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

Trip data is managed exclusively through `app/lib/routeStore.ts`. All reads and writes go through `getRouteStore()` — never access `data/route.json` directly from application code.

`data/route.json` serves two purposes only:
1. **Local dev** — `FileRouteStore` reads and writes it directly (no setup needed)
2. **Redis seed** — `UpstashRouteStore` uses it to populate Upstash Redis on the first request if Redis is empty

Each entry has the following shape:

```json
{
  "date": "2026/9/25",
  "weekDay": "星期五",
  "dayNum": 1,
  "overnight": "巴黎",
  "plan": { "morning": "...", "afternoon": "...", "evening": "..." },
  "train": [{ "train_id": "ICE 123", "start": "paris", "end": "cologne" }]
}
```

To update data **locally**: edit `data/route.json` directly (FileRouteStore picks it up immediately).
To update data **in production**: use the in-app edit UI, or update the `route` key directly in the Upstash Redis dashboard.

The overnight column cells are automatically merged (rowspan) for consecutive days in the same location, and each location gets a deterministic pastel background color.

---

## API Reference

### `GET /api/locations/search?query=<text>&limit=5`

Returns up to 5 backend-normalized resolved place candidates for itinerary stay entry. The frontend still composes the custom raw-text option locally.

**Response:** `200 { query, results, degraded? }`

---

### `GET /api/itineraries`

Returns all itineraries owned by the signed-in user as summary cards, ordered by `updatedAt` descending.

**Response:** `{ "items": ItinerarySummary[] }`

---

### `POST /api/itineraries`

Creates an itinerary shell for the signed-in user.

**Body:** `{ "name"?: string, "startDate": "YYYY-MM-DD" }`

**Response:** `201 { itinerary, workspaceUrl }`

---

### `GET /api/itineraries/{itineraryId}`

Returns itinerary metadata, derived `stays`, and itinerary-scoped `days` for the owner.

---

### `POST /api/itineraries/{itineraryId}/stays`

Appends a new stay to the end of the itinerary and regenerates derived day fields.

**Body:** `{ "location": StayLocationInput, "nights": number }` with legacy `city` accepted as a transitional custom-location alias.

---

### `PATCH /api/itineraries/{itineraryId}/stays/{stayIndex}`

Edits the targeted stay city and/or nights with MVP rules (borrow/donate for non-last, guarded shrink for last).

**Body:** `{ "location"?: StayLocationInput, "nights"?: number }` with legacy `city` accepted during the transition window.

---

### `PATCH /api/itineraries/{itineraryId}/days/{dayIndex}/plan`

Updates one day plan object and returns the updated `RouteDay`.

**Body:** `{ "plan": { "morning": string, "afternoon": string, "evening": string } }`

### `GET /api/trains`

Returns the combined train list from all three sources: German DB slim parquet (`train_latest_stops.parquet`), French SNCF GTFS, and Eurostar GTFS. The German `train_type` is derived from the train name via `split_part(train_name, ' ', 1)`.

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

Returns all stations for a given train, ordered by their position on the line. Queries the slim German parquet (`train_latest_stops.parquet`) via local DuckDB.

**Response:** `[{ station_name: string, station_num: number }]`

---

### `POST /api/plan-update`

Persists an updated plan object for a single day via `RouteStore` (file locally, Upstash Redis in production).

**Body:** `{ "tabKey"?: "route" | "route-test", "dayIndex": 0, "plan": { "morning": "...", "afternoon": "...", "evening": "..." } }`

`tabKey` is optional and defaults to `"route"` for backward compatibility. Invalid `tabKey` values return `400 { error: "invalid_tab_key" }`.

**Response:** `200` with the updated day object, `400` for validation errors, `500` for store errors.

---

### `POST /api/stay-update`

Adjusts the stay boundary between two adjacent city blocks. The `stayIndex` stay gains or loses `newNights − currentNights` days; the following stay absorbs/donates the difference. Day conservation is enforced server-side.

**Auth:** Session required (`401` if unauthenticated).

**Body:** `{ "tabKey": "route" | "route-test", "stayIndex": 0, "newNights": 2 }`

- `tabKey` — required; must be `"route"` or `"route-test"`
- `stayIndex` — stay index (0-based, from `getStays(days)`); must not be the last stay
- `newNights` — target nights for the stay; integer ≥ 1; must not reduce the next stay below 1 night

**Success response `200`:** `{ "updatedDays": RouteDay[] }` — full updated array; replace local state atomically.

**Error responses:**

| Status | `error` | Condition |
|--------|---------|-----------|
| 400 | `"invalid_tab_key"` | `tabKey` not in allowed set |
| 400 | `"invalid_stay_index"` | not integer, `< 0`, or is last stay |
| 400 | `"invalid_new_nights"` | `< 1` or not integer |
| 400 | `"next_stay_exhausted"` | next stay would fall below 1 night |
| 400 | `"day_conservation_violated"` | postcondition failed (defence-in-depth) |
| 401 | `"Unauthorized"` | no session |
| 500 | `"internal_error"` | store read/write failure |

---

### `GET /api/delay-stats?train=<train_name>&station=<station_name>`

Returns delay statistics and a daily trend series for the given train/station over the last 3 months of available data. Cancelled stops are excluded. Queries the slim German parquet (`delay_events_slim.parquet`) via local DuckDB.

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

---

### `GET /api/train-stops?train=<train_name>&from=<station>&to=<station>`

Returns the departure/arrival times for the given train between two stations. Queries the slim German parquet (`train_latest_stops.parquet`) via local DuckDB.

**Response:**
```json
{
  "fromStation": "Berlin Hbf",
  "depTime": "09:15",
  "toStation": "Cologne Hbf",
  "arrTime": "14:30"
}
```
