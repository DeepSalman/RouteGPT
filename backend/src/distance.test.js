import assert from "node:assert/strict";
import test from "node:test";
import { estimateDhakaDistance, normalizePlaceForDistance } from "./distance.js";

test("normalizes distance places to Dhaka by default", () => {
  assert.equal(normalizePlaceForDistance("Gabtoli"), "Gabtoli, Dhaka, Bangladesh");
  assert.equal(normalizePlaceForDistance("Gulshan, Dhaka"), "Gulshan, Dhaka");
});

test("estimates Dhaka distance between known landmarks", () => {
  const distance = estimateDhakaDistance({
    origin: "Gabtoli",
    destination: "Mirpur 1"
  });

  assert.equal(distance.source, "approximate_landmark");
  assert.equal(distance.confidence, "medium");
  assert.ok(distance.distanceKm >= 2);
  assert.ok(distance.durationMin >= 8);
});

test("falls back to a rough estimate for unknown Dhaka text", () => {
  const distance = estimateDhakaDistance({
    origin: "Unknown A",
    destination: "Unknown B"
  });

  assert.equal(distance.source, "rough_text_estimate");
  assert.equal(distance.confidence, "low");
  assert.ok(distance.distanceKm >= 4);
});

test("recognizes no-space Shonir Akhra spelling for estimates", () => {
  const distance = estimateDhakaDistance({
    origin: "shonirakra",
    destination: "gabtoli"
  });

  assert.equal(distance.source, "approximate_landmark");
  assert.equal(distance.confidence, "medium");
});
