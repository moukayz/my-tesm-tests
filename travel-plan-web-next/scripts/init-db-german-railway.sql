CREATE TABLE IF NOT EXISTS de_db_delay_events (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  service_date DATE NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  train_name TEXT NOT NULL,
  station_name TEXT NOT NULL,
  train_line_ride_id TEXT,
  train_line_station_num INTEGER,
  delay_in_min INTEGER,
  is_canceled BOOLEAN,
  arrival_planned_time TIMESTAMPTZ,
  departure_planned_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS de_db_train_latest_stops (
  train_name TEXT NOT NULL,
  station_name TEXT NOT NULL,
  station_num INTEGER NOT NULL,
  arrival_planned_time TIMESTAMPTZ,
  departure_planned_time TIMESTAMPTZ,
  ride_date DATE,
  train_line_ride_id TEXT,
  last_event_time TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (train_name, station_num)
);

CREATE TABLE IF NOT EXISTS de_db_load_state (
  file_name TEXT PRIMARY KEY,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rows_loaded BIGINT NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'de_db_delay_events_long_distance_train_name_chk'
  ) THEN
    ALTER TABLE de_db_delay_events
      ADD CONSTRAINT de_db_delay_events_long_distance_train_name_chk
      CHECK (train_name ~ '^(ICE|IC|EC|EN|RJX|RJ|NJ|ECE)([[:space:]]|$)');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'de_db_train_latest_stops_long_distance_train_name_chk'
  ) THEN
    ALTER TABLE de_db_train_latest_stops
      ADD CONSTRAINT de_db_train_latest_stops_long_distance_train_name_chk
      CHECK (train_name ~ '^(ICE|IC|EC|EN|RJX|RJ|NJ|ECE)([[:space:]]|$)');
  END IF;
END
$$;

-- Keep only primary-key indexes for German railway tables.
