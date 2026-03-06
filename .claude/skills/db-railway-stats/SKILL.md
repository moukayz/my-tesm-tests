---
name: db-railway-stats
description: Analyze DB railway historical stats from parquet files using non-interactive DuckDB commands. Use when asked about train delays, cancellations, timetables, or station performance.
compatibility: claude-code
---

## Data Location

Parquet files are at `travel-plan-web/db_railway_stats/` relative to the repo root:

```
db_railway_stats/
  data-2025-10.parquet
  data-2025-11.parquet
  data-2026-01.parquet
  data-2026-02.parquet
```

## DuckDB Setup

if DuckDB is not pre-installed. Install it first:

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
# Single inline query
duckdb -c "SELECT ... FROM read_parquet('db_railway_stats/*.parquet')"

# Multi-line query (use single quotes carefully — escape with \')
duckdb -c "
  SELECT station_name, AVG(delay_in_min)
  FROM read_parquet('db_railway_stats/*.parquet')
  GROUP BY station_name
  ORDER BY 2 DESC
"
```

The glob `db_railway_stats/*.parquet` reads all months at once. Filter by `time` column to narrow to a specific month.

## Schema Reference

| Column | Type | Description |
|--------|------|-------------|
| station_name | string | Name of the station |
| xml_station_name | string | Station name from XML response |
| eva | string | EVA station number (unique identifier) |
| train_name | string | Train name, e.g. "ICE 123", "RE 5" |
| final_destination_station | string | Final destination of the train |
| delay_in_min | integer | Delay in minutes (negative = early) |
| time | timestamp | Actual arrival or departure time |
| is_canceled | boolean | Whether the train stop was canceled |
| train_type | string | Type of train: "ICE", "IC", "RE", etc. |
| train_line_ride_id | string | Unique identifier for the train ride |
| train_line_station_num | integer | Station number in the train's route (ordered) |
| arrival_planned_time | timestamp | Planned arrival time |
| arrival_change_time | timestamp | Actual/changed arrival time |
| departure_planned_time | timestamp | Planned departure time |
| departure_change_time | timestamp | Actual/changed departure time |
| id | string | Unique identifier for the train stop record |

## Data Selection Rules

### Planned timetable queries
When asked about planned departure/arrival times, use the **latest non-empty data** for that train:
- Find the most recent date where the train has records with non-null planned times
- Use that single day's data as the representative timetable
- Do NOT average across multiple days — planned times are schedule-based and should reflect the current timetable

Pattern: filter to the latest date that has data, exclude rows where both `arrival_planned_time` and `departure_planned_time` are NULL.

```sql
-- Step 1: find the latest date with non-null planned time data for the train
SELECT MAX(DATE_TRUNC('day', time)) AS latest_date
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
  AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL);

-- Step 2: query the timetable for that date
SELECT
  train_line_station_num,
  station_name,
  arrival_planned_time,
  departure_planned_time,
  is_canceled
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
  AND DATE_TRUNC('day', time) = '<latest_date_from_step1>'
  AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL)
ORDER BY train_line_station_num;
```

Or as a single query using a subquery:

```sql
SELECT
  train_line_station_num,
  station_name,
  arrival_planned_time,
  departure_planned_time,
  is_canceled
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
  AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL)
  AND DATE_TRUNC('day', time) = (
    SELECT MAX(DATE_TRUNC('day', time))
    FROM read_parquet('db_railway_stats/*.parquet')
    WHERE train_name = 'ICE 123'
      AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL)
  )
ORDER BY train_line_station_num;
```

### Historical behavior queries
When asked about delays, cancellation rates, or any behavioral patterns, use the **latest 3 months of data**:
- Compute the cutoff as `MAX(time) - INTERVAL 3 MONTHS` from the dataset
- Always filter `WHERE time >= cutoff` before aggregating
- This keeps results relevant and avoids stale data skewing averages

Pattern: derive the cutoff dynamically from the data's own max timestamp, not from a hardcoded date.

```sql
-- Reusable 3-month window filter (inline as subquery)
WHERE time >= (
  SELECT MAX(time) - INTERVAL 3 MONTHS
  FROM read_parquet('db_railway_stats/*.parquet')
)
```

## Common Query Patterns

### Planned timetable by train name (e.g. "ICE 123")
Uses latest non-empty data — see Data Selection Rules above.

```sql
SELECT
  train_line_station_num,
  station_name,
  arrival_planned_time,
  departure_planned_time,
  is_canceled
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
  AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL)
  AND DATE_TRUNC('day', time) = (
    SELECT MAX(DATE_TRUNC('day', time))
    FROM read_parquet('db_railway_stats/*.parquet')
    WHERE train_name = 'ICE 123'
      AND (arrival_planned_time IS NOT NULL OR departure_planned_time IS NOT NULL)
  )
ORDER BY train_line_station_num;
```

### Average delay at a station (all trains, latest 3 months)
```sql
SELECT
  station_name,
  COUNT(*) AS total_stops,
  ROUND(AVG(delay_in_min), 2) AS avg_delay_min,
  MAX(delay_in_min) AS max_delay_min
FROM read_parquet('db_railway_stats/*.parquet')
WHERE is_canceled = false
  AND time >= (
    SELECT MAX(time) - INTERVAL 3 MONTHS
    FROM read_parquet('db_railway_stats/*.parquet')
  )
GROUP BY station_name
ORDER BY avg_delay_min DESC;
```

### Average delay at a station for a specific train (latest 3 months)
```sql
SELECT
  station_name,
  train_name,
  COUNT(*) AS total_stops,
  ROUND(AVG(delay_in_min), 2) AS avg_delay_min
FROM read_parquet('db_railway_stats/*.parquet')
WHERE is_canceled = false
  AND train_name = 'ICE 123'
  AND time >= (
    SELECT MAX(time) - INTERVAL 3 MONTHS
    FROM read_parquet('db_railway_stats/*.parquet')
  )
GROUP BY station_name, train_name
ORDER BY avg_delay_min DESC;
```

### Cancellation rate by station (latest 3 months)
```sql
SELECT
  station_name,
  COUNT(*) AS total_stops,
  SUM(CASE WHEN is_canceled THEN 1 ELSE 0 END) AS canceled,
  ROUND(100.0 * SUM(CASE WHEN is_canceled THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancel_rate_pct
FROM read_parquet('db_railway_stats/*.parquet')
WHERE time >= (
  SELECT MAX(time) - INTERVAL 3 MONTHS
  FROM read_parquet('db_railway_stats/*.parquet')
)
GROUP BY station_name
ORDER BY cancel_rate_pct DESC;
```

### Delay distribution for a train at a station (latest 3 months)
```sql
SELECT
  delay_in_min,
  COUNT(*) AS occurrences
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
  AND station_name = 'Frankfurt(Main)Hbf'
  AND is_canceled = false
  AND time >= (
    SELECT MAX(time) - INTERVAL 3 MONTHS
    FROM read_parquet('db_railway_stats/*.parquet')
  )
GROUP BY delay_in_min
ORDER BY delay_in_min;
```

### Delay trends over time (daily average, latest 3 months)
```sql
SELECT
  DATE_TRUNC('day', time) AS day,
  ROUND(AVG(delay_in_min), 2) AS avg_delay_min,
  COUNT(*) AS total_stops
FROM read_parquet('db_railway_stats/*.parquet')
WHERE is_canceled = false
  AND time >= (
    SELECT MAX(time) - INTERVAL 3 MONTHS
    FROM read_parquet('db_railway_stats/*.parquet')
  )
GROUP BY day
ORDER BY day;
```

### List all distinct train names/types
```sql
SELECT DISTINCT train_type, train_name
FROM read_parquet('db_railway_stats/*.parquet')
ORDER BY train_type, train_name;
```

### Explore available train ride IDs for a train name
```sql
SELECT DISTINCT
  train_line_ride_id,
  DATE_TRUNC('day', time) AS date
FROM read_parquet('db_railway_stats/*.parquet')
WHERE train_name = 'ICE 123'
ORDER BY date;
```

## Query Tips

- **Run paths from repo root** — use `db_railway_stats/*.parquet` as the path when running from `travel-plan-web/`.
- **Filter by month** — add `WHERE time >= '2026-01-01' AND time < '2026-02-01'` to limit to one parquet file's range without loading all files.
- **train_name vs train_line_ride_id** — `train_name` is human-readable ("ICE 123") but the same train runs daily with different `train_line_ride_id` values. Use `train_line_ride_id` to look at one specific run.
- **Nulls in time columns** — `arrival_planned_time` or `departure_planned_time` can be NULL for terminus stations (first/last stop). Use `COALESCE(arrival_planned_time, departure_planned_time)` when needed.
- **delay_in_min** — can be negative (train arrived/departed early). Filter `delay_in_min > 0` for late trains only.
