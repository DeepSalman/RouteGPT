function formatMoney(value, currency = "BDT") {
  return `${currency} ${value}`;
}

function formatFareRange(range, currency = "BDT") {
  return `~${currency} ${range.min}-${range.max}`;
}

function formatChatReply({ intent, busCards, cngCard, rideCards, distance }) {
  if (intent.needsClarification) {
    return intent.clarificationQuestion;
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
    lines.push("", "Bus: No matching database route found.");
  }

  if (cngCard) {
    lines.push("", `CNG: ${formatMoney(cngCard.fare.amount, cngCard.fare.currency)}`);
  }

  for (const card of rideCards) {
    lines.push(`${card.title}: ${formatFareRange(card.fareRange, card.currency)}`);
  }

  if (distance) {
    lines.push("", `Distance estimate: ${distance.distanceKm} km, ${distance.durationMin} min.`);
  }

  if (rideCards.length) {
    lines.push("Ride-hailing fares are estimates; actual app fare may vary.");
  }

  return lines.join("\n");
}

export { formatChatReply };
