---
name: eurostar-timetable
description: Query Eurostar timetable from GTFS CSV files using non-interactive DuckDB commands. Use when asked about Eurostar train departure/arrival times, stop lists, service dates, or route information between UK, France, Belgium, Netherlands, and Germany.
compatibility: claude-code
---

## Data Location

GTFS CSV files are at `travel-plan-web-next/eurostar-timetable/` relative to the repo root:

```
eurostar-timetable/
  agency.txt          — Eurostar agency records (3 agencies: THALYS, EUROSTAR_CHANNEL, EUROSTAR_CONTINENTAL)
  routes.txt          — Named lines (route_id, route_short_name, route_long_name, checkin_duration)
  trips.txt           — One trip per service_id × train number (trip_short_name = train number)
  stops.txt           — Station records (stop_id slug, stop_name, lat/lon, stop_timezone)
  stop_times.txt      — Arrival/departure times per stop (~39k rows)
  calendar_dates.txt  — Dates each service_id runs (exception_type=1 means "runs on this date")
  shapes.txt          — Route shape geometry (not typically needed for timetable queries)
```

**Data date range**: 2026-03-09 to 2026-06-06

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
duckdb -c "SELECT ... FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) ..."

# Multi-line query
duckdb -c "
  SELECT s.stop_name, st.arrival_time, st.departure_time
  FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
  JOIN ...
"
```

**Critical**: Always override `arrival_time` and `departure_time` as VARCHAR in `stop_times.txt`. Some overnight trains use times like `24:03:00` which DuckDB cannot parse as `time` type:
`read_csv('...stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'})`

**Important**: Train number is in `trip_short_name` (integer) — cast to VARCHAR for comparisons:
`t.trip_short_name::VARCHAR = '9002'`

## Schema Reference

### `trips.txt`
| Column | Type | Description |
|--------|------|-------------|
| route_id | string | References routes.txt (e.g. `GBSPX-FRPNO`) |
| service_id | string | Encodes train + date: `{train_number}-{MMDD}` (e.g. `9002-0314`) |
| trip_id | string | Same as service_id in this feed |
| trip_headsign | string | **Destination name** (e.g. "Paris-Nord", "London St Pancras") — NOT the train number |
| trip_short_name | integer | **Train number** (e.g. 9002, 9014) — cast to VARCHAR for LIKE/= comparisons |
| direction_id | integer | 0 or 1 (direction of travel) |

### `stop_times.txt`
| Column | Type | Description |
|--------|------|-------------|
| trip_id | string | References trips.txt |
| arrival_time | string | Arrival time as HH:MM:SS (may exceed 24:00 for overnight trains — DuckDB must be told to read as VARCHAR) |
| departure_time | string | Departure time as HH:MM:SS (may exceed 24:00 for overnight trains — DuckDB must be told to read as VARCHAR) |
| stop_id | string | References stops.txt (human-readable slug, e.g. `paris_nord`) |
| stop_sequence | integer | Order of stop within the trip (**1-indexed**: first stop = 1) |
| drop_off_type | integer | 0=regular, 1=no drop-off |
| pickup_type | integer | 0=regular, 1=no pickup |

### `stops.txt`
| Column | Type | Description |
|--------|------|-------------|
| stop_id | string | Human-readable slug (e.g. `paris_nord`, `st_pancras_international`, `amsterdam_centraal`) |
| stop_code | integer | Numeric station code |
| stop_name | string | Human-readable station name (e.g. "Paris-Nord", "Amsterdam-Centraal") |
| stop_lat / stop_lon | float | GPS coordinates |
| stop_timezone | string | IANA timezone (e.g. `Europe/Paris`, `Europe/London`) |
| location_type | integer | 0=stop point, 1=stop area |
| parent_station | string | Parent stop area slug (e.g. `paris_nord_station_area`) |
| platform_code | string | Platform identifier (nullable) |

### `routes.txt`
| Column | Type | Description |
|--------|------|-------------|
| route_id | string | Station-pair code (e.g. `GBSPX-FRPNO` = London St Pancras → Paris Nord) |
| agency_id | string | `THALYS`, `EUROSTAR_CHANNEL`, or `EUROSTAR_CONTINENTAL` |
| route_short_name | string | Same as route_id (e.g. "BEBMI -> FRPNO") |
| route_long_name | string | Full station names (e.g. "Bruxelles-Midi -> Paris-Nord") |
| route_type | integer | 2=rail |
| checkin_duration | integer | Required check-in time in seconds (e.g. 2700 = 45 min for channel trains) |

### `calendar_dates.txt`
| Column | Type | Description |
|--------|------|-------------|
| service_id | string | References trips.txt (format: `{train_number}-{MMDD}`) |
| date | integer | Date as YYYYMMDD integer (e.g. 20260314) |
| exception_type | integer | 1=service runs on this date, 2=service removed |

## Key Concepts

- **Train number** = `trip_short_name` in `trips.txt` (integer — always cast: `trip_short_name::VARCHAR`)
- **`trip_headsign` is the destination name**, not the train number (opposite to SNCF feed)
- **stop_sequence is 1-indexed**: first stop = 1, last stop = max(stop_sequence)
- **stop_id is a slug**: e.g. `paris_nord`, `st_pancras_international`, `brussels_midi`, `amsterdam_centraal`
- **service_id encodes the date**: `9002-0314` = train 9002 running on March 14. Each service_id typically runs on exactly one date.
- **arrival_time / departure_time** are inferred as DuckDB `time` type (not string), so no casting needed for display but use `::VARCHAR` if you need string comparison
- **Data only covers 2026-03-09 to 2026-06-06** — queries for other dates will return no results

## Common Station stop_id Slugs

| Station | stop_id |
|---------|---------|
| London St Pancras | `st_pancras_international` |
| Paris Nord | `paris_nord` |
| Brussels Midi / Zuid | `brussels_midi` |
| Amsterdam Centraal | `amsterdam_centraal` |
| Lille Europe | `lille_europe` |
| Ebbsfleet International | `ebbsfleet_international` |
| Ashford International | `ashford_international` |
| Rotterdam Centraal | `rotterdam_centraal` |
| Köln Hbf | `koeln_hbf` |
| Marne-la-Vallée Chessy | `marne_la_vallee_chessy` |

Use `ILIKE '%keyword%'` on `stop_name` when the slug is unknown.

## Common Query Patterns

### Full timetable for a train on a specific date
```sql
SELECT st.stop_sequence, s.stop_name, st.arrival_time, st.departure_time
FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
JOIN read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE t.trip_short_name::VARCHAR = '9002'
  AND cd.date = 20260314
  AND cd.exception_type = 1
