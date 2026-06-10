const DHAKA_SUFFIX = "Dhaka, Bangladesh";
const GOOGLE_DISTANCE_MATRIX_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const DHAKA_AVERAGE_SPEED_KMPH = 14;
const DHAKA_ROAD_FACTOR = 1.35;

const DHAKA_LANDMARKS = Object.freeze({
  agargaon: [23.778, 90.379],
  airport: [23.8516, 90.4086],
  "asad gate": [23.7606, 90.3722],
  azimpur: [23.7294, 90.3856],
  badda: [23.7808, 90.426],
  banani: [23.7937, 90.4043],
  banasree: [23.763, 90.438],
  basabo: [23.741, 90.432],
  bashundhara: [23.819, 90.452],
  "bashundhara r/a": [23.819, 90.452],
  "baily road": [23.7415, 90.4078],
  demra: [23.719, 90.489],
  "ecb square": [23.822, 90.391],
  farmgate: [23.7563, 90.389],
  gabtoli: [23.783, 90.344],
  gulistan: [23.725, 90.411],
  gulshan: [23.7925, 90.4078],
  "hatirjheel": [23.766, 90.416],
  jatrabari: [23.7104, 90.434],
  "jamuna future park": [23.813, 90.424],
  kakrail: [23.737, 90.408],
  kalshi: [23.822, 90.38],
  kallyanpur: [23.779, 90.361],
  kazipara: [23.797, 90.371],
  khilgaon: [23.75, 90.426],
  kuril: [23.821, 90.421],
  lalbagh: [23.719, 90.386],
  malibagh: [23.746, 90.412],
  "mirpur 1": [23.8006, 90.353],
  "mirpur 2": [23.806, 90.36],
  "mirpur 10": [23.807, 90.368],
  "mirpur 11": [23.818, 90.367],
  "mirpur 12": [23.824, 90.365],
  mohakhali: [23.7776, 90.405],
  mohammadpur: [23.765, 90.358],
  moghbazar: [23.748, 90.402],
  motijheel: [23.7337, 90.4173],
  "new market": [23.733, 90.383],
  nilkhet: [23.733, 90.386],
  pallabi: [23.825, 90.364],
  paltan: [23.735, 90.41],
  "press club": [23.73, 90.406],
  purobi: [23.818, 90.364],
  rampura: [23.763, 90.421],
  "science lab": [23.738, 90.383],
  sadarghat: [23.709, 90.407],
  shahbag: [23.738, 90.395],
  shantinagar: [23.738, 90.414],
  "shonir akhra": [23.704, 90.457],
  shewrapara: [23.79, 90.374],
  shewra: [23.79, 90.424],
  shyamoli: [23.774, 90.365],
  technical: [23.781, 90.352],
  tejgaon: [23.7615, 90.4],
  uttara: [23.8759, 90.3795],
  wari: [23.711, 90.416]
});

const DHAKA_LANDMARK_ALIASES = Object.freeze({
  "hazrat shahjalal airport": "airport",
  "shahjalal airport": "airport",
  "dhaka airport": "airport",
  "bashundhara residential area": "bashundhara",
  "bashundhara ra": "bashundhara",
  "bashundhara r a": "bashundhara",
  "jamuna future": "jamuna future park",
  jfp: "jamuna future park",
  "mirpur one": "mirpur 1",
  "mirpur-1": "mirpur 1",
  "mirpur ten": "mirpur 10",
  "mirpur-10": "mirpur 10",
  "mirpur eleven": "mirpur 11",
  "mirpur-11": "mirpur 11",
  "mirpur twelve": "mirpur 12",
  "mirpur-12": "mirpur 12",
  "kolyanpur": "kallyanpur",
  "kalyanpur": "kallyanpur",
  "asadgate": "asad gate",
  "science laboratory": "science lab",
  "dhaka university": "shahbag",
  "du": "shahbag",
  "old dhaka": "sadarghat"
});

function normalizePlaceForDistance(place) {
  const value = String(place || "").replace(/\s+/g, " ").trim();

  if (!value) {
    throw new Error("Distance place is required.");
  }

  if (/dhaka|bangladesh/i.test(value)) {
    return value;
  }

  return `${value}, ${DHAKA_SUFFIX}`;
}

function metersToKm(meters) {
  return Math.round((meters / 1000) * 100) / 100;
}

function secondsToMinutes(seconds) {
  return Math.round(seconds / 60);
}

