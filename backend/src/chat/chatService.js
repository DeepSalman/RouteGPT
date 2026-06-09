import {
  calculateBusFare,
  calculateCngFare,
  estimateAllRideFares
} from "../fares.js";
import { extractIntent } from "../llm/intentExtraction.js";
import { formatChatReply } from "./responseFormatter.js";

const DISTANCE_MODES = Object.freeze(["cng", "pathao", "uber"]);

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

function buildRideCards(distance, modes) {
  if (!modes.includes("pathao") && !modes.includes("uber")) {
    return [];
  }

  return estimateAllRideFares({ distanceKm: distance.distanceKm })
    .filter((estimate) => modes.includes(estimate.provider))
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

async function maybeGetDistance({ intent, distanceService }) {
  if (!distanceService || !shouldFetchDistance(intent.modes)) {
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

async function handleChatMessage(
  message,
  {
    intentExtractor = extractIntent,
    routeRepository,
    distanceService,
    isNightFare = false,
    maxBusResults = 5
  } = {}
) {
  const normalizedMessage = validateChatMessage(message);
  const intent = await intentExtractor(normalizedMessage, { includeMeta: true });

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

  const routes =
    intent.modes.includes("bus") && routeRepository
      ? await routeRepository.findBusRoutes({
          origin: intent.origin,
          destination: intent.destination,
          maxResults: maxBusResults
        })
      : [];
  const busCards = routes.map(buildBusCard);
  const { distance, distanceError } = await maybeGetDistance({ intent, distanceService });
  const cngCard =
    distance && intent.modes.includes("cng") ? buildCngCard(distance, isNightFare) : null;
  const rideCards = distance ? buildRideCards(distance, intent.modes) : [];
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
      distance
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
      busRouteSource: "database",
      inventedRoutes: false
    }
  };
}

export { handleChatMessage, shouldFetchDistance, validateChatMessage };
