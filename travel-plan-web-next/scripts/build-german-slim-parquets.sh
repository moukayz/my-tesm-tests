#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${SCRIPT_DIR}/.."

INPUT_DIR="${ROOT}/db_railway_stats"
OUTPUT_DIR="${ROOT}/db_railway_stats_slim"

usage() {
	cat <<'EOF'
Usage:
  bash scripts/build-german-slim-parquets.sh [--input-dir <path>] [--output-dir <path>]

Options:
  --input-dir,  -i   Source directory containing monthly parquet files
  --output-dir, -o   Destination directory for slim parquet outputs
  --help,       -h   Show this help message
EOF
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--input-dir | -i)
		if [ "$#" -lt 2 ]; then
			echo "Missing value for $1" >&2
			exit 1
		fi
		INPUT_DIR="$2"
		shift 2
		;;
	--output-dir | -o)
		if [ "$#" -lt 2 ]; then
			echo "Missing value for $1" >&2
			exit 1
		fi
		OUTPUT_DIR="$2"
		shift 2
		;;
	--help | -h)
		usage
		exit 0
		;;
	*)
		echo "Unknown argument: $1" >&2
		usage >&2
		exit 1
		;;
	esac
done

DELAY_OUT="${OUTPUT_DIR}/delay_events_slim.parquet"
LATEST_STOPS_OUT="${OUTPUT_DIR}/train_latest_stops.parquet"

if ! command -v duckdb >/dev/null 2>&1; then
	echo "duckdb CLI not found. Install with: brew install duckdb" >&2
	exit 1
fi

if [ ! -d "${INPUT_DIR}" ]; then
	echo "Input parquet directory not found: ${INPUT_DIR}" >&2
	exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "Building slim German railway parquets..."
echo "Input:  ${INPUT_DIR}"
echo "Output: ${OUTPUT_DIR}"

duckdb -c "
  COPY (
    WITH ranked AS (
      SELECT
        CAST(time AS TIMESTAMP_NS) AS time,
        train_name,
        station_name,
        NULLIF(train_line_ride_id, '') AS train_line_ride_id,
        train_line_station_num::BIGINT AS train_line_station_num,
        delay_in_min::INTEGER AS delay_in_min,
        is_canceled::BOOLEAN AS is_canceled,
        CAST(arrival_planned_time AS TIMESTAMP_NS) AS arrival_planned_time,
        CAST(departure_planned_time AS TIMESTAMP_NS) AS departure_planned_time,
        ROW_NUMBER() OVER (
          PARTITION BY
            DATE_TRUNC('day', time),
            train_name,
            station_name,
            COALESCE(train_line_ride_id, ''),
            train_line_station_num
          ORDER BY time DESC
        ) AS rn
      FROM read_parquet('${INPUT_DIR}/*.parquet')
      WHERE train_name IS NOT NULL
        AND station_name IS NOT NULL
        AND time IS NOT NULL
        AND train_line_station_num IS NOT NULL
    )
    SELECT
      time,
      train_name,
      station_name,
      train_line_ride_id,
      train_line_station_num,
      delay_in_min,
      is_canceled,
      arrival_planned_time,
      departure_planned_time
    FROM ranked
    WHERE rn = 1
  ) TO '${DELAY_OUT}'
  (FORMAT PARQUET, COMPRESSION ZSTD);

  COPY (
    WITH delay_events AS (
      SELECT * FROM read_parquet('${DELAY_OUT}')
    ),
    latest_ride AS (
      SELECT
        train_name,
        train_line_ride_id,
        MAX(time) AS latest_time
      FROM delay_events
      WHERE train_line_ride_id IS NOT NULL
      GROUP BY train_name, train_line_ride_id
    ),
    picked_ride AS (
      SELECT
        train_name,
        train_line_ride_id,
        latest_time,
        ROW_NUMBER() OVER (
          PARTITION BY train_name
          ORDER BY latest_time DESC
        ) AS rn
      FROM latest_ride
    ),
    latest_occurrence AS (
      SELECT
        d.train_name,
        d.station_name,
        d.train_line_station_num AS station_num,
        d.arrival_planned_time,
        d.departure_planned_time,
        CAST(DATE_TRUNC('day', p.latest_time) AS DATE) AS ride_date,
        ROW_NUMBER() OVER (
          PARTITION BY d.train_name, d.train_line_station_num
          ORDER BY d.time DESC
        ) AS stop_rn
      FROM delay_events d
      JOIN picked_ride p
        ON d.train_name = p.train_name
       AND d.train_line_ride_id = p.train_line_ride_id
      WHERE p.rn = 1
    )
    SELECT
      train_name,
      station_name,
      station_num,
      arrival_planned_time,
      departure_planned_time,
      ride_date
    FROM latest_occurrence
    WHERE stop_rn = 1
    ORDER BY train_name, station_num
  ) TO '${LATEST_STOPS_OUT}'
  (FORMAT PARQUET, COMPRESSION ZSTD);
"

echo "Done."
ls -lh "${DELAY_OUT}" "${LATEST_STOPS_OUT}"
