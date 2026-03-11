#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/railway}"
PARQUET_DIR="${PARQUET_DIR:-$ROOT/db_railway_stats}"
MODE="${1:-incremental}" # incremental | full
LONG_DISTANCE_REGEX='^(ICE|IC|EC|EN|RJX|RJ|NJ|ECE)( |$)'

if ! command -v duckdb >/dev/null 2>&1; then
	echo "duckdb CLI not found. Install with: brew install duckdb" >&2
	exit 1
fi

if [ ! -d "$PARQUET_DIR" ]; then
	echo "Parquet directory not found: $PARQUET_DIR" >&2
	exit 1
fi

if command -v psql >/dev/null 2>&1; then
	run_sql() { psql "$DB_URL" "$@"; }
	run_sql_file() { psql "$DB_URL" -f "$1"; }
else
	CONTAINER="${POSTGRES_CONTAINER:-$(docker ps --filter ancestor=postgres:16-alpine --format '{{.Names}}' | {
		read -r first || true
		printf '%s' "$first"
	})}"
	if [ -z "$CONTAINER" ]; then
		echo "Error: psql not found and no postgres:16-alpine container is running." >&2
		exit 1
	fi

	run_sql() {
		docker exec -i "$CONTAINER" psql "$DB_URL" "$@"
	}
	run_sql_file() {
		docker exec -i "$CONTAINER" psql "$DB_URL" <"$1"
	}
fi

echo "Initializing German railway schema..."
run_sql_file "$SCRIPT_DIR/init-db-german-railway.sql"

if [ "$MODE" = "full" ]; then
	echo "Full reload mode: truncating German railway tables..."
	run_sql -c "TRUNCATE TABLE de_db_train_latest_stops;"
	run_sql -c "TRUNCATE TABLE de_db_delay_events RESTART IDENTITY;"
	run_sql -c "TRUNCATE TABLE de_db_load_state;"
elif [ "$MODE" != "incremental" ]; then
	echo "Unknown mode: $MODE (use: incremental or full)" >&2
	exit 1
fi

echo "Loading parquet files from: $PARQUET_DIR"

shopt -s nullglob
files=("$PARQUET_DIR"/*.parquet)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
	echo "No parquet files found in $PARQUET_DIR"
	exit 0
fi

for file in "${files[@]}"; do
	base="$(basename "$file")"

	already_loaded="$(run_sql -At -c "SELECT 1 FROM de_db_load_state WHERE file_name = '$base' LIMIT 1;")"
	if [ -n "$already_loaded" ]; then
		echo "Skipping already loaded file: $base"
		continue
	fi

	echo "Loading $base ..."

	duckdb -c "
    INSTALL postgres;
    LOAD postgres;
    SET TimeZone = 'UTC';
    ATTACH '$DB_URL' AS pg (TYPE POSTGRES);

    INSERT INTO pg.public.de_db_delay_events (
      source_file,
      service_date,
      event_time,
      train_name,
      station_name,
      train_line_ride_id,
      train_line_station_num,
      delay_in_min,
      is_canceled,
      arrival_planned_time,
      departure_planned_time
    )
    WITH ranked AS (
      SELECT
        '$base' AS source_file,
        CAST(DATE_TRUNC('day', time) AS DATE) AS service_date,
        CAST(time AS TIMESTAMPTZ) AS event_time,
        train_name,
        station_name,
        NULLIF(train_line_ride_id, '') AS train_line_ride_id,
        train_line_station_num::INTEGER AS train_line_station_num,
        delay_in_min::INTEGER AS delay_in_min,
        is_canceled::BOOLEAN AS is_canceled,
        CAST(arrival_planned_time AS TIMESTAMPTZ) AS arrival_planned_time,
        CAST(departure_planned_time AS TIMESTAMPTZ) AS departure_planned_time,
        ROW_NUMBER() OVER (
          PARTITION BY
            DATE_TRUNC('day', time),
            train_name,
            station_name,
            COALESCE(train_line_ride_id, ''),
            train_line_station_num
          ORDER BY time DESC
        ) AS rn
      FROM read_parquet('$file')
      WHERE train_name IS NOT NULL
        AND regexp_matches(train_name, '$LONG_DISTANCE_REGEX')
        AND station_name IS NOT NULL
        AND time IS NOT NULL
        AND train_line_station_num IS NOT NULL
    )
    SELECT
      source_file,
      service_date,
      event_time,
      train_name,
      station_name,
      train_line_ride_id,
      train_line_station_num,
      delay_in_min,
      is_canceled,
      arrival_planned_time,
      departure_planned_time
    FROM ranked
    WHERE rn = 1;
  "

	run_sql -c "
    INSERT INTO de_db_load_state (file_name, rows_loaded)
    SELECT '$base', COUNT(*)
    FROM de_db_delay_events
    WHERE source_file = '$base';
  "

	echo "Loaded $base"
done

echo "Refreshing de_db_train_latest_stops ..."
run_sql -c "TRUNCATE TABLE de_db_train_latest_stops;"

run_sql -c "
  INSERT INTO de_db_train_latest_stops (
    train_name,
    station_name,
    station_num,
    arrival_planned_time,
    departure_planned_time,
    ride_date,
    train_line_ride_id,
    last_event_time
  )
  WITH latest_run AS (
    SELECT
      train_name,
      train_line_ride_id,
      service_date,
      MAX(event_time) AS latest_time
    FROM de_db_delay_events
    WHERE train_line_ride_id IS NOT NULL
    GROUP BY train_name, train_line_ride_id, service_date
  ),
  picked_run AS (
    SELECT DISTINCT ON (train_name)
      train_name,
      train_line_ride_id,
      service_date,
      latest_time
    FROM latest_run
    ORDER BY train_name, latest_time DESC
  ),
  ranked_stops AS (
    SELECT
      d.train_name,
      d.station_name,
      d.train_line_station_num AS station_num,
      d.arrival_planned_time,
      d.departure_planned_time,
      p.service_date AS ride_date,
      d.train_line_ride_id,
      d.event_time AS last_event_time,
      ROW_NUMBER() OVER (
        PARTITION BY d.train_name, d.train_line_station_num
        ORDER BY d.event_time DESC
      ) AS rn
    FROM de_db_delay_events d
    JOIN picked_run p
      ON d.train_name = p.train_name
     AND d.train_line_ride_id = p.train_line_ride_id
     AND d.service_date = p.service_date
  )
  SELECT
    train_name,
    station_name,
    station_num,
    arrival_planned_time,
    departure_planned_time,
    ride_date,
    train_line_ride_id,
    last_event_time
  FROM ranked_stops
  WHERE rn = 1
  ORDER BY train_name, station_num;
"

echo "Done."
echo "One-time backfill: bash scripts/load-german-railway.sh full"
echo "Incremental:       bash scripts/load-german-railway.sh"
