import { isKnownDhakaLandmark } from "../distance.js";
import {
  calculateBusFare,
  calculateCngFare,
  estimateAllRideFares
} from "../fares.js";
import { generateConversationReply } from "../llm/conversationReply.js";
import { extractIntent } from "../llm/intentExtraction.js";
import { formatChatReply } from "./responseFormatter.js";

const DISTANCE_MODES = Object.freeze(["cng", "pathao", "uber"]);
const PRIVATE_TRANSPORT_MODES = Object.freeze(["cng", "pathao", "uber"]);
const RIDE_VEHICLE_CLASSES = Object.freeze({
  bike: Object.freeze(["bike", "moto"]),
  car: Object.freeze(["car", "go"])
});

function validateChatMessage(message) {
  if (typeof message !== "string") {
    throw new Error("message must be a string.");
  }

  const trimmed = message.replace(/\s+/g, " ").trim();

  if (!trimmed) {
    throw new Error("message cannot be empty.");
  }

  if (trimmed.length > 1000) {
    throw new Error("message must be 1000 characters or fewer.");
  }

  return trimmed;
}

function shouldFetchDistance(modes) {
  return modes.some((mode) => DISTANCE_MODES.includes(mode));
}

function addPrivateTransportFallbackModes(modes) {
  const requestedModes = Array.isArray(modes) ? modes : [];
  return [...new Set([...requestedModes, ...PRIVATE_TRANSPORT_MODES])];
}

function buildBusCard(route) {
  const fare = calculateBusFare({ stationCount: route.stationCount });

  return {
    type: "bus",
    title: route.busName,
    subtitle: route.seatingType,
    busId: route.busId,
    fare: {
      currency: fare.currency,
      general: fare.generalFare,
      student: fare.studentFare
    },
    route: {
      originStopName: route.originStopName,
      originStopOrder: route.originStopOrder,
      destinationStopName: route.destinationStopName,
      destinationStopOrder: route.destinationStopOrder,
      stationCount: route.stationCount
    },
    operatingHours: {
      start: route.startTime,
      end: route.endTime
    },
    reportAction: {
      label: "Report wrong info",
      payload: {
        busId: route.busId,
        originStopName: route.originStopName,
        destinationStopName: route.destinationStopName
      }
    }
  };
}

function buildBusRouteDetailCard(routeDetail) {
  const stops = Array.isArray(routeDetail.stops) ? routeDetail.stops : [];

  return {
    type: "bus_route",
    title: routeDetail.busName,
    subtitle: routeDetail.seatingType,
    busId: routeDetail.busId,
    stops,
    operatingHours: {
      start: routeDetail.startTime,
      end: routeDetail.endTime
    },
    totalStops: stops.length,
    reportAction: {
      label: "Report wrong info",
      payload: {
        busId: routeDetail.busId,
        busName: routeDetail.busName
      }
    }
  };
}

function buildCngCard(distance, isNightFare = false) {
  const fare = calculateCngFare({
    distanceKm: distance.distanceKm,
    isNight: isNightFare
  });

  return {
    type: "cng",
    title: "CNG",
    fare: {
      currency: fare.currency,
      amount: fare.fare,
      isNight: fare.isNight
    },
    distanceKm: distance.distanceKm,
    durationMin: distance.durationMin
  };
}

function buildRideCards(distance, modes, rideVehicles) {
  if (!modes.includes("pathao") && !modes.includes("uber")) {
    return [];
  }

  const allowedVehicles =
    Array.isArray(rideVehicles) && rideVehicles.length
      ? new Set(rideVehicles.flatMap((vehicleClass) => RIDE_VEHICLE_CLASSES[vehicleClass] || []))
      : null;

  return estimateAllRideFares({ distanceKm: distance.distanceKm })
    .filter((estimate) => modes.includes(estimate.provider))
    .filter((estimate) => !allowedVehicles || allowedVehicles.has(estimate.vehicle))
    .map((estimate) => ({
      type: "ride_hailing",
      provider: estimate.provider,
      vehicle: estimate.vehicle,
      title: estimate.label,
      currency: estimate.currency,
      estimatedFare: estimate.estimatedFare,
      fareRange: estimate.fareRange,
      distanceKm: estimate.distanceKm,
      note: estimate.note
    }));
}

// Distance-based estimates must never be invented for places we cannot
// verify. A place counts as known when it resolves to a Dhaka landmark or
// matches a stop in the database; without a verifying repository we keep the
// permissive legacy behavior.
async function findUnknownPlaces(intent, routeRepository) {
  if (!routeRepository || typeof routeRepository.hasStopMatching !== "function") {
    return [];
  }

  const unknownPlaces = [];

  for (const place of [intent.origin, intent.destination].filter(Boolean)) {
    if (isKnownDhakaLandmark(place)) continue;
    if (await routeRepository.hasStopMatching({ place })) continue;
    unknownPlaces.push(place);
  }

  return unknownPlaces;
}

async function maybeGetDistance({ intent, modes, distanceService }) {
  if (!distanceService || !shouldFetchDistance(modes)) {
    return {
      distance: null,
      distanceError: null
    };
  }

  try {
    const distance = await distanceService.getDistance({
      origin: intent.origin,
      destination: intent.destination
    });

    return {
      distance,
      distanceError: null
    };
  } catch (error) {
    return {
      distance: null,
      distanceError: error.message
    };
  }
}

