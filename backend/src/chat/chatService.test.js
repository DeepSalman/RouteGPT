import assert from "node:assert/strict";
import test from "node:test";
import { handleChatMessage, validateChatMessage } from "./chatService.js";

const baseIntent = Object.freeze({
  origin: "Gabtoli",
  destination: "Mirpur 1",
  modes: ["bus"],
  studentFare: false,
  needsClarification: false,
  clarificationQuestion: null,
  meta: {
    provider: "mock",
    model: "mock",
    fallbackUsed: false
  }
});

const mockRoute = Object.freeze({
  busId: 1,
  busName: "Achim Paribahan",
  busNameBn: "আছিম পরিবহন",
  seatingType: "Semi-Seating Service",
  fareRange: null,
  startTime: "06:00 AM",
  endTime: "11:00 PM",
  originStopName: "Gabtoli",
  originStopOrder: 1,
  destinationStopName: "Mirpur 1",
  destinationStopOrder: 4,
  stationCount: 4
});

function createIntentExtractor(intent) {
  return async () => intent;
}

function createRouteRepository(routes = [mockRoute]) {
  const calls = [];

  return {
    calls,
    async findBusRoutes(input) {
      calls.push(input);
      return routes;
    }
  };
}

function createDistanceService(distance = { distanceKm: 5, durationMin: 20 }) {
  const calls = [];

  return {
    calls,
    async getDistance(input) {
      calls.push(input);
      return distance;
    }
  };
}

test("validates chat message body", () => {
  assert.equal(validateChatMessage("  Gabtoli   to Mirpur 1  "), "Gabtoli to Mirpur 1");
  assert.throws(() => validateChatMessage(""), /cannot be empty/);
  assert.throws(() => validateChatMessage(null), /must be a string/);
});

test("answers bus-only route query from database results", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("Gabtoli theke Mirpur 1 bus e jabo", {
    intentExtractor: createIntentExtractor(baseIntent),
    routeRepository,
    distanceService
  });

  assert.equal(result.ok, true);
  assert.equal(result.type, "answer");
  assert.equal(result.results.buses.length, 1);
  assert.equal(result.results.buses[0].title, "Achim Paribahan");
  assert.equal(result.results.buses[0].fare.general, 40);
  assert.equal(result.results.buses[0].fare.student, 20);
  assert.equal(result.results.cng, null);
  assert.deepEqual(result.results.rideHailing, []);
  assert.equal(routeRepository.calls.length, 1);
  assert.equal(distanceService.calls.length, 0);
  assert.equal(result.meta.inventedRoutes, false);
  assert.match(result.reply, /Achim Paribahan/);
});

test("greets instead of treating hello as a route query", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("hello", {
    intentExtractor: createIntentExtractor({
      intentType: "conversation",
      origin: null,
      destination: null,
      modes: [],
      studentFare: false,
      needsClarification: false,
      clarificationQuestion: null,
      conversationReply: "Hello! Tell me where you want to go."
    }),
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "conversation");
  assert.match(result.reply, /Hello/);
  assert.equal(result.cards.length, 0);
  assert.equal(routeRepository.calls.length, 0);
  assert.equal(distanceService.calls.length, 0);
});

test("missing bus route falls back to CNG and ride estimates", async () => {
  const routeRepository = createRouteRepository([]);
  const distanceService = createDistanceService({ distanceKm: 6, durationMin: 26 });

  const result = await handleChatMessage("Unknown A to Unknown B bus", {
    intentExtractor: createIntentExtractor({
      ...baseIntent,
      origin: "Unknown A",
      destination: "Unknown B",
      modes: ["bus"]
    }),
    routeRepository,
    distanceService
  });

  assert.equal(routeRepository.calls.length, 1);
  assert.equal(distanceService.calls.length, 1);
  assert.equal(result.results.buses.length, 0);
  assert.equal(result.results.cng.fare.amount, 110);
  assert.equal(result.results.rideHailing.length, 4);
  assert.equal(result.meta.fallbackModesAdded, true);
  assert.match(result.reply, /No direct database match/);
  assert.match(result.reply, /Pathao Bike/);
});

test("mode filtering skips bus database lookup for cng-only query", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("Gulshan theke Dhanmondi CNG te", {
    intentExtractor: createIntentExtractor({
      ...baseIntent,
      origin: "Gulshan",
      destination: "Dhanmondi",
      modes: ["cng"]
    }),
    routeRepository,
    distanceService
  });

  assert.equal(routeRepository.calls.length, 0);
  assert.equal(distanceService.calls.length, 1);
  assert.equal(result.results.buses.length, 0);
  assert.equal(result.results.cng.fare.amount, 95);
  assert.deepEqual(result.results.rideHailing, []);
});

test("all-mode query returns bus, cng, Pathao, and Uber cards", async () => {
  const result = await handleChatMessage("Mirpur 10 to Motijheel", {
    intentExtractor: createIntentExtractor({
      ...baseIntent,
      origin: "Mirpur 10",
      destination: "Motijheel",
      modes: ["bus", "cng", "pathao", "uber"]
    }),
    routeRepository: createRouteRepository([
      {
        ...mockRoute,
        originStopName: "Mirpur 10",
        originStopOrder: 1,
        destinationStopName: "Motijheel",
        destinationStopOrder: 8,
        stationCount: 8
      }
    ]),
    distanceService: createDistanceService({ distanceKm: 10, durationMin: 38 })
  });

  assert.equal(result.results.buses.length, 1);
  assert.equal(result.results.buses[0].fare.general, 80);
  assert.equal(result.results.cng.fare.amount, 170);
  assert.equal(result.results.rideHailing.length, 4);
  assert.deepEqual(
    result.results.rideHailing.map((card) => card.title).sort(),
    ["Pathao Bike", "Pathao Car", "Uber Go", "Uber Moto"]
  );
});

test("clarification response skips database and distance calls", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("farmgate boss?", {
    intentExtractor: createIntentExtractor({
      ...baseIntent,
      origin: null,
      destination: "Farmgate",
      modes: ["bus", "cng", "pathao", "uber"],
      needsClarification: true,
      clarificationQuestion: "Where are you starting from?"
    }),
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "clarification");
  assert.equal(result.reply, "Where are you starting from?");
  assert.equal(result.cards.length, 0);
  assert.equal(routeRepository.calls.length, 0);
  assert.equal(distanceService.calls.length, 0);
});

test("distance failure still returns database bus results", async () => {
  const result = await handleChatMessage("Mirpur 10 to Motijheel", {
    intentExtractor: createIntentExtractor({
      ...baseIntent,
      origin: "Mirpur 10",
      destination: "Motijheel",
      modes: ["bus", "cng", "pathao", "uber"]
    }),
    routeRepository: createRouteRepository(),
    distanceService: {
      async getDistance() {
        throw new Error("distance quota exceeded");
      }
    }
  });

  assert.equal(result.results.buses.length, 1);
  assert.equal(result.results.cng, null);
  assert.deepEqual(result.results.rideHailing, []);
  assert.equal(result.meta.distanceError, "distance quota exceeded");
});