function roundDistance(distanceKm) {
  return Math.max(1, Math.round(distanceKm * 10) / 10);
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

function compactLandmarkKey(place) {
  return normalizeLandmarkKey(place).replace(/\s+/g, "");
}

function looseLatinLandmarkKey(place) {
  return compactLandmarkKey(place)
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c");
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

function scoreLandmarkMatch(inputKey, candidateKey) {
  const inputCompact = compactLandmarkKey(inputKey);
  const candidateCompact = compactLandmarkKey(candidateKey);
  const inputLoose = looseLatinLandmarkKey(inputKey);
  const candidateLoose = looseLatinLandmarkKey(candidateKey);

  if (!inputCompact || !candidateCompact) return 0;
  if (inputKey === candidateKey) return 1;
  if (inputCompact === candidateCompact) return 0.98;
  if (inputLoose === candidateLoose) return 0.96;
  if (inputKey.includes(candidateKey) || candidateKey.includes(inputKey)) return 0.9;
  if (inputCompact.includes(candidateCompact) || candidateCompact.includes(inputCompact)) {
    return 0.88;
  }

  const shortest = Math.min(inputCompact.length, candidateCompact.length);
  if (shortest < 5) return 0;

  const allowedDistance = shortest >= 9 ? 2 : 1;
  const distance = Math.min(
    editDistance(inputCompact, candidateCompact),
    editDistance(inputLoose, candidateLoose)
  );

  if (distance <= allowedDistance) {
    return 0.82 - distance * 0.05;
  }

  return 0;
}

function resolveLandmark(place) {
  const normalized = normalizeLandmarkKey(place);
  if (!normalized) return null;

  const compact = compactLandmarkKey(normalized);
  const looseLatin = looseLatinLandmarkKey(normalized);
  const alias =
    DHAKA_LANDMARK_ALIASES[normalized] ||
    DHAKA_LANDMARK_ALIASES[compact] ||
    DHAKA_LANDMARK_ALIASES[looseLatin] ||
    normalized;
  if (DHAKA_LANDMARKS[alias]) {
    return {
      name: alias,
      coordinates: DHAKA_LANDMARKS[alias]
    };
  }

  const matches = Object.keys(DHAKA_LANDMARKS)
    .map((key) => ({
      key,
      score: scoreLandmarkMatch(normalized, key)
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.key.length - a.key.length);

  if (!matches.length) return null;

  const key = matches[0].key;
  return {
    name: key,
    coordinates: DHAKA_LANDMARKS[key]
  };
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

function estimateTextDistanceKm(origin, destination) {
  const seed = Math.abs(hashText(origin) - hashText(destination));
  return roundDistance(4 + (seed % 130) / 10);
}

function estimateDhakaDistance({ origin, destination }) {
  const originLandmark = resolveLandmark(origin);
  const destinationLandmark = resolveLandmark(destination);
  let distanceKm;
  let source;

  if (originLandmark && destinationLandmark) {
    const straightLineKm = haversineKm(
      originLandmark.coordinates,
      destinationLandmark.coordinates
    );
    distanceKm = roundDistance(straightLineKm * DHAKA_ROAD_FACTOR + 0.8);
    source = "approximate_landmark";
  } else {
    distanceKm = estimateTextDistanceKm(origin, destination);
    source = "rough_text_estimate";
  }

  return {
    origin,
    destination,
    distanceKm,
    durationMin: Math.max(
      8,
      Math.round((distanceKm / DHAKA_AVERAGE_SPEED_KMPH) * 60)
    ),
    source,
    confidence: source === "approximate_landmark" ? "medium" : "low"
  };
}

function createGoogleDistanceService({
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required for distance lookup.");
  }

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required for distance lookup.");
  }

  return {
    async getDistance({ origin, destination }) {
      const url = new URL(GOOGLE_DISTANCE_MATRIX_URL);
      url.searchParams.set("origins", normalizePlaceForDistance(origin));
      url.searchParams.set("destinations", normalizePlaceForDistance(destination));
      url.searchParams.set("units", "metric");
      url.searchParams.set("key", apiKey);

      const response = await fetchImpl(url);
      const responseBody = await response.json();

      if (!response.ok || responseBody.status !== "OK") {
        throw new Error(
          `Distance Matrix API error: ${response.status} ${responseBody.status || ""}`.trim()
        );
      }

      const element = responseBody.rows?.[0]?.elements?.[0];

      if (!element || element.status !== "OK") {
        throw new Error(`Distance Matrix route error: ${element?.status || "missing route"}`);
      }

      return {
        origin: responseBody.origin_addresses?.[0] || origin,
        destination: responseBody.destination_addresses?.[0] || destination,
        distanceKm: metersToKm(element.distance.value),
        durationMin: secondsToMinutes(element.duration.value),
        raw: {
          distanceText: element.distance.text,
          durationText: element.duration.text
        }
      };
    }
  };
}

function createApproximateDistanceService() {
  return {
    async getDistance({ origin, destination }) {
      return estimateDhakaDistance({ origin, destination });
    }
  };
}

export {
  createApproximateDistanceService,
  createGoogleDistanceService,
  estimateDhakaDistance,
  normalizePlaceForDistance
};
