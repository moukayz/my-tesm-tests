---
name: french-railway-timetable
description: Query French railway (SNCF) timetable from GTFS CSV files using non-interactive DuckDB commands. Use when asked about French train departure/arrival times, stop lists, service dates, or route information.
compatibility: claude-code
---

## Data Location

GTFS CSV files are at `travel-plan-web-next/french-railway-timetable/` relative to the repo root:

```
french-railway-timetable/
  agency.txt          — SNCF agency records
  routes.txt          — Named lines (route_id, route_short_name, route_long_name)
  trips.txt           — One trip per service_id × train number (trip_headsign = train number)
  stops.txt           — Station records (stop_id, stop_name, lat/lon)
  stop_times.txt      — Arrival/departure times per stop (largest file, ~429k rows)
  calendar_dates.txt  — Dates each service_id runs (exception_type=1 means "runs on this date")
  feed_info.txt       — Feed metadata (date range: 2026-03-08 to 2026-08-31)
  transfers.txt       — Transfer connections (currently empty)
```

## DuckDB Setup

If DuckDB is not pre-installed, install it first:

```bash
# macOS
brew install duckdb

# Linux
curl -L https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip -o duckdb.zip && unzip duckdb.zip
```

Verify: `duckdb --version`

## How to Run Non-Interactive Queries

Always use the `-c` flag. Never open the interactive shell.

```bash
# Single inline query (run from repo root)
duckdb -c "SELECT ... FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) ..."

# Multi-line query
duckdb -c "
  SELECT s.stop_name, st.arrival_time, st.departure_time
  FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) st
  JOIN ...
"
```

**Important**: Always cast `trip_headsign` to VARCHAR before comparisons:
`t.trip_headsign::VARCHAR = '6101'`

## Schema Reference

### `trips.txt`
| Column | Type | Description |
|--------|------|-------------|
| route_id | string | References routes.txt |
| service_id | string | References calendar_dates.txt (which dates this trip runs) |
| trip_id | string | Unique trip identifier (encoded with route/stop/date info) |
| trip_headsign | integer | **Train number** (e.g. 6101, 6213, 9876) — cast to VARCHAR for LIKE/= comparisons |
| direction_id | integer | 0 or 1 (direction of travel) |
| block_id | string | Block identifier |

### `stop_times.txt`
| Column | Type | Description |
|--------|------|-------------|
| trip_id | string | References trips.txt |
| arrival_time | string | Arrival time as HH:MM:SS (may exceed 24:00 for overnight trains) |
| departure_time | string | Departure time as HH:MM:SS |
| stop_id | string | References stops.txt |
| stop_sequence | integer | Order of stop within the trip (0-indexed) |
| pickup_type | integer | 0=regular, 1=no pickup |
| drop_off_type | integer | 0=regular, 1=no drop-off |

### `stops.txt`
| Column | Type | Description |
|--------|------|-------------|
| stop_id | string | Unique stop identifier (e.g. `StopPoint:OCETGV INOUI-87571000`) |
| stop_name | string | Human-readable station name (e.g. "Paris Gare de Lyon Hall 1 - 2") |
| stop_lat / stop_lon | float | GPS coordinates |
| location_type | integer | 0=stop point, 1=stop area |
| parent_station | string | StopArea if this is a StopPoint |

### `routes.txt`
| Column | Type | Description |
|--------|------|-------------|
| route_id | string | Unique route identifier |
| agency_id | string | References agency.txt |
| route_short_name | string | Line code (e.g. "C30", "P53", "411A") |
| route_long_name | string | Full line name (e.g. "Saint-Étienne - Roanne") |
| route_type | integer | 0=tram, 2=rail, 3=bus |

### `calendar_dates.txt`
| Column | Type | Description |
|--------|------|-------------|
| service_id | string | References trips.txt |
| date | integer | Date as YYYYMMDD integer (e.g. 20260710) |
| exception_type | integer | 1=service runs on this date, 2=service removed |

## Key Concepts

- **Train number** = `trip_headsign` in `trips.txt` (auto-detected as integer — always cast to VARCHAR)
- **Same train number, multiple service_ids**: Train 6101 may run on different dates with slightly different timetables. Join with `calendar_dates` to pick a specific date.
- **stop_sequence**: 0-indexed. First stop = 0, last stop = max(stop_sequence). Use to determine origin/destination.
- **Data date range**: 2026-03-08 to 2026-08-31 — only query dates in this window.

## Train Class Inference (Use This)

This feed does not provide a dedicated `train_class` column. Infer class from `trip_id` token patterns, and (optionally) validate with stop namespace brand in `stop_id`.

### Primary rule (no route name fallback)

Use `trip_id` token `F:<TOKEN>:` as the source of truth:

- `F:OGO:` -> `OUIGO`
- `F:OUI:` -> `TGV` (TGV INOUI family)
- `F:IC:` -> `INTERCITES`
- `F:ICN:` -> `INTERCITES de nuit`
- `F:TER:` -> `TER`
- `F:LYR:` -> `LYRIA`
- `F:ICE:` -> `ICE`
- `F:TT:` -> `TRAMTRAIN`
- `F:NAV:` -> `NAVETTE`
- `F:TRN:` -> `TRAIN`
- no `F:` token -> `UNKNOWN`

Do **not** infer class from `route_long_name` as fallback.

### Optional consistency check (stop namespace)

For this snapshot, `trip_id` token and `stop_id` namespace are consistent for branded high-speed services:

- `F:OGO:` aligns with `StopPoint:OCEOUIGO-...`
- `F:OUI:` aligns with `StopPoint:OCETGV INOUI-...`

