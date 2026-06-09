const DEMO_DELAY_MS = 650;
const DEFAULT_DISTANCE = Object.freeze({
  distanceKm: 7.4,
  durationMin: 32
});

const DEMO_ROUTES = Object.freeze([
  {
    patterns: ["gabtoli", "mirpur 1"],
    origin: "Gabtoli",
    destination: "Mirpur 1",
    busName: "Achim Paribahan",
    stationCount: 4
  },
  {
    patterns: ["mirpur 10", "motijheel"],
    origin: "Mirpur 10",
    destination: "Motijheel",
    busName: "Mirpur Link",
    stationCount: 8
  },
  {
    patterns: ["bashundhara", "jatrabari"],
    origin: "Bashundhara",
    destination: "Jatrabari",
    busName: "Victor Classic",
    stationCount: 9
  },
  {
    patterns: ["gulshan", "dhanmondi"],
    origin: "Gulshan",
    destination: "Dhanmondi",
    busName: "Gulshan Chaka",
    stationCount: 7
  },
  {
    patterns: ["farmgate", "uttara"],
    origin: "Farmgate",
    destination: "Uttara",
    busName: "Airport Bangabandhu Avenue",
    stationCount: 9
  },
  {
    patterns: ["mohakhali", "badda"],
    origin: "Mohakhali",
    destination: "Badda",
    busName: "Raida",
    stationCount: 5
  },
  {
    patterns: ["shahbag", "gulistan"],
    origin: "Shahbag",
    destination: "Gulistan",
    busName: "Bihanga",
    stationCount: 4
  },
  {
    patterns: ["khilgaon", "motijheel"],
    origin: "Khilgaon",
    destination: "Motijheel",
    busName: "Midline",
    stationCount: 4
  },
  {
    patterns: ["airport", "gabtoli"],
    origin: "Airport",
    destination: "Gabtoli",
    busName: "Airport Express",
    stationCount: 10
  }
]);

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeMessage(message) {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectModes(normalized) {
  const hasBus = /\bbus\b|bus e|base|buse/.test(normalized);
  const hasCng = /\bcng\b|cng te|cng/.test(normalized);
  const hasPathao = normalized.includes("pathao");
  const hasUber = normalized.includes("uber");
  const modes = [];

  if (hasBus) modes.push("bus");
  if (hasCng) modes.push("cng");
  if (hasPathao) modes.push("pathao");
  if (hasUber) modes.push("uber");

  return modes.length ? modes : ["bus", "cng", "pathao", "uber"];
}

function findDemoRoute(normalized) {
  return DEMO_ROUTES.find((route) =>
    route.patterns.every((pattern) => normalized.includes(pattern))
  );
}

function createBusCard(route, index = 0) {
  const general = Math.max(10, route.stationCount * 10);
  const student = Math.max(10, Math.ceil(general * 0.5));

  return {
    type: "bus",
    title: route.busName,
    subtitle: "Demo route",
    busId: `demo-bus-${index + 1}`,
    fare: {
      currency: "BDT",
      general,
      student
    },
    route: {
      originStopName: route.origin,
      originStopOrder: 1,
      destinationStopName: route.destination,
      destinationStopOrder: route.stationCount,
      stationCount: route.stationCount
    },
    operatingHours: {
      start: null,
      end: null
    },
    reportAction: {
      label: "Report wrong info",
      payload: {
        busId: `demo-bus-${index + 1}`,
        originStopName: route.origin,
        destinationStopName: route.destination
      }
    }
  };
}

function createCngCard(distance = DEFAULT_DISTANCE) {
  const extraKm = Math.max(0, distance.distanceKm - 2);
  const amount = Math.round(50 + extraKm * 15);

  return {
    type: "cng",
    title: "CNG",
    fare: {
      currency: "BDT",
      amount,
      isNight: false
    },
    distanceKm: distance.distanceKm,
    durationMin: distance.durationMin
  };
}

function createRideCards(distance = DEFAULT_DISTANCE, provider) {
  const cards = [];

  if (provider === "pathao" || !provider) {
    cards.push(
      createRideCard({
        provider: "pathao",
        vehicle: "bike",
        title: "Pathao Bike",
        min: 90,
        max: 130,
        distance
      }),
      createRideCard({
        provider: "pathao",
        vehicle: "car",
        title: "Pathao Car",
        min: 210,
        max: 290,
        distance
      })
    );
  }

  if (provider === "uber" || !provider) {
    cards.push(
      createRideCard({
        provider: "uber",
        vehicle: "moto",
        title: "Uber Moto",
        min: 110,
        max: 150,
        distance
      }),
      createRideCard({
        provider: "uber",
        vehicle: "go",
        title: "Uber Go",
        min: 220,
        max: 310,
        distance
      })
    );
  }

  return cards;
}

function createRideCard({ provider, vehicle, title, min, max, distance }) {
  return {
    type: "ride_hailing",
    provider,
    vehicle,
    title,
    currency: "BDT",
    estimatedFare: Math.round((min + max) / 2),
    fareRange: {
      min,
      max
    },
    distanceKm: distance.distanceKm,
    note: "Actual app fare may vary."
  };
}

function createReply({ route, cards, modes }) {
  const lines = [`${route.origin} to ${route.destination}:`];
  const busCard = cards.find((card) => card.type === "bus");

  if (busCard) {
    lines.push(
      "",
      "Bus:",
      `1. ${busCard.title}`,
      `   Fare: BDT ${busCard.fare.general}, Student: BDT ${busCard.fare.student}`,
      `   Route: ${route.origin} -> ${route.destination}`
    );
  } else if (modes.includes("bus")) {
    lines.push("", "Bus: No matching database route found.");
  }

  for (const card of cards) {
    if (card.type === "cng") {
      lines.push("", `CNG: BDT ${card.fare.amount}`);
    }

    if (card.type === "ride_hailing") {
      lines.push(`${card.title}: ~BDT ${card.fareRange.min}-${card.fareRange.max}`);
    }
  }

  if (cards.some((card) => card.type === "ride_hailing")) {
    lines.push("Ride-hailing fares are estimates; actual app fare may vary.");
  }

  return lines.join("\n");
}

function createNoRouteResponse(message) {
  return {
    ok: true,
    type: "answer",
    message,
    intent: {
      origin: "Unknown",
      destination: "Unknown",
      modes: ["bus"]
    },
    reply: "No matching database route found in this hosted demo. Try Gabtoli to Mirpur 1, Mirpur 10 to Motijheel, or Gulshan to Dhanmondi CNG.",
    cards: [],
    results: {
      buses: [],
      cng: null,
      rideHailing: []
    },
    meta: {
      source: "static-demo",
      inventedRoutes: false
    }
  };
}

function createClarificationResponse(message) {
  return {
    ok: true,
    type: "clarification",
    message,
    intent: {
      origin: null,
      destination: "Dhanmondi",
      modes: ["bus", "cng", "pathao", "uber"],
      needsClarification: true,
      clarificationQuestion: "Which Mirpur stop are you starting from?"
    },
    reply: "Which Mirpur stop are you starting from?",
    cards: [],
    results: {
      buses: [],
      cng: null,
      rideHailing: []
    }
  };
}

export async function getDemoChatResponse(message) {
  await wait(DEMO_DELAY_MS);

  const normalized = normalizeMessage(message);

  if (normalized.includes("mirpur") && normalized.includes("dhanmondi")) {
    return createClarificationResponse(message);
  }

  const route = findDemoRoute(normalized);

  if (!route || normalized.includes("mars")) {
    return createNoRouteResponse(message);
  }

  const modes = detectModes(normalized);
  const cards = [];

  if (modes.includes("bus")) {
    cards.push(createBusCard(route));
  }

  if (modes.includes("cng")) {
    cards.push(createCngCard());
  }

  if (modes.includes("pathao")) {
    cards.push(...createRideCards(DEFAULT_DISTANCE, "pathao"));
  }

  if (modes.includes("uber")) {
    cards.push(...createRideCards(DEFAULT_DISTANCE, "uber"));
  }

  return {
    ok: true,
    type: "answer",
    message,
    intent: {
      origin: route.origin,
      destination: route.destination,
      modes
    },
    reply: createReply({ route, cards, modes }),
    cards,
    results: {
      buses: cards.filter((card) => card.type === "bus"),
      cng: cards.find((card) => card.type === "cng") || null,
      rideHailing: cards.filter((card) => card.type === "ride_hailing")
    },
    meta: {
      distance: modes.some((mode) => ["cng", "pathao", "uber"].includes(mode))
        ? DEFAULT_DISTANCE
        : null,
      source: "static-demo",
      inventedRoutes: false
    }
  };
}
