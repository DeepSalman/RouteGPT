const DEFAULT_LIMIT = 10;

function normalizeSearchText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function mapRouteRow(row) {
  return {
    busId: Number(row.bus_id),
    busName: row.bus_name,
    busNameBn: row.bus_name_bn,
    seatingType: row.seating_type,
    fareRange: row.fare_range,
    startTime: row.start_time,
    endTime: row.end_time,
    originStopName: row.origin_stop_name,
    originStopNameBn: row.origin_stop_name_bn,
    originStopOrder: Number(row.origin_stop_order),
    destinationStopName: row.destination_stop_name,
    destinationStopNameBn: row.destination_stop_name_bn,
    destinationStopOrder: Number(row.destination_stop_order),
    stationCount: Number(row.station_count),
    matchScore: row.match_score === null ? null : Number(row.match_score)
  };
}

function buildRouteLookupSql() {
  return `
    WITH
    query_params AS (
      SELECT
        $1::text AS origin_name,
        $2::text AS destination_name,
        regexp_replace(lower($1::text), '[[:space:][:punct:]]+', '', 'g') AS origin_compact,
        regexp_replace(lower($2::text), '[[:space:][:punct:]]+', '', 'g') AS destination_compact
    ),
    origin_aliases AS (
      SELECT
        name,
        regexp_replace(lower(name), '[[:space:][:punct:]]+', '', 'g') AS compact_name
      FROM (
        SELECT origin_name AS name
        FROM query_params
        UNION
        SELECT canonical_name
        FROM landmarks, query_params
        WHERE lower(colloquial_name) = lower(origin_name)
           OR colloquial_name ILIKE '%' || origin_name || '%'
           OR origin_name ILIKE '%' || colloquial_name || '%'
           OR regexp_replace(lower(colloquial_name), '[[:space:][:punct:]]+', '', 'g') = origin_compact
           OR (
             length(origin_compact) >= 5
             AND similarity(
               regexp_replace(lower(colloquial_name), '[[:space:][:punct:]]+', '', 'g'),
               origin_compact
             ) > 0.55
           )
           OR similarity(colloquial_name, origin_name) > 0.45
      ) aliases
    ),
    destination_aliases AS (
      SELECT
        name,
        regexp_replace(lower(name), '[[:space:][:punct:]]+', '', 'g') AS compact_name
      FROM (
        SELECT destination_name AS name
        FROM query_params
        UNION
        SELECT canonical_name
        FROM landmarks, query_params
        WHERE lower(colloquial_name) = lower(destination_name)
           OR colloquial_name ILIKE '%' || destination_name || '%'
           OR destination_name ILIKE '%' || colloquial_name || '%'
           OR regexp_replace(lower(colloquial_name), '[[:space:][:punct:]]+', '', 'g') = destination_compact
           OR (
             length(destination_compact) >= 5
             AND similarity(
               regexp_replace(lower(colloquial_name), '[[:space:][:punct:]]+', '', 'g'),
               destination_compact
             ) > 0.55
           )
           OR similarity(colloquial_name, destination_name) > 0.45
      ) aliases
    ),
    searchable_routes AS (
      SELECT
        route.*,
        regexp_replace(lower(coalesce(route.origin_stop_name, '')), '[[:space:][:punct:]]+', '', 'g') AS origin_name_compact,
        regexp_replace(lower(coalesce(route.origin_stop_name_bn, '')), '[[:space:][:punct:]]+', '', 'g') AS origin_name_bn_compact,
        regexp_replace(lower(coalesce(route.destination_stop_name, '')), '[[:space:][:punct:]]+', '', 'g') AS destination_name_compact,
        regexp_replace(lower(coalesce(route.destination_stop_name_bn, '')), '[[:space:][:punct:]]+', '', 'g') AS destination_name_bn_compact
      FROM bus_route_stop_pairs route
    ),
    matched_routes AS (
      SELECT
        route.*,
        GREATEST(
          similarity(route.origin_stop_name, origin_aliases.name),
          similarity(coalesce(route.origin_stop_name_bn, ''), origin_aliases.name),
          similarity(route.origin_name_compact, origin_aliases.compact_name),
          similarity(route.origin_name_bn_compact, origin_aliases.compact_name),
          CASE
            WHEN lower(route.origin_stop_name) = lower(origin_aliases.name) THEN 1
            WHEN lower(coalesce(route.origin_stop_name_bn, '')) = lower(origin_aliases.name) THEN 1
            WHEN route.origin_name_compact = origin_aliases.compact_name THEN 0.95
            WHEN route.origin_name_bn_compact = origin_aliases.compact_name THEN 0.95
            WHEN route.origin_stop_name ILIKE '%' || origin_aliases.name || '%' THEN 0.85
            WHEN coalesce(route.origin_stop_name_bn, '') ILIKE '%' || origin_aliases.name || '%' THEN 0.85
            WHEN origin_aliases.name ILIKE '%' || route.origin_stop_name || '%' THEN 0.85
            ELSE 0
          END
        ) +
        GREATEST(
          similarity(route.destination_stop_name, destination_aliases.name),
          similarity(coalesce(route.destination_stop_name_bn, ''), destination_aliases.name),
          similarity(route.destination_name_compact, destination_aliases.compact_name),
          similarity(route.destination_name_bn_compact, destination_aliases.compact_name),
          CASE
            WHEN lower(route.destination_stop_name) = lower(destination_aliases.name) THEN 1
            WHEN lower(coalesce(route.destination_stop_name_bn, '')) = lower(destination_aliases.name) THEN 1
            WHEN route.destination_name_compact = destination_aliases.compact_name THEN 0.95
            WHEN route.destination_name_bn_compact = destination_aliases.compact_name THEN 0.95
            WHEN route.destination_stop_name ILIKE '%' || destination_aliases.name || '%' THEN 0.85
            WHEN coalesce(route.destination_stop_name_bn, '') ILIKE '%' || destination_aliases.name || '%' THEN 0.85
            WHEN destination_aliases.name ILIKE '%' || route.destination_stop_name || '%' THEN 0.85
            ELSE 0
          END
        ) AS match_score
      FROM searchable_routes route
      JOIN origin_aliases
        ON lower(route.origin_stop_name) = lower(origin_aliases.name)
        OR lower(coalesce(route.origin_stop_name_bn, '')) = lower(origin_aliases.name)
        OR route.origin_stop_name ILIKE '%' || origin_aliases.name || '%'
        OR coalesce(route.origin_stop_name_bn, '') ILIKE '%' || origin_aliases.name || '%'
        OR origin_aliases.name ILIKE '%' || route.origin_stop_name || '%'
        OR route.origin_name_compact = origin_aliases.compact_name
        OR route.origin_name_bn_compact = origin_aliases.compact_name
        OR (
          length(origin_aliases.compact_name) >= 5
          AND (
            similarity(route.origin_name_compact, origin_aliases.compact_name) > 0.55
            OR similarity(route.origin_name_bn_compact, origin_aliases.compact_name) > 0.55
          )
        )
        OR similarity(route.origin_stop_name, origin_aliases.name) > 0.35
        OR similarity(coalesce(route.origin_stop_name_bn, ''), origin_aliases.name) > 0.35
      JOIN destination_aliases
        ON lower(route.destination_stop_name) = lower(destination_aliases.name)
        OR lower(coalesce(route.destination_stop_name_bn, '')) = lower(destination_aliases.name)
        OR route.destination_stop_name ILIKE '%' || destination_aliases.name || '%'
        OR coalesce(route.destination_stop_name_bn, '') ILIKE '%' || destination_aliases.name || '%'
        OR destination_aliases.name ILIKE '%' || route.destination_stop_name || '%'
        OR route.destination_name_compact = destination_aliases.compact_name
        OR route.destination_name_bn_compact = destination_aliases.compact_name
        OR (
          length(destination_aliases.compact_name) >= 5
          AND (
            similarity(route.destination_name_compact, destination_aliases.compact_name) > 0.55
            OR similarity(route.destination_name_bn_compact, destination_aliases.compact_name) > 0.55
          )
        )
        OR similarity(route.destination_stop_name, destination_aliases.name) > 0.35
        OR similarity(coalesce(route.destination_stop_name_bn, ''), destination_aliases.name) > 0.35
    )
    SELECT DISTINCT ON (bus_id, origin_stop_order, destination_stop_order)
      bus_id,
      bus_name,
      bus_name_bn,
      seating_type,
      fare_range,
      start_time,
      end_time,
      origin_stop_name,
      origin_stop_name_bn,
      origin_stop_order,
      destination_stop_name,
      destination_stop_name_bn,
      destination_stop_order,
      station_count,
      match_score
    FROM matched_routes
    ORDER BY
      bus_id,
      origin_stop_order,
      destination_stop_order,
      match_score DESC,
      station_count ASC
    LIMIT $3
  `;
}

function createRouteRepository({ query, limit = DEFAULT_LIMIT }) {
  if (typeof query !== "function") {
    throw new Error("createRouteRepository requires a query function.");
  }

  return {
    async findBusRoutes({ origin, destination, maxResults = limit }) {
      const normalizedOrigin = normalizeSearchText(origin);
      const normalizedDestination = normalizeSearchText(destination);

      if (!normalizedOrigin || !normalizedDestination) {
        return [];
      }

      const result = await query(buildRouteLookupSql(), [
        normalizedOrigin,
        normalizedDestination,
        maxResults
      ]);

      return result.rows.map(mapRouteRow);
    }
  };
}

export { buildRouteLookupSql, createRouteRepository };