## Query Pattern: train labels like `TGV 9242`

```sql
WITH trip_class AS (
  SELECT
    t.trip_id,
    t.trip_headsign::VARCHAR AS train_num,
    CASE
      WHEN t.trip_id ILIKE '%F:OGO:%' THEN 'OUIGO'
      WHEN t.trip_id ILIKE '%F:OUI:%' THEN 'TGV'
      WHEN t.trip_id ILIKE '%F:ICN:%' THEN 'INTERCITES de nuit'
      WHEN t.trip_id ILIKE '%F:IC:%'  THEN 'INTERCITES'
      WHEN t.trip_id ILIKE '%F:TER:%' THEN 'TER'
      WHEN t.trip_id ILIKE '%F:LYR:%' THEN 'LYRIA'
      WHEN t.trip_id ILIKE '%F:ICE:%' THEN 'ICE'
      WHEN t.trip_id ILIKE '%F:TT:%'  THEN 'TRAMTRAIN'
      WHEN t.trip_id ILIKE '%F:NAV:%' THEN 'NAVETTE'
      WHEN t.trip_id ILIKE '%F:TRN:%' THEN 'TRAIN'
      ELSE 'UNKNOWN'
    END AS train_class
  FROM read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t
)
SELECT DISTINCT train_class || ' ' || train_num AS train_label
FROM trip_class
ORDER BY train_label;
```

## Common Query Patterns

### Timetable for a train on a specific date
```sql
SELECT st.stop_sequence, s.stop_name, st.arrival_time, st.departure_time
FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) st
JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE t.trip_headsign::VARCHAR = '6101'
  AND cd.date = 20260710
  AND cd.exception_type = 1
ORDER BY st.stop_sequence;
```

### Arrival/departure at a specific station for a train
```sql
SELECT s.stop_name, st.arrival_time, st.departure_time
FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) st
JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
WHERE t.trip_headsign::VARCHAR = '6101'
  AND s.stop_name ILIKE '%Marseille%'
ORDER BY t.service_id, st.stop_sequence;
```

### Timetable for a train (any date, deduplicated)
When the exact date is unknown, pick a representative timetable using the most common times:
```sql
SELECT stop_sequence, stop_name,
       MODE(arrival_time) AS arrival_time,
       MODE(departure_time) AS departure_time
FROM (
  SELECT st.stop_sequence, s.stop_name, st.arrival_time, st.departure_time
  FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) st
  JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
  JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
  WHERE t.trip_headsign::VARCHAR = '6101'
) sub
GROUP BY stop_sequence, stop_name
ORDER BY stop_sequence;
```

### All dates a train runs
```sql
SELECT cd.date, t.service_id
FROM read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t
JOIN read_csv('travel-plan-web-next/french-railway-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE t.trip_headsign::VARCHAR = '6101'
  AND cd.exception_type = 1
ORDER BY cd.date;
```

### Find trains between two stations
```sql
SELECT t.trip_headsign::VARCHAR AS train_num,
       dep.departure_time, arr.arrival_time
FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) dep
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) arr ON dep.trip_id = arr.trip_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON dep.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s_dep ON dep.stop_id = s_dep.stop_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s_arr ON arr.stop_id = s_arr.stop_id
WHERE s_dep.stop_name ILIKE '%Paris%'
  AND s_arr.stop_name ILIKE '%Marseille%'
  AND dep.stop_sequence < arr.stop_sequence
ORDER BY dep.departure_time
LIMIT 20;
```

### All stops at a station (arrivals + departures)
```sql
SELECT t.trip_headsign::VARCHAR AS train_num, st.arrival_time, st.departure_time, st.stop_sequence
FROM read_csv('travel-plan-web-next/french-railway-timetable/stop_times.txt', header=true) st
JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/french-railway-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
WHERE s.stop_name ILIKE '%Avignon TGV%'
ORDER BY st.departure_time
LIMIT 30;
```

### List all trains (distinct train numbers)
```sql
SELECT DISTINCT trip_headsign::VARCHAR AS train_num
FROM read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true)
ORDER BY train_num;
```

### Find train number by fuzzy name match (route name)
```sql
SELECT DISTINCT r.route_short_name, r.route_long_name, t.trip_headsign::VARCHAR AS train_num
FROM read_csv('travel-plan-web-next/french-railway-timetable/routes.txt', header=true) r
JOIN read_csv('travel-plan-web-next/french-railway-timetable/trips.txt', header=true) t ON r.route_id = t.route_id
WHERE r.route_long_name ILIKE '%Marseille%'
ORDER BY r.route_short_name, train_num
LIMIT 20;
```

## Query Tips

- **Run from repo root** — use `travel-plan-web-next/french-railway-timetable/filename.txt` as the path.
- **trip_headsign is integer** — DuckDB infers it as `int64`. Always cast: `trip_headsign::VARCHAR` before LIKE or string equality.
- **Station name fuzzy match** — use `ILIKE '%keyword%'` on `stop_name` (case-insensitive). Station names may include suffixes like "Hall 1 - 2", "TGV", "Saint-Charles".
- **Same train, multiple timetables** — the same `trip_headsign` can have multiple `service_id` rows with slightly different times. Join `calendar_dates` to get the exact timetable for a given date.
- **Data only covers 2026-03-08 to 2026-08-31** — queries for other dates will return no results.
- **stop_times.txt is large** (~429k rows) — always filter by `trip_id` (via JOIN on trips) before scanning.
- **First/last stop detection** — `stop_sequence = 0` is the origin; use `MAX(stop_sequence)` subquery to find the terminus.
