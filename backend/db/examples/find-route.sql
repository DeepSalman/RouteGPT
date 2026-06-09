-- Example manual verification query after running:
--   npm run db:schema
--   npm run db:seed

SELECT
  bus_name,
  seating_type,
  origin_stop_name,
  destination_stop_name,
  station_count
FROM bus_route_stop_pairs
WHERE origin_stop_name ILIKE '%Gabtoli%'
  AND destination_stop_name ILIKE '%Mirpur 1%'
ORDER BY station_count ASC, bus_name ASC
LIMIT 20;
