import { STATIC_BUS_ROUTES } from "./data/staticBusRoutes.js";

const DEMO_DELAY_MS = 650;
const DEFAULT_DISTANCE = Object.freeze({
  distanceKm: 7.4,
  durationMin: 32
});
const BANGLA_RANGE = /[\u0980-\u09FF]/u;
const DEMO_AVERAGE_SPEED_KMPH = 14;
const DEMO_ROAD_FACTOR = 1.35;
const DEMO_LANDMARKS = Object.freeze({
  airport: [23.8516, 90.4086],
  badda: [23.7808, 90.426],
  banani: [23.7937, 90.4043],
  bashundhara: [23.819, 90.452],
  dhanmondi: [23.7465, 90.376],
  farmgate: [23.7563, 90.389],
  gabtoli: [23.783, 90.344],
  gulistan: [23.725, 90.411],
  gulshan: [23.7925, 90.4078],
  "jamuna future park": [23.813, 90.424],
  jatrabari: [23.7104, 90.434],
  khilgaon: [23.75, 90.426],
  kuril: [23.821, 90.421],
  mirpur: [23.807, 90.368],
  "mirpur 1": [23.8006, 90.353],
  "mirpur 10": [23.807, 90.368],
  mohakhali: [23.7776, 90.405],
  motijheel: [23.7337, 90.4173],
  rampura: [23.763, 90.421],
  shahbag: [23.738, 90.395],
  "shonir akhra": [23.704, 90.457],
  uttara: [23.8759, 90.3795]
});
const DEMO_RIDE_RATES = Object.freeze({
  pathao: Object.freeze({
    bike: Object.freeze({ label: "Pathao Bike", baseFare: 20, perKm: 12, minimumFare: 35 }),
    car: Object.freeze({ label: "Pathao Car", baseFare: 50, perKm: 22, minimumFare: 80 })
  }),
  uber: Object.freeze({
    moto: Object.freeze({ label: "Uber Moto", baseFare: 25, perKm: 14, minimumFare: 40 }),
    go: Object.freeze({ label: "Uber Go", baseFare: 55, perKm: 24, minimumFare: 90 })
  })
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

function isGreetingMessage(normalized) {
  return [
    "hi",
    "hello",
    "hey",
    "salam",
    "assalamualaikum",
    "assalamu alaikum",
    "good morning",
    "good afternoon",
    "good evening"
  ].includes(normalized.replace(/[^a-z0-9\s]/g, "").trim());
}

const DEMO_EXAMPLES_HINT =
  'Try "Gabtoli to Mirpur 1", "Raida bus er route bolo", or "Gulshan to Dhanmondi CNG".';

const DEMO_GENERAL_CHAT_REPLY =
  "Good question! This live demo runs on static route data without a live AI model, so I keep general chat short — the full RouteGPT answers freely. What I'm great at here is Dhaka transport. " +
  DEMO_EXAMPLES_HINT;

function getDemoConversationReply(normalized) {
  const compact = normalized
    .replace(/[^a-z0-9ঀ-৿\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (isGreetingMessage(normalized)) {
    return (
      "Hello! I'm RouteGPT, your Dhaka transport assistant. Tell me where you're starting and " +
      'where you want to go — for example "Gabtoli to Mirpur 1" — and I\'ll check bus routes ' +
      "plus CNG, Pathao, and Uber estimates."
    );
  }

  if (
    /(?:\b(?:your|ur)\s+name\b|\bt[ou]ma?r\s+na+me?\b|\bapna?r\s+na+me?\b|\btum[ie]\s+ke\b|\bke\s+tum[ie]\b|\bapni\s+ke\b|\bwho\s+(?:are|r)\s+(?:you|u)\b|\bwhat\s+are\s+(?:you|u)\b|\bintroduce\s+yourself\b)/.test(
      compact
    ) ||
    /তোমার নাম|আপনার নাম|তুমি কে|আপনি কে/.test(normalized)
  ) {
    return (
      "I'm RouteGPT — a Dhaka transport assistant. I find bus routes from local route data, " +
      "calculate bus and student fares, and estimate CNG, Pathao, and Uber costs. " +
      "Tell me where you're starting and where you want to go!"
    );
  }

  if (
    /\bwho\s+(?:made|built|created)\s+(?:you|u)\b|\bke\s+(?:baniyeche|banaise|banalo)\b/.test(compact) ||
    /কে বানিয়েছে|কে তৈরি করেছে/.test(normalized)
  ) {
    return (
      "I was built as RouteGPT, an open project that turns Dhaka's informal transport knowledge " +
      "into a structured assistant. Ask me a route and I'll show you how it works!"
    );
  }

  if (
    /\bhow\s+(?:are|r)\s+(?:you|u)\b|\bkemon\s+a(?:ch|s)(?:o|en|os|is)\b/.test(compact) ||
    /কেমন আছো|কেমন আছেন/.test(normalized)
  ) {
    return (
      "I'm doing great, thanks for asking! Ready whenever you are — tell me your starting point " +
      "and destination and I'll find the best way there."
    );
  }

  if (
    /\b(?:thank\s+(?:you|u)|thanks|thx|tnx|dhonnobad|dhonnyobad|dhonobad|dhonnobaad|dhanyabad)\b/.test(
      compact
    ) ||
    /ধন্যবাদ/.test(normalized)
  ) {
    return "You're welcome! Safe travels — and ask me anytime you need another Dhaka route.";
  }

  if (/^(?:help|what can you do|how does this work|ki korte paro)\??$/.test(normalized)) {
    return `I can help with Dhaka route questions. ${DEMO_EXAMPLES_HINT}`;
  }

  return null;
}

function looksLikeGeneralChat(normalized) {
  const hasRouteSignal =
    /\b(?:to|from|theke|bus|cng|pathao|uber|route|fare|vara|bhara|jabo|jete|koto|stop|stand|station)\b|থেকে|হতে|টু|বাস|সিএনজি|পাঠাও|উবার|রুট|ভাড়া|যাব|যাবো|কত/.test(
      normalized
    );

  if (hasRouteSignal) {
    return false;
  }

  return (
    normalized.includes("?") ||
    /^(?:what|who|why|when|where|which|how|can|could|will|would|do|does|did|are|is|am|tell|say|sing|write|explain|define|describe|give|make|create)\b/.test(
      normalized
    ) ||
    /কি|কী|কে|কেন|কিভাবে|কীভাবে/.test(normalized)
  );
}

function cleanPlaceName(value) {
  const cleaned = String(value || "")
    .replace(/^(?:how\s+(?:do|can)\s+i\s+(?:go|get)|how\s+to\s+(?:go|get)|route|student\s+fare\s+koto|fare\s+koto|from|ami|i|আমি|আমার|আমাকে|কিভাবে|কীভাবে)\s+/i, "")
    .replace(/(?:\b(?:bus|base|buse|local|cng|pathao|uber|bike|car|moto|go|diye|using|public\s+transport|jabo|jete\s+chai|lagbe|fare|koto|please|pls|e|te)\b|(?:বাস|সিএনজি|পাঠাও|উবার|বাইক|কার|মোটো|যাবো|যাব|যেতে\s+চাই|লাগবে|ভাড়া|ভাড়া|কত|দিয়ে|দিয়ে)).*$/i, "")
    .replace(/^(?:from|theke|to|থেকে|হতে|টু)\s+/i, "")
    .replace(/\s+(?:from|theke|to|থেকে|হতে|টু)$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned
    .split(" ")
    .map((part) => (/^[0-9]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join(" ");
}

function cleanDemoBusName(value) {
  const cleaned = String(value || "")
    .replace(
      /^(?:show|tell|give|bolo|dao|dekhao|\u09A6\u09C7\u0996\u09BE\u0993|\u09AC\u09B2\u09CB|\u09A6\u09BE\u0993)\s+/i,
      ""
    )
    .replace(
      /(?:\b(?:bus|route|full|entire|er|of|show|tell|give|bolo|dao|dekhao|please|pls)\b|(?:\u09AC\u09BE\u09B8|\u09AC\u09BE\u09B8\u09C7\u09B0|\u09B0\u09C1\u099F|\u098F\u09B0|\u09AA\u09C1\u09B0\u09BE|\u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3|\u09AC\u09B2\u09CB|\u09AC\u09B2\u09C1\u09A8|\u09A6\u09BE\u0993|\u09A6\u09C7\u0996\u09BE\u0993))/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  if (BANGLA_RANGE.test(cleaned)) {
    return cleaned;
  }

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseBusRouteQuery(message) {
  const text = String(message || "").replace(/\s+/g, " ").trim();

  if (!text) return null;

  if (/\b(?:from|to|theke)\b|\u09A5\u09C7\u0995\u09C7|\u09B9\u09A4\u09C7|\u099F\u09C1/i.test(text)) {
    return null;
  }

  const patterns = [
    /(?:route\s+of|\u09B0\u09C1\u099F)\s+(.+?)(?:\s+bus|\s+\u09AC\u09BE\u09B8)?$/i,
    /(.+?)\s+(?:bus|\u09AC\u09BE\u09B8|\u09AC\u09BE\u09B8\u09C7\u09B0)(?:\s*(?:er|\u098F\u09B0))?\s+(?:route|\u09B0\u09C1\u099F)/i,
    /(.+?)\s+(?:er|\u098F\u09B0)\s+(?:route|\u09B0\u09C1\u099F)/i,
    /(.+?)\s+(?:route|\u09B0\u09C1\u099F)\s+(?:bolo|dao|show|dekhao|\u09AC\u09B2\u09CB|\u09AC\u09B2\u09C1\u09A8|\u09A6\u09BE\u0993|\u09A6\u09C7\u0996\u09BE\u0993)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const busName = cleanDemoBusName(match[1]);
    if (busName) return busName;
  }

  return null;
}

function parseRouteFromMessage(message) {
  const text = message.replace(/\s+/g, " ").trim();
  const patterns = [
    /\bfrom\s+(.+?)\s+to\s+(.+)/i,
    /(.+?)\s+(?:theke|to|থেকে|হতে|টু)\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const origin = cleanPlaceName(match[1]);
    const destination = cleanPlaceName(match[2]);

    if (origin && destination && origin.toLowerCase() !== destination.toLowerCase()) {
      return {
        origin,
        destination
      };
    }
  }

  return null;
}

function detectModes(normalized) {
  const hasBus = /\bbus\b|bus e|base|buse|বাস/.test(normalized);
  const hasCng = /\bcng\b|cng te|cng|সিএনজি/.test(normalized);
  const hasPathao = normalized.includes("pathao") || normalized.includes("পাঠাও");
  const hasUber = normalized.includes("uber") || normalized.includes("উবার");
  const modes = [];

  if (hasBus) modes.push("bus");
  if (hasCng) modes.push("cng");
  if (hasPathao) modes.push("pathao");
  if (hasUber) modes.push("uber");

  return modes.length ? modes : ["bus", "cng", "pathao", "uber"];
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(dhaka|bangladesh)\b|ঢাকা|বাংলাদেশ/g, " ")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/[/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLookupText(value) {
  return normalizeLookupText(value).replace(/\s+/g, "");
}

function looseLatinLookupText(value) {
  return compactLookupText(value)
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c");
}

function getLookupVariants(value) {
  const normalized = normalizeLookupText(value);
  const compact = compactLookupText(value);
  const looseLatin = looseLatinLookupText(value);
  return [...new Set([normalized, compact, looseLatin].filter(Boolean))];
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function isCloseLookupMatch(term, value) {
  if (!term || !value) return false;
  if (term === value || term.includes(value) || value.includes(term)) return true;

  const shortest = Math.min(term.length, value.length);
  if (shortest < 5) return false;

  const allowedDistance = shortest >= 9 ? 2 : 1;
  return editDistance(term, value) <= allowedDistance;
}

function buildLookupTerms(place) {
  const normalized = normalizeLookupText(place);
  const aliases = {
    "biman bandar": "airport",
    "dhaka airport": "airport",
    "hazrat shahjalal airport": "airport",
    "shahjalal airport": "airport",
    "mirpur one": "mirpur 1",
    "mirpur ten": "mirpur 10",
    "mirpur eleven": "mirpur 11",
    "mirpur twelve": "mirpur 12"
  };
  const terms = [normalized, aliases[normalized]].flatMap(getLookupVariants);
  return [...new Set(terms)];
}

// Users often shorten multi-word places to the leading word ("kuril" for
// "Kuril Bishwa Road" or "Kuril Chourasta"). Digits stay significant so
// "Mirpur 1" never crosses over to "Mirpur 10".
function firstWordsEquivalent(a, b) {
  if (!a || !b || /\d/.test(a) || /\d/.test(b)) return false;

  const firstA = a.split(" ")[0];
  const firstB = b.split(" ")[0];
  return firstA.length >= 5 && firstA === firstB;
}

function stopMatches(stop, terms) {
  const values = [stop.name, stop.nameBn, stop.raw].flatMap(getLookupVariants);

  if (terms.some((term) => values.some((value) => isCloseLookupMatch(term, value)))) {
    return true;
  }

  const stopNames = [stop.name, stop.nameBn].map(normalizeLookupText).filter(Boolean);
  return terms.some((term) => stopNames.some((value) => firstWordsEquivalent(term, value)));
}

function findStaticBusRoutes(origin, destination, maxResults = 5) {
  const originTerms = buildLookupTerms(origin);
  const destinationTerms = buildLookupTerms(destination);
  const matches = [];

  if (!originTerms.length || !destinationTerms.length) return matches;

  for (const bus of STATIC_BUS_ROUTES) {
    const stops = bus.stops || [];
    const originIndexes = stops
      .map((stop, index) => (stopMatches(stop, originTerms) ? index : -1))
      .filter((index) => index >= 0);

    for (const originIndex of originIndexes) {
      const destinationIndex = stops.findIndex(
        (stop, index) => index > originIndex && stopMatches(stop, destinationTerms)
      );

      if (destinationIndex === -1) continue;

      const originStop = stops[originIndex];
      const destinationStop = stops[destinationIndex];

      matches.push({
        origin: originStop.name,
        destination: destinationStop.name,
        originStopName: originStop.name,
        originStopOrder: originStop.order,
        destinationStopName: destinationStop.name,
        destinationStopOrder: destinationStop.order,
        busName: bus.name,
        slug: bus.slug,
        seatingType: bus.seatingType,
        operatingHours: bus.operatingHours || {},
        stationCount: destinationIndex - originIndex + 1
      });
      break;
    }
  }

  return matches
    .sort((a, b) => a.stationCount - b.stationCount || a.busName.localeCompare(b.busName))
    .slice(0, maxResults);
}

function scoreLookupMatch(term, value) {
  if (!term || !value) return 0;
  if (term === value) return 100;
  if (term.length >= 3 && (term.includes(value) || value.includes(term))) return 80;
  if (isCloseLookupMatch(term, value)) return 60;
  return 0;
}

function findStaticBusByName(busName) {
  const terms = getLookupVariants(busName);

  if (!terms.length) return null;

  const matches = STATIC_BUS_ROUTES
    .map((bus) => {
      const values = [
        bus.name,
        bus.nameBn,
        bus.slug,
        String(bus.slug || "").replace(/-?bus-?route.*$/i, "")
      ].flatMap(getLookupVariants);
      const score = Math.max(
        0,
        ...terms.flatMap((term) => values.map((value) => scoreLookupMatch(term, value)))
      );

      return { bus, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.bus.name.localeCompare(b.bus.name));

  return matches[0]?.bus || null;
}

function findDemoRoute(normalized) {
  return DEMO_ROUTES.find((route) =>
    route.patterns.every((pattern) => normalized.includes(pattern))
  );
}

function normalizeLandmarkKey(place) {
  return String(place || "")
    .toLowerCase()
    .replace(/\b(dhaka|bangladesh)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/[/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLandmark(place) {
  const key = normalizeLandmarkKey(place);
  if (!key) return null;
  if (DEMO_LANDMARKS[key]) return DEMO_LANDMARKS[key];

  const terms = getLookupVariants(key);
  const match = Object.keys(DEMO_LANDMARKS)
    .filter((candidate) =>
      terms.some((term) =>
        getLookupVariants(candidate).some((value) => isCloseLookupMatch(term, value))
      )
    )
    .sort((a, b) => b.length - a.length)[0];

  return match ? DEMO_LANDMARKS[match] : null;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function hashText(value) {
  return String(value || "")
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function estimateDemoDistance(origin, destination) {
  const originCoordinates = resolveLandmark(origin);
  const destinationCoordinates = resolveLandmark(destination);
  let distanceKm;

  if (originCoordinates && destinationCoordinates) {
    distanceKm = haversineKm(originCoordinates, destinationCoordinates) * DEMO_ROAD_FACTOR + 0.8;
  } else {
    const seed = Math.abs(hashText(origin) - hashText(destination));
    distanceKm = 4 + (seed % 130) / 10;
  }

  const roundedDistance = Math.max(1, Math.round(distanceKm * 10) / 10);

  return {
    distanceKm: roundedDistance,
    durationMin: Math.max(8, Math.round((roundedDistance / DEMO_AVERAGE_SPEED_KMPH) * 60))
  };
}

function createBusCard(route, index = 0) {
  const general = Math.max(10, route.stationCount * 10);
  const student = Math.max(10, Math.ceil(general * 0.5));

  return {
    type: "bus",
    title: route.busName,
    subtitle: route.seatingType || "Bus route",
    busId: route.slug || `demo-bus-${index + 1}`,
    fare: {
      currency: "BDT",
      general,
      student
    },
    route: {
      originStopName: route.originStopName || route.origin,
      originStopOrder: route.originStopOrder || 1,
      destinationStopName: route.destinationStopName || route.destination,
      destinationStopOrder: route.destinationStopOrder || route.stationCount,
      stationCount: route.stationCount
    },
    operatingHours: {
      start: route.operatingHours?.start || null,
      end: route.operatingHours?.end || null
    },
    reportAction: {
      label: "Report wrong info",
      payload: {
        busId: route.slug || `demo-bus-${index + 1}`,
        originStopName: route.originStopName || route.origin,
        destinationStopName: route.destinationStopName || route.destination
      }
    }
  };
}

function createBusRouteDetailCard(bus) {
  const stops = Array.isArray(bus.stops) ? bus.stops : [];

  return {
    type: "bus_route",
    title: bus.name,
    subtitle: bus.seatingType || "Bus route",
    busId: bus.slug,
    stops,
    operatingHours: {
      start: bus.operatingHours?.start || null,
      end: bus.operatingHours?.end || null
    },
    totalStops: stops.length,
    reportAction: {
      label: "Report wrong info",
      payload: {
        busId: bus.slug,
        busName: bus.name
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

function roundToNearest(value, nearest = 5) {
  return Math.round(value / nearest) * nearest;
}

function createRideCards(distance = DEFAULT_DISTANCE, provider) {
  const cards = [];

  if (provider === "pathao" || !provider) {
    cards.push(
      createRideCard({
        provider: "pathao",
        vehicle: "bike",
        rate: DEMO_RIDE_RATES.pathao.bike,
        distance
      }),
      createRideCard({
        provider: "pathao",
        vehicle: "car",
        rate: DEMO_RIDE_RATES.pathao.car,
        distance
      })
    );
  }

  if (provider === "uber" || !provider) {
    cards.push(
      createRideCard({
        provider: "uber",
        vehicle: "moto",
        rate: DEMO_RIDE_RATES.uber.moto,
        distance
      }),
      createRideCard({
        provider: "uber",
        vehicle: "go",
        rate: DEMO_RIDE_RATES.uber.go,
        distance
      })
    );
  }

  return cards;
}

function createRideCard({ provider, vehicle, rate, distance }) {
  const estimatedFare = roundToNearest(
    Math.max(rate.minimumFare, rate.baseFare + distance.distanceKm * rate.perKm)
  );
  const min = Math.max(rate.minimumFare, roundToNearest(estimatedFare * 0.85));
  const max = Math.max(min, roundToNearest(estimatedFare * 1.15));

  return {
    type: "ride_hailing",
    provider,
    vehicle,
    title: rate.label,
    currency: "BDT",
    estimatedFare,
    fareRange: {
      min,
      max
    },
    distanceKm: distance.distanceKm,
    note: "Actual app fare may vary."
  };
}

function createReply({ route, cards, modes, distance }) {
  const lines = [`${route.origin} to ${route.destination}:`];
  const busCards = cards.filter((card) => card.type === "bus");

  if (busCards.length) {
    lines.push("", "Bus:");

    for (const [index, busCard] of busCards.entries()) {
      lines.push(
        `${index + 1}. ${busCard.title}`,
        `   Fare: BDT ${busCard.fare.general}, Student: BDT ${busCard.fare.student}`,
        `   Route: ${busCard.route.originStopName} -> ${busCard.route.destinationStopName}`
      );
    }
  } else if (modes.includes("bus")) {
    lines.push("", "Bus: No direct database match found for this route yet.");
  }

  for (const card of cards) {
    if (card.type === "cng") {
      lines.push("", `CNG: BDT ${card.fare.amount}`);
    }

    if (card.type === "ride_hailing") {
      lines.push(`${card.title}: ~BDT ${card.fareRange.min}-${card.fareRange.max}`);
    }
  }

  if (distance && cards.some((card) => card.type === "cng" || card.type === "ride_hailing")) {
    lines.push("", `Distance estimate: ${distance.distanceKm} km, ${distance.durationMin} min.`);
  }

  if (cards.some((card) => card.type === "ride_hailing")) {
    lines.push("Ride-hailing fares are estimates; actual app fare may vary.");
  }

  return lines.join("\n");
}

function createBusRouteDetailReply(card) {
  const stops = Array.isArray(card.stops) ? card.stops : [];
  const lines = [`${card.title} route:`];
  const hourParts = [card.operatingHours?.start, card.operatingHours?.end].filter(Boolean);

  if (card.subtitle) {
    lines.push(`Type: ${card.subtitle}`);
  }

  if (hourParts.length) {
    lines.push(`Hours: ${hourParts.join(" - ")}`);
  }

  lines.push("", stops.map((stop) => stop.name).filter(Boolean).join(" -> "));

  if (stops.length) {
    lines.push("", `${stops.length} stops total.`);
  }

  return lines.join("\n");
}

function createBusRouteDetailResponse(message, requestedBusName) {
  const bus = findStaticBusByName(requestedBusName);
  const intent = {
    intentType: "bus_route",
    busName: requestedBusName,
    origin: null,
    destination: null,
    modes: ["bus"],
    needsClarification: false
  };

  if (!bus) {
    return {
      ok: true,
      type: "bus_route",
      message,
      intent,
      reply: `I could not find a bus named ${requestedBusName} in the database yet.`,
      cards: [],
      results: {
        buses: [],
        busRoute: null,
        cng: null,
        rideHailing: []
      },
      meta: {
        source: "static-demo",
        inventedRoutes: false
      }
    };
  }

  const card = createBusRouteDetailCard(bus);

  return {
    ok: true,
    type: "bus_route",
    message,
    intent: {
      ...intent,
      busName: bus.name
    },
    reply: createBusRouteDetailReply(card),
    cards: [card],
    results: {
      buses: [],
      busRoute: card,
      cng: null,
      rideHailing: []
    },
    meta: {
      source: "static-demo",
      inventedRoutes: false
    }
  };
}

function createNoRouteResponse(message) {
  return {
    ok: true,
    type: "clarification",
    message,
    intent: {
      origin: null,
      destination: null,
      modes: ["bus", "cng", "pathao", "uber"],
      needsClarification: true,
      clarificationQuestion: "Tell me your starting point and destination, for example: Gabtoli to Mirpur 1."
    },
    reply: "Tell me your starting point and destination, for example: Gabtoli to Mirpur 1.",
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

function createConversationResponse(
  message,
  reply = "Hello! Tell me your starting point and destination in Dhaka, and I can check bus routes plus CNG, Pathao, and Uber estimates."
) {
  return {
    ok: true,
    type: "conversation",
    message,
    intent: {
      intentType: "conversation",
      origin: null,
      destination: null,
      modes: [],
      needsClarification: false
    },
    reply,
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
  const busRouteQuery = parseBusRouteQuery(message);
  const conversationReply =
    busRouteQuery || parseRouteFromMessage(message) ? null : getDemoConversationReply(normalized);

  if (conversationReply) {
    return createConversationResponse(message, conversationReply);
  }

  if (busRouteQuery) {
    return createBusRouteDetailResponse(message, busRouteQuery);
  }

  if (
    normalized.includes("mirpur") &&
    normalized.includes("dhanmondi") &&
    !/\bmirpur\s+\d+\b/.test(normalized)
  ) {
    return createClarificationResponse(message);
  }

  const parsedRoute = parseRouteFromMessage(message);
  const staticBusRoutes = parsedRoute
    ? findStaticBusRoutes(parsedRoute.origin, parsedRoute.destination)
    : [];
  const demoRoute = staticBusRoutes.length ? null : findDemoRoute(normalized);
  const route =
    (staticBusRoutes.length
      ? {
          origin: staticBusRoutes[0].originStopName,
          destination: staticBusRoutes[0].destinationStopName
        }
      : null) ||
    demoRoute ||
    (parsedRoute
      ? {
          ...parsedRoute,
          busName: null,
          stationCount: null
        }
      : null);

  if (!route || normalized.includes("mars")) {
    if (!normalized.includes("mars") && looksLikeGeneralChat(normalized)) {
      return createConversationResponse(message, DEMO_GENERAL_CHAT_REPLY);
    }

    return createNoRouteResponse(message);
  }

  const busRoutes = staticBusRoutes.length ? staticBusRoutes : demoRoute ? [demoRoute] : [];
  const hasBusMatch = busRoutes.length > 0;
  const requestedModes = detectModes(normalized);
  const modes =
    requestedModes.includes("bus") && !hasBusMatch
      ? [...new Set([...requestedModes, "cng", "pathao", "uber"])]
      : requestedModes;
  const distance = estimateDemoDistance(route.origin, route.destination);
  const cards = [];

  if (modes.includes("bus") && hasBusMatch) {
    cards.push(...busRoutes.map((busRoute, index) => createBusCard(busRoute, index)));
  }

  if (modes.includes("cng")) {
    cards.push(createCngCard(distance));
  }

  if (modes.includes("pathao")) {
    cards.push(...createRideCards(distance, "pathao"));
  }

  if (modes.includes("uber")) {
    cards.push(...createRideCards(distance, "uber"));
  }

  return {
    ok: true,
    type: "answer",
    message,
    intent: {
      origin: route.origin,
      destination: route.destination,
      modes,
      needsClarification: false
    },
    reply: createReply({ route, cards, modes, distance }),
    cards,
    results: {
      buses: cards.filter((card) => card.type === "bus"),
      cng: cards.find((card) => card.type === "cng") || null,
      rideHailing: cards.filter((card) => card.type === "ride_hailing")
    },
    meta: {
      distance: modes.some((mode) => ["cng", "pathao", "uber"].includes(mode))
        ? distance
        : null,
      fallbackModesAdded: requestedModes.length !== modes.length,
      source: "static-demo",
      inventedRoutes: false
    }
  };
}
