CREATE TABLE IF NOT EXISTS gtfs_agency (
  agency_id TEXT, agency_name TEXT, agency_url TEXT,
  agency_timezone TEXT, agency_lang TEXT, agency_phone TEXT,
  agency_fare_url TEXT, agency_email TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_calendar (
  service_id TEXT, monday TEXT, tuesday TEXT, wednesday TEXT,
  thursday TEXT, friday TEXT, saturday TEXT, sunday TEXT,
  start_date TEXT, end_date TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_calendar_dates (
  service_id TEXT, date TEXT, exception_type TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_routes (
  route_id TEXT, agency_id TEXT, route_short_name TEXT,
  route_long_name TEXT, route_desc TEXT, route_type TEXT,
  route_url TEXT, route_color TEXT, route_text_color TEXT, checkin_duration TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_stops (
  stop_id TEXT, stop_name TEXT, stop_desc TEXT,
  stop_lat TEXT, stop_lon TEXT, zone_id TEXT, stop_url TEXT,
  location_type TEXT, parent_station TEXT, stop_code TEXT,
  stop_timezone TEXT, platform_code TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_stop_times (
  trip_id TEXT, arrival_time TEXT, departure_time TEXT,
  stop_id TEXT, stop_sequence TEXT, stop_headsign TEXT,
  pickup_type TEXT, drop_off_type TEXT, shape_dist_traveled TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_trips (
  route_id TEXT, service_id TEXT, trip_id TEXT,
  trip_headsign TEXT, direction_id TEXT, block_id TEXT,
  shape_id TEXT, trip_short_name TEXT,
  wheelchair_accessible TEXT, train_brand TEXT
);

CREATE TABLE IF NOT EXISTS gtfs_shapes (
  shape_id TEXT, shape_pt_lat TEXT, shape_pt_lon TEXT, shape_pt_sequence TEXT
);

-- Index for the train-name lookup used by /api/trains
CREATE INDEX IF NOT EXISTS idx_trips_prefix ON gtfs_trips(split_part(trip_id, ':', 1));
CREATE INDEX IF NOT EXISTS idx_trips_headsign ON gtfs_trips(trip_headsign);
