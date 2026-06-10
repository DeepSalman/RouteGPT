import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteLookupSql } from "./routeRepository.js";

test("route lookup SQL supports compact and Bengali stop matching", () => {
  const sql = buildRouteLookupSql();

  assert.match(sql, /origin_stop_name_bn/);
  assert.match(sql, /destination_stop_name_bn/);
  assert.match(sql, /origin_name_compact/);
  assert.match(sql, /destination_name_compact/);
  assert.match(sql, /regexp_replace\(lower/);
});
