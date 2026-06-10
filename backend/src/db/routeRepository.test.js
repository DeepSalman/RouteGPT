import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusRouteDetailSql,
  buildRouteLookupSql
} from "./routeRepository.js";

test("route lookup SQL supports compact and Bengali stop matching", () => {
  const sql = buildRouteLookupSql();

  assert.match(sql, /origin_stop_name_bn/);
  assert.match(sql, /destination_stop_name_bn/);
  assert.match(sql, /origin_name_compact/);
  assert.match(sql, /destination_name_compact/);
  assert.match(sql, /regexp_replace\(lower/);
});

test("bus route detail SQL supports fuzzy bus-name matching and ordered stops", () => {
  const sql = buildBusRouteDetailSql();

  assert.match(sql, /bus_compact/);
  assert.match(sql, /name_bn/);
  assert.match(sql, /bus_stops/);
  assert.match(sql, /json_agg/);
  assert.match(sql, /ORDER BY stop\.stop_order/);
});
