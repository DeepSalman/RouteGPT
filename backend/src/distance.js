const DHAKA_SUFFIX = "Dhaka, Bangladesh";
const GOOGLE_DISTANCE_MATRIX_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

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

export { createGoogleDistanceService, normalizePlaceForDistance };
