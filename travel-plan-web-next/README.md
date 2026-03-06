# Travel Plan Web (Next.js)

A travel itinerary viewer with train delay analytics, built with Next.js 15, Tailwind CSS, and Recharts.

---

## Features

- **Itinerary tab** — full trip schedule rendered as a table with merged overnight-location cells and pastel color-coding per destination
- **Train Delays tab** — search any train and station to see delay statistics (avg, median, p75/p90/p95, max) and a daily trend chart over the last 3 months
- Autocomplete inputs for both train and station with filtered dropdowns and scroll
- Tab state is persistent — switching tabs does not reset the delay query
- Data is sourced from DuckDB parquet files via Next.js API routes (no separate server process needed)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS v3 |
| Charts | Recharts |
| Data (static) | `data/route.json` |
| Data (dynamic) | DuckDB CLI querying parquet files |
| Runtime | Node.js |

---

## Project Structure

```
travel-plan-web-next/
├── app/
│   ├── layout.js               # Root layout, imports globals.css
│   ├── page.js                 # Entry page, renders <TravelPlan />
│   ├── globals.css             # Tailwind base/components/utilities
│   └── api/
│       ├── trains/route.js     # GET /api/trains
│       ├── stations/route.js   # GET /api/stations?train=<name>
│       └── delay-stats/route.js# GET /api/delay-stats?train=<name>&station=<name>
├── components/
│   ├── TravelPlan.jsx          # Tab switcher (keeps both tabs mounted)
│   ├── ItineraryTab.jsx        # Trip table with rowspan + color logic
│   ├── TrainDelayTab.jsx       # Delay search UI + stats grid + chart
│   └── AutocompleteInput.jsx   # Reusable text input with filtered dropdown
├── data/
│   └── route.json              # Static trip itinerary data (16 days)
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Architecture

### Frontend

`TravelPlan` manages the active tab and always renders both `ItineraryTab` and `TrainDelayTab`, toggling Tailwind's `hidden` class to show/hide them. This keeps component state alive across tab switches.

`AutocompleteInput` is a controlled component that accepts an `options` string array and filters it case-insensitively against the current input value. It uses `onMouseDown` (not `onClick`) for list item selection so the event fires before the input's `onBlur`, preventing the dropdown from closing before a selection registers.

### API Routes

All three API routes (`/api/trains`, `/api/stations`, `/api/delay-stats`) follow the same pattern:

1. Build a SQL query string
2. Write it to a temp file in `os.tmpdir()`
3. Run `duckdb -json -f <tmpfile>` via `execSync` with `cwd` set to the `travel-plan-web` sibling directory (where the parquet files live)
4. Parse and return the JSON result

The parquet data directory is resolved as `../travel-plan-web/db_railway_stats/` relative to this project's root, so no data files need to be copied.

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
- [DuckDB CLI](https://duckdb.org/docs/installation/) installed and on `$PATH`
- The sibling directory `../travel-plan-web/db_railway_stats/` must contain the parquet files

Verify DuckDB is available:

```bash
duckdb --version
```

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

Returns all distinct train names from the parquet dataset.

**Response:** `[{ train_name: string, train_type: string }]`

---

### `GET /api/stations?train=<train_name>`

Returns all stations for a given train, ordered by their position on the line.

**Response:** `[{ station_name: string, station_num: number }]`

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
