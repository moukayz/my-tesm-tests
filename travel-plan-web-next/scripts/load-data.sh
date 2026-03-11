#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/railway}"
GTFS="$ROOT/euro-railway-timetable"

echo "Loading GTFS data..."
echo "DB_URL: $DB_URL"

# Prefer local psql; fall back to running psql inside the postgres container
if command -v psql &>/dev/null; then
  run_sql() { psql "$DB_URL" "$@"; }
  copy_table() {
    local table="$1" file="$2"
    psql "$DB_URL" -c "\copy gtfs_${table} FROM '${file}' CSV HEADER"
  }
else
  CONTAINER="${POSTGRES_CONTAINER:-$(docker ps --filter ancestor=postgres:16-alpine --format '{{.Names}}' | head -1)}"
  if [ -z "$CONTAINER" ]; then
    echo "Error: psql not found and no postgres:16-alpine container is running." >&2
    exit 1
  fi
  echo "psql not found locally — using container: $CONTAINER"
  run_sql() {
    local args=("$@")
    # Replace -f <path> with stdin piping since the file is on the host
    if [[ "${args[0]}" == "-f" ]]; then
      docker exec -i "$CONTAINER" psql -U postgres railway < "${args[1]}"
    else
      docker exec -i "$CONTAINER" psql -U postgres railway "${args[@]}"
    fi
  }
  copy_table() {
    local table="$1" file="$2"
    docker exec -i "$CONTAINER" psql -U postgres railway \
      -c "COPY gtfs_${table} FROM STDIN CSV HEADER" < "$file"
  }
fi

echo "Initialising schema..."
run_sql -f "$SCRIPT_DIR/init-db.sql"

for table in agency calendar calendar_dates routes stops stop_times trips shapes; do
  file="$GTFS/${table}.txt"
  echo "Loading $table from $file..."
  copy_table "$table" "$file"
done

echo "Done."
