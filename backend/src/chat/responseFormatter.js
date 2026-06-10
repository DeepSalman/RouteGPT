function formatMoney(value, currency = "BDT") {
  return `${currency} ${value}`;
}

function formatFareRange(range, currency = "BDT") {
  return `~${currency} ${range.min}-${range.max}`;
}

function formatChatReply({
  intent,
  busCards = [],
  busRouteCards = [],
  cngCard,
  rideCards = [],
  distance,
  effectiveModes = intent.modes
}) {
  if (intent.intentType === "conversation") {
    return (
      intent.conversationReply ||
      "Hello! Tell me your starting point and destination in Dhaka."
    );
  }

  if (intent.needsClarification) {
    return intent.clarificationQuestion;
  }

  if (intent.intentType === "bus_route") {
    const routeCard = busRouteCards[0];

    if (!routeCard) {
      return `I could not find a bus named ${intent.busName} in the database yet.`;
    }

    const stops = Array.isArray(routeCard.stops) ? routeCard.stops : [];
    const lines = [`${routeCard.title} route:`];
    const hourParts = [
      routeCard.operatingHours?.start,
      routeCard.operatingHours?.end
    ].filter(Boolean);

    if (routeCard.subtitle) {
      lines.push(`Type: ${routeCard.subtitle}`);
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

  const lines = [`${intent.origin} to ${intent.destination}:`];

  if (busCards.length) {
    lines.push("", "Bus:");

    for (const [index, card] of busCards.entries()) {
      lines.push(
        `${index + 1}. ${card.title}`,
        `   Fare: ${formatMoney(card.fare.general, card.fare.currency)}, Student: ${formatMoney(
          card.fare.student,
          card.fare.currency
        )}`,
        `   Route: ${card.route.originStopName} -> ${card.route.destinationStopName}`
      );
    }
  } else if (intent.modes.includes("bus")) {
    lines.push(
      "",
      "Bus: No direct database match found for this route yet."
    );
  }

  if (cngCard) {
    lines.push("", `CNG: ${formatMoney(cngCard.fare.amount, cngCard.fare.currency)}`);
  }

  for (const card of rideCards) {
    lines.push(`${card.title}: ${formatFareRange(card.fareRange, card.currency)}`);
  }

  if (distance) {
    lines.push("", `Distance estimate: ${distance.distanceKm} km, ${distance.durationMin} min.`);
  } else if (effectiveModes.some((mode) => ["cng", "pathao", "uber"].includes(mode))) {
    lines.push(
      "",
      "Private transport estimates need a distance lookup, but distance is unavailable right now."
    );
  }

  if (rideCards.length) {
    lines.push("Ride-hailing fares are estimates; actual app fare may vary.");
  }

  return lines.join("\n");
}

export { formatChatReply };