async function generateLlmConversationReply(conversationResponder, message, intent) {
  if (!conversationResponder) {
    return null;
  }

  try {
    const generated = await conversationResponder(message, { intent });
    const reply = typeof generated === "string" ? generated : generated?.reply;

    if (typeof reply !== "string" || !reply.trim()) {
      return null;
    }

    return {
      reply: reply.trim(),
      provider: (typeof generated === "object" && generated?.provider) || null,
      model: (typeof generated === "object" && generated?.model) || null
    };
  } catch {
    return null;
  }
}

async function handleChatMessage(
  message,
  {
    intentExtractor = extractIntent,
    conversationResponder = generateConversationReply,
    routeRepository,
    distanceService,
    isNightFare = false,
    maxBusResults = 5
  } = {}
) {
  const normalizedMessage = validateChatMessage(message);
  const intent = await intentExtractor(normalizedMessage, { includeMeta: true });

  if (intent.intentType === "conversation") {
    const llmReply = await generateLlmConversationReply(
      conversationResponder,
      normalizedMessage,
      intent
    );
    const fallbackReply = formatChatReply({
      intent,
      busCards: [],
      cngCard: null,
      rideCards: [],
      distance: null
    });

    return {
      ok: true,
      type: "conversation",
      message: normalizedMessage,
      intent,
      reply: llmReply ? llmReply.reply : fallbackReply,
      cards: [],
      results: {
        buses: [],
        cng: null,
        rideHailing: []
      },
      meta: {
        inventedRoutes: false,
        conversationReplySource: llmReply ? "llm" : "fallback",
        conversationProvider: llmReply ? llmReply.provider : null,
        conversationModel: llmReply ? llmReply.model : null
      }
    };
  }

  if (intent.needsClarification) {
    return {
      ok: true,
      type: "clarification",
      message: normalizedMessage,
      intent,
      reply: formatChatReply({
        intent,
        busCards: [],
        cngCard: null,
        rideCards: [],
        distance: null
      }),
      cards: [],
      results: {
        buses: [],
        cng: null,
        rideHailing: []
      }
    };
  }

  if (intent.intentType === "bus_route") {
    const routeDetails =
      routeRepository && typeof routeRepository.findBusRouteByName === "function"
        ? await routeRepository.findBusRouteByName({
            busName: intent.busName,
            maxResults: 1
          })
        : [];
    const busRouteCards = routeDetails.map(buildBusRouteDetailCard);

    return {
      ok: true,
      type: "bus_route",
      message: normalizedMessage,
      intent,
      reply: formatChatReply({
        intent,
        busCards: [],
        busRouteCards,
        cngCard: null,
        rideCards: [],
        distance: null
      }),
      cards: busRouteCards,
      results: {
        buses: [],
        busRoute: busRouteCards[0] || null,
        cng: null,
        rideHailing: []
      },
      meta: {
        busRouteSource: "database",
        inventedRoutes: false
      }
    };
  }

  const routes =
    intent.modes.includes("bus") && routeRepository
      ? await routeRepository.findBusRoutes({
          origin: intent.origin,
          destination: intent.destination,
          maxResults: maxBusResults
        })
      : [];

  if (!routes.length) {
    const unknownPlaces = await findUnknownPlaces(intent, routeRepository);

    if (unknownPlaces.length) {
      const reply = `I couldn't find ${unknownPlaces
        .map((place) => `"${place}"`)
        .join(" or ")} in my route data yet, so I won't guess a fare. Check the spelling or try a nearby area name, like "Gabtoli to Mirpur 1".`;

      return {
        ok: true,
        type: "clarification",
        message: normalizedMessage,
        intent: {
          ...intent,
          needsClarification: true,
          clarificationQuestion: reply
        },
        reply,
        cards: [],
        results: {
          buses: [],
          cng: null,
          rideHailing: []
        },
        meta: {
          inventedRoutes: false,
          unknownPlaces
        }
      };
    }
  }

  const effectiveModes =
    intent.modes.includes("bus") && routes.length === 0
      ? addPrivateTransportFallbackModes(intent.modes)
      : intent.modes;
  const busCards = routes.map(buildBusCard);
  const distanceIntent = busCards.length
    ? {
        ...intent,
        origin: busCards[0].route.originStopName,
        destination: busCards[0].route.destinationStopName
      }
    : intent;
  const { distance, distanceError } = await maybeGetDistance({
    intent: distanceIntent,
    modes: effectiveModes,
    distanceService
  });
  const cngCard =
    distance && effectiveModes.includes("cng") ? buildCngCard(distance, isNightFare) : null;
  const rideCards = distance ? buildRideCards(distance, effectiveModes, intent.rideVehicles) : [];
  const cards = [...busCards, ...(cngCard ? [cngCard] : []), ...rideCards];

  return {
    ok: true,
    type: "answer",
    message: normalizedMessage,
    intent,
    reply: formatChatReply({
      intent,
      busCards,
      cngCard,
      rideCards,
      distance,
      effectiveModes
    }),
    cards,
    results: {
      buses: busCards,
      cng: cngCard,
      rideHailing: rideCards
    },
    meta: {
      distance,
      distanceError,
      fallbackModesAdded: effectiveModes.length !== intent.modes.length,
      busRouteSource: "database",
      inventedRoutes: false
    }
  };
}

export { handleChatMessage, shouldFetchDistance, validateChatMessage };
