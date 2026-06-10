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

test("route lookup SQL matches shortened first-word place names without crossing numbered stops", () => {
  const sql = buildRouteLookupSql();

  assert.match(sql, /split_part\(lower\(route\.origin_stop_name\), ' ', 1\)/);
  assert.match(sql, /split_part\(lower\(route\.destination_stop_name\), ' ', 1\)/);
  assert.match(sql, /!~ '\[0-9\]'/);
});

test("bus route detail SQL supports fuzzy bus-name matching and ordered stops", () => {
  const sql = buildBusRouteDetailSql();

  assert.match(sql, /bus_compact/);
  assert.match(sql, /name_bn/);
  assert.match(sql, /bus_stops/);
  assert.match(sql, /json_agg/);
  assert.match(sql, /ORDER BY stop\.stop_order/);
});
