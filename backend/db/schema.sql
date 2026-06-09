BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS buses (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_bn TEXT,
  slug TEXT,
  source_url TEXT,
  seating_type TEXT,
  fare_range TEXT,
  operator TEXT,
  start_time TEXT,
  end_time TEXT,
  ticketing_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT buses_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS buses_slug_unique_idx
  ON buses (slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS buses_source_url_unique_idx
  ON buses (source_url)
  WHERE source_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS buses_name_trgm_idx
  ON buses USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS bus_stops (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  stop_name TEXT NOT NULL,
  stop_name_bn TEXT,
  raw_name TEXT,
  stop_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bus_stops_stop_name_not_blank CHECK (btrim(stop_name) <> ''),
  CONSTRAINT bus_stops_stop_order_positive CHECK (stop_order > 0),
  CONSTRAINT bus_stops_bus_order_unique UNIQUE (bus_id, stop_order)
);

CREATE INDEX IF NOT EXISTS bus_stops_bus_id_idx
  ON bus_stops (bus_id);

CREATE INDEX IF NOT EXISTS bus_stops_bus_id_stop_order_idx
  ON bus_stops (bus_id, stop_order);

CREATE INDEX IF NOT EXISTS bus_stops_stop_name_lower_idx
  ON bus_stops (lower(stop_name));

CREATE INDEX IF NOT EXISTS bus_stops_stop_name_trgm_idx
  ON bus_stops USING GIN (stop_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS bus_stops_stop_name_bn_trgm_idx
  ON bus_stops USING GIN (stop_name_bn gin_trgm_ops)
  WHERE stop_name_bn IS NOT NULL;

CREATE TABLE IF NOT EXISTS landmarks (
  id BIGSERIAL PRIMARY KEY,
  colloquial_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  zone_id TEXT,
  language_code TEXT NOT NULL DEFAULT 'mixed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT landmarks_colloquial_name_not_blank CHECK (btrim(colloquial_name) <> ''),
  CONSTRAINT landmarks_canonical_name_not_blank CHECK (btrim(canonical_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS landmarks_colloquial_canonical_unique_idx
  ON landmarks (lower(colloquial_name), lower(canonical_name));

CREATE INDEX IF NOT EXISTS landmarks_colloquial_name_trgm_idx
  ON landmarks USING GIN (colloquial_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS landmarks_canonical_name_trgm_idx
  ON landmarks USING GIN (canonical_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS route_reports (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT REFERENCES buses(id) ON DELETE SET NULL,
  route_result_id TEXT,
  origin_stop_name TEXT,
  destination_stop_name TEXT,
  user_message TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT route_reports_status_check CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS route_reports_status_created_at_idx
  ON route_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS route_reports_bus_id_idx
  ON route_reports (bus_id)
  WHERE bus_id IS NOT NULL;

CREATE OR REPLACE VIEW bus_route_stop_pairs AS
SELECT
  bus.id AS bus_id,
  bus.name AS bus_name,
  bus.name_bn AS bus_name_bn,
  bus.seating_type,
  bus.fare_range,
  bus.start_time,
  bus.end_time,
  origin.stop_name AS origin_stop_name,
  origin.stop_name_bn AS origin_stop_name_bn,
  origin.stop_order AS origin_stop_order,
  destination.stop_name AS destination_stop_name,
  destination.stop_name_bn AS destination_stop_name_bn,
  destination.stop_order AS destination_stop_order,
  destination.stop_order - origin.stop_order + 1 AS station_count
FROM buses bus
JOIN bus_stops origin
  ON origin.bus_id = bus.id
JOIN bus_stops destination
  ON destination.bus_id = bus.id
 AND destination.stop_order > origin.stop_order;

COMMIT;
