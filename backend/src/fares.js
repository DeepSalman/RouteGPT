const CURRENCY = "BDT";

const DEFAULT_BUS_FARE_POLICY = Object.freeze({
  farePerStation: 10,
  minimumFare: 10,
  studentDiscountRate: 0.5,
  minimumStudentFare: 10
});

const DEFAULT_CNG_FARE_POLICY = Object.freeze({
  baseFare: 50,
  baseKm: 2,
  perKmAfterBase: 15,
  nightSurchargeRate: 0.25
});

const DEFAULT_RIDE_FARE_RATES = Object.freeze({
  pathao: Object.freeze({
    bike: Object.freeze({
      label: "Pathao Bike",
      baseFare: 20,
      perKm: 12,
      minimumFare: 35
    }),
    car: Object.freeze({
      label: "Pathao Car",
      baseFare: 50,
      perKm: 22,
      minimumFare: 80
    })
  }),
  uber: Object.freeze({
    moto: Object.freeze({
      label: "Uber Moto",
      baseFare: 25,
      perKm: 14,
      minimumFare: 40
    }),
    go: Object.freeze({
      label: "Uber Go",
      baseFare: 55,
      perKm: 24,
      minimumFare: 90
    })
  })
});

function assertPositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
}

function assertNonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
}

function roundCurrency(value) {
  return Math.ceil(value);
}

function roundToNearest(value, nearest = 5) {
  assertPositiveNumber(nearest, "nearest");
  return Math.round(value / nearest) * nearest;
}

function calculateStationCount(originStopOrder, destinationStopOrder) {
  assertPositiveNumber(originStopOrder, "originStopOrder");
  assertPositiveNumber(destinationStopOrder, "destinationStopOrder");

  if (!Number.isInteger(originStopOrder) || !Number.isInteger(destinationStopOrder)) {
    throw new Error("Stop orders must be integers.");
  }

  if (destinationStopOrder < originStopOrder) {
    throw new Error("destinationStopOrder must be greater than or equal to originStopOrder.");
  }

  return destinationStopOrder - originStopOrder + 1;
}

function calculateBusFare({
  stationCount,
  originStopOrder,
  destinationStopOrder,
  policy = DEFAULT_BUS_FARE_POLICY
}) {
  const resolvedStationCount =
    stationCount ?? calculateStationCount(originStopOrder, destinationStopOrder);

  assertPositiveNumber(resolvedStationCount, "stationCount");

  if (!Number.isInteger(resolvedStationCount)) {
    throw new Error("stationCount must be an integer.");
  }

  const generalFare = Math.max(
    policy.minimumFare,
    resolvedStationCount * policy.farePerStation
  );
  const studentFare = Math.max(
    policy.minimumStudentFare,
    roundCurrency(generalFare * policy.studentDiscountRate)
  );

  return {
    currency: CURRENCY,
    stationCount: resolvedStationCount,
    generalFare,
    studentFare,
    policy: {
      farePerStation: policy.farePerStation,
      minimumFare: policy.minimumFare,
      studentDiscountRate: policy.studentDiscountRate,
      minimumStudentFare: policy.minimumStudentFare
    }
  };
}

function calculateCngFare({
  distanceKm,
  isNight = false,
  policy = DEFAULT_CNG_FARE_POLICY
}) {
  assertNonNegativeNumber(distanceKm, "distanceKm");

  const extraKm = Math.max(0, distanceKm - policy.baseKm);
  const daytimeFare = policy.baseFare + extraKm * policy.perKmAfterBase;
  const surcharge = isNight ? daytimeFare * policy.nightSurchargeRate : 0;
  const fare = roundCurrency(daytimeFare + surcharge);

  return {
    currency: CURRENCY,
    mode: "cng",
    distanceKm,
    isNight,
    fare,
    daytimeFare: roundCurrency(daytimeFare),
    nightSurcharge: roundCurrency(surcharge),
    policy: {
      baseFare: policy.baseFare,
      baseKm: policy.baseKm,
      perKmAfterBase: policy.perKmAfterBase,
      nightSurchargeRate: policy.nightSurchargeRate
    }
  };
}

function getRideRate(provider, vehicle, rateTable = DEFAULT_RIDE_FARE_RATES) {
  const providerRates = rateTable[provider];

  if (!providerRates) {
    throw new Error(`Unknown ride provider: ${provider}`);
  }

  const rate = providerRates[vehicle];

  if (!rate) {
    throw new Error(`Unknown ${provider} vehicle: ${vehicle}`);
  }

  return rate;
}

function estimateRideFare({
  provider,
  vehicle,
  distanceKm,
  rateTable = DEFAULT_RIDE_FARE_RATES,
  rangePercent = 0.15,
  roundNearest = 5
}) {
  assertNonNegativeNumber(distanceKm, "distanceKm");
  assertNonNegativeNumber(rangePercent, "rangePercent");

  const rate = getRideRate(provider, vehicle, rateTable);
  const rawFare = Math.max(rate.minimumFare, rate.baseFare + distanceKm * rate.perKm);
  const estimatedFare = roundToNearest(rawFare, roundNearest);
  const lowEstimate = Math.max(
    rate.minimumFare,
    roundToNearest(estimatedFare * (1 - rangePercent), roundNearest)
  );
  const highEstimate = Math.max(
    lowEstimate,
    roundToNearest(estimatedFare * (1 + rangePercent), roundNearest)
  );

  return {
    currency: CURRENCY,
    provider,
    vehicle,
    label: rate.label,
    distanceKm,
    estimatedFare,
    fareRange: {
      min: lowEstimate,
      max: highEstimate
    },
    note: "Actual app fare may vary due to traffic, demand, and surge pricing.",
    rate: {
      baseFare: rate.baseFare,
      perKm: rate.perKm,
      minimumFare: rate.minimumFare
    }
  };
}

function estimateAllRideFares({
  distanceKm,
  rateTable = DEFAULT_RIDE_FARE_RATES,
  rangePercent = 0.15,
  roundNearest = 5
}) {
  const estimates = [];

  for (const [provider, providerRates] of Object.entries(rateTable)) {
    for (const vehicle of Object.keys(providerRates)) {
      estimates.push(
        estimateRideFare({
          provider,
          vehicle,
          distanceKm,
          rateTable,
          rangePercent,
          roundNearest
        })
      );
    }
  }

  return estimates;
}

export {
  CURRENCY,
  DEFAULT_BUS_FARE_POLICY,
  DEFAULT_CNG_FARE_POLICY,
  DEFAULT_RIDE_FARE_RATES,
  calculateBusFare,
  calculateCngFare,
  calculateStationCount,
  estimateAllRideFares,
  estimateRideFare
};
