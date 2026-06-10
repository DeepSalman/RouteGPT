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

const mockBusRouteDetail = Object.freeze({
  busId: 2,
  busName: "Raida",
  busNameBn: "রাইদা",
  seatingType: "Semi-Seating Service",
  fareRange: null,
  startTime: "06:00 AM",
  endTime: "11:00 PM",
  stops: [
    { order: 1, name: "Postogola", nameBn: "পোস্তগোলা", raw: "Postogola (পোস্তগোলা)" },
    { order: 2, name: "Dholairpar", nameBn: "ধোলাইরপাড়", raw: "Dholairpar (ধোলাইরপাড়)" },
    { order: 3, name: "Jatrabari", nameBn: "যাত্রাবাড়ি", raw: "Jatrabari (যাত্রাবাড়ি)" },
    { order: 4, name: "Airport", nameBn: "বিমানবন্দর", raw: "Airport (বিমানবন্দর)" },
    { order: 5, name: "Dia Bari", nameBn: "দিয়া বাড়ি", raw: "Dia Bari (দিয়া বাড়ি)" }
  ]
});

function createIntentExtractor(intent) {
  return async () => intent;
}

function createRouteRepository(routes = [mockRoute], busRouteDetails = [mockBusRouteDetail]) {
  const calls = [];
  const busRouteCalls = [];

  return {
    calls,
    busRouteCalls,
    async findBusRoutes(input) {
      calls.push(input);
      return routes;
    },
    async findBusRouteByName(input) {
      busRouteCalls.push(input);
      return busRouteDetails;
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

const conversationIntent = Object.freeze({
  intentType: "conversation",
  origin: null,
  destination: null,
  modes: [],
  studentFare: false,
  needsClarification: false,
  clarificationQuestion: null,
  conversationReply: "Hello! Tell me where you want to go."
});

test("greets instead of treating hello as a route query", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("hello", {
    intentExtractor: createIntentExtractor(conversationIntent),
    conversationResponder: null,
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "conversation");
  assert.match(result.reply, /Hello/);
  assert.equal(result.meta.conversationReplySource, "fallback");
  assert.equal(result.cards.length, 0);
  assert.equal(routeRepository.calls.length, 0);
  assert.equal(distanceService.calls.length, 0);
});

test("answers identity questions through the LLM conversation responder", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();
  const responderCalls = [];

  const result = await handleChatMessage("what is your name?", {
    intentExtractor: createIntentExtractor(conversationIntent),
    conversationResponder: async (message, { intent }) => {
      responderCalls.push({ message, intent });
      return {
        reply: "I'm RouteGPT, your Dhaka transport assistant.",
        provider: "gemini",
        model: "gemini-2.5-flash",
        fallbackUsed: false
      };
    },
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "conversation");
  assert.equal(result.reply, "I'm RouteGPT, your Dhaka transport assistant.");
  assert.equal(result.meta.conversationReplySource, "llm");
  assert.equal(result.meta.conversationProvider, "gemini");
  assert.equal(result.meta.conversationModel, "gemini-2.5-flash");
  assert.equal(responderCalls.length, 1);
  assert.equal(responderCalls[0].message, "what is your name?");
  assert.equal(responderCalls[0].intent.intentType, "conversation");
  assert.equal(result.cards.length, 0);
  assert.equal(routeRepository.calls.length, 0);
  assert.equal(distanceService.calls.length, 0);
});

test("accepts a plain-string conversation responder reply", async () => {
  const result = await handleChatMessage("kemon acho?", {
    intentExtractor: createIntentExtractor(conversationIntent),
    conversationResponder: async () => "Bhalo achi! Apni kothay jaben bolen, ami route dekhe dei.",
    routeRepository: createRouteRepository(),
    distanceService: createDistanceService()
  });

  assert.equal(result.type, "conversation");
  assert.equal(result.reply, "Bhalo achi! Apni kothay jaben bolen, ami route dekhe dei.");
  assert.equal(result.meta.conversationReplySource, "llm");
  assert.equal(result.meta.conversationProvider, null);
});

test("falls back to the canned reply when the conversation responder fails", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("hello", {
    intentExtractor: createIntentExtractor(conversationIntent),
    conversationResponder: async () => {
      throw new Error("LLM unavailable");
    },
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "conversation");
  assert.equal(result.reply, "Hello! Tell me where you want to go.");
  assert.equal(result.meta.conversationReplySource, "fallback");
  assert.equal(result.cards.length, 0);
});

test("answers a named bus route request with full ordered stops", async () => {
  const routeRepository = createRouteRepository();
  const distanceService = createDistanceService();

  const result = await handleChatMessage("Raida bus er route bolo", {
    intentExtractor: createIntentExtractor({
      intentType: "bus_route",
      busName: "Raida",
      origin: null,
      destination: null,
      modes: ["bus"],
      studentFare: false,
      needsClarification: false,
      clarificationQuestion: null,
      conversationReply: null
    }),
    routeRepository,
    distanceService
  });

  assert.equal(result.type, "bus_route");
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].type, "bus_route");
  assert.equal(result.cards[0].title, "Raida");
  assert.equal(result.cards[0].stops.length, 5);
  assert.equal(result.cards[0].stops[0].name, "Postogola");
  assert.equal(result.cards[0].stops.at(-1).name, "Dia Bari");
  assert.equal(routeRepository.calls.length, 0);
  assert.equal(routeRepository.busRouteCalls.length, 1);
  assert.deepEqual(routeRepository.busRouteCalls[0], {
    busName: "Raida",
    maxResults: 1
  });
  assert.equal(distanceService.calls.length, 0);
  assert.match(result.reply, /Raida route/);
  assert.match(result.reply, /Postogola/);
  assert.match(result.reply, /Dia Bari/);
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