ORDER BY st.stop_sequence;
```

### Arrival/departure at a specific station for a train (any date)
```sql
SELECT s.stop_name, st.arrival_time, st.departure_time, cd.date
FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
JOIN read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE t.trip_short_name::VARCHAR = '9002'
  AND s.stop_name ILIKE '%Paris%'
  AND cd.exception_type = 1
ORDER BY cd.date;
```

### All trains between two cities on a date
```sql
SELECT t.trip_short_name::VARCHAR AS train_num, t.trip_headsign AS destination,
       dep.departure_time, arr.arrival_time
FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) dep
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) arr ON dep.trip_id = arr.trip_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true) t ON dep.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stops.txt', header=true) s_dep ON dep.stop_id = s_dep.stop_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stops.txt', header=true) s_arr ON arr.stop_id = s_arr.stop_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE s_dep.stop_name ILIKE '%London%'
  AND s_arr.stop_name ILIKE '%Paris%'
  AND dep.stop_sequence < arr.stop_sequence
  AND cd.date = 20260314
  AND cd.exception_type = 1
ORDER BY dep.departure_time;
```

### All dates a train runs
```sql
SELECT cd.date, t.trip_headsign AS destination
FROM read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true) t
JOIN read_csv('travel-plan-web-next/eurostar-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE t.trip_short_name::VARCHAR = '9002'
  AND cd.exception_type = 1
ORDER BY cd.date;
```

### All stops at a station on a date
```sql
SELECT t.trip_short_name::VARCHAR AS train_num, t.trip_headsign AS destination,
       st.arrival_time, st.departure_time
FROM read_csv('travel-plan-web-next/eurostar-timetable/stop_times.txt', header=true, types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}) st
JOIN read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true) t ON st.trip_id = t.trip_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/stops.txt', header=true) s ON st.stop_id = s.stop_id
JOIN read_csv('travel-plan-web-next/eurostar-timetable/calendar_dates.txt', header=true) cd ON t.service_id = cd.service_id
WHERE s.stop_name ILIKE '%Brussels%'
  AND cd.date = 20260314
  AND cd.exception_type = 1
ORDER BY st.departure_time;
```

### List all distinct train numbers
```sql
SELECT DISTINCT trip_short_name::VARCHAR AS train_num
FROM read_csv('travel-plan-web-next/eurostar-timetable/trips.txt', header=true)
ORDER BY train_num;
```

### Find routes by station name
```sql
SELECT DISTINCT r.route_short_name, r.route_long_name, r.agency_id, r.checkin_duration
FROM read_csv('travel-plan-web-next/eurostar-timetable/routes.txt', header=true) r
WHERE r.route_long_name ILIKE '%London%'
ORDER BY r.route_short_name;
```

## Query Tips

- **Run from repo root** — use `travel-plan-web-next/eurostar-timetable/filename.txt` as the path.
- **Train number is `trip_short_name`** (integer) — always cast: `trip_short_name::VARCHAR`. Do NOT use `trip_headsign` for train number lookups.
- **stop_sequence is 1-indexed** — first stop = 1 (unlike SNCF feed which is 0-indexed).
- **arrival_time / departure_time must be VARCHAR** — Some overnight trains use times like `24:03:00` which DuckDB cannot parse as `time`. Always use `types={'arrival_time': 'VARCHAR', 'departure_time': 'VARCHAR'}` when reading `stop_times.txt`.
- **Station name fuzzy match** — use `ILIKE '%keyword%'` on `stop_name`. Station names may include suffixes like "Centraal", "Hbf", "International".
- **Each service_id typically covers one date** — no need to GROUP BY or use MODE() for deduplication (unlike SNCF).
- **stop_times.txt is small** (~39k rows) — queries are fast even without aggressive filtering.
- **Data only covers 2026-03-09 to 2026-06-06** — queries for other dates will return no results.
- **Check-in duration** — channel tunnel trains (EUROSTAR_CHANNEL) require 45-min check-in (`checkin_duration = 2700`). Continental trains have 0.
