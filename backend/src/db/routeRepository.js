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
    origin_aliases AS (
      SELECT $1::text AS name
      UNION
      SELECT canonical_name
      FROM landmarks
      WHERE lower(colloquial_name) = lower($1)
         OR colloquial_name ILIKE '%' || $1 || '%'
         OR similarity(colloquial_name, $1) > 0.45
    ),
    destination_aliases AS (
      SELECT $2::text AS name
      UNION
      SELECT canonical_name
      FROM landmarks
      WHERE lower(colloquial_name) = lower($2)
         OR colloquial_name ILIKE '%' || $2 || '%'
         OR similarity(colloquial_name, $2) > 0.45
    ),
    matched_routes AS (
      SELECT
        route.*,
        GREATEST(
          similarity(route.origin_stop_name, origin_aliases.name),
          CASE
            WHEN route.origin_stop_name ILIKE '%' || origin_aliases.name || '%' THEN 0.85
            WHEN origin_aliases.name ILIKE '%' || route.origin_stop_name || '%' THEN 0.85
            ELSE 0
          END
        ) +
        GREATEST(
          similarity(route.destination_stop_name, destination_aliases.name),
          CASE
            WHEN route.destination_stop_name ILIKE '%' || destination_aliases.name || '%' THEN 0.85
            WHEN destination_aliases.name ILIKE '%' || route.destination_stop_name || '%' THEN 0.85
            ELSE 0
          END
        ) AS match_score
      FROM bus_route_stop_pairs route
      JOIN origin_aliases
        ON lower(route.origin_stop_name) = lower(origin_aliases.name)
        OR route.origin_stop_name ILIKE '%' || origin_aliases.name || '%'
        OR origin_aliases.name ILIKE '%' || route.origin_stop_name || '%'
        OR similarity(route.origin_stop_name, origin_aliases.name) > 0.35
      JOIN destination_aliases
        ON lower(route.destination_stop_name) = lower(destination_aliases.name)
        OR route.destination_stop_name ILIKE '%' || destination_aliases.name || '%'
        OR destination_aliases.name ILIKE '%' || route.destination_stop_name || '%'
        OR similarity(route.destination_stop_name, destination_aliases.name) > 0.35
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
