import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBusFare,
  calculateCngFare,
  calculateStationCount,
  estimateAllRideFares,
  estimateRideFare
} from "./fares.js";

test("calculates station count inclusively from stop order", () => {
  assert.equal(calculateStationCount(1, 4), 4);
  assert.equal(calculateStationCount(7, 7), 1);
});

test("calculates Gabtoli to Mirpur 1 bus fare from stop order", () => {
  const fare = calculateBusFare({
    originStopOrder: 1,
    destinationStopOrder: 4
  });

  assert.equal(fare.stationCount, 4);
  assert.equal(fare.generalFare, 40);
  assert.equal(fare.studentFare, 20);
  assert.equal(fare.currency, "BDT");
});

test("keeps bus and student fares at minimum fare for one station", () => {
  const fare = calculateBusFare({ stationCount: 1 });

  assert.equal(fare.generalFare, 10);
  assert.equal(fare.studentFare, 10);
});

test("rejects reverse direction bus fare calculation", () => {
  assert.throws(
    () =>
      calculateBusFare({
        originStopOrder: 4,
        destinationStopOrder: 1
      }),
    /destinationStopOrder/
  );
});

test("calculates CNG fare with minimum first 2 km", () => {
  const fare = calculateCngFare({ distanceKm: 1.5 });

  assert.equal(fare.fare, 50);
  assert.equal(fare.daytimeFare, 50);
  assert.equal(fare.nightSurcharge, 0);
});

test("calculates CNG fare beyond base distance", () => {
  const fare = calculateCngFare({ distanceKm: 5 });

  assert.equal(fare.fare, 95);
  assert.equal(fare.daytimeFare, 95);
});

test("applies CNG night surcharge", () => {
  const fare = calculateCngFare({ distanceKm: 5, isNight: true });

  assert.equal(fare.fare, 119);
  assert.equal(fare.daytimeFare, 95);
  assert.equal(fare.nightSurcharge, 24);
});

test("estimates Pathao Bike fare from configurable rate table", () => {
  const estimate = estimateRideFare({
    provider: "pathao",
    vehicle: "bike",
    distanceKm: 5
  });

  assert.equal(estimate.label, "Pathao Bike");
  assert.equal(estimate.estimatedFare, 80);
  assert.deepEqual(estimate.fareRange, {
    min: 70,
    max: 90
  });
});

test("estimates Uber Go fare from configurable rate table", () => {
  const estimate = estimateRideFare({
    provider: "uber",
    vehicle: "go",
    distanceKm: 10
  });

  assert.equal(estimate.label, "Uber Go");
  assert.equal(estimate.estimatedFare, 295);
  assert.deepEqual(estimate.fareRange, {
    min: 250,
    max: 340
  });
});

test("supports custom ride-hailing rate table", () => {
  const estimate = estimateRideFare({
    provider: "demo",
    vehicle: "bike",
    distanceKm: 4,
    rangePercent: 0,
    rateTable: {
      demo: {
        bike: {
          label: "Demo Bike",
          baseFare: 10,
          perKm: 10,
          minimumFare: 20
        }
      }
    }
  });

  assert.equal(estimate.label, "Demo Bike");
  assert.equal(estimate.estimatedFare, 50);
  assert.deepEqual(estimate.fareRange, {
    min: 50,
    max: 50
  });
});

test("estimates all configured ride fares", () => {
  const estimates = estimateAllRideFares({ distanceKm: 3 });
  const labels = estimates.map((estimate) => estimate.label).sort();

  assert.equal(estimates.length, 4);
  assert.deepEqual(labels, ["Pathao Bike", "Pathao Car", "Uber Go", "Uber Moto"]);
});
