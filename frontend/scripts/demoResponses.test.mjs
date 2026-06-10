import assert from "node:assert/strict";
import test from "node:test";

// demoResponses.js runs in the browser; give it the one window API it uses.
globalThis.window = { setTimeout: (fn) => setTimeout(fn, 0) };

const { getDemoChatResponse } = await import("../src/demoResponses.js");

test("greets with the RouteGPT persona", async () => {
  const result = await getDemoChatResponse("hello");

  assert.equal(result.type, "conversation");
  assert.match(result.reply, /I'm RouteGPT/);
  assert.equal(result.cards.length, 0);
});

test("answers identity questions instead of asking for a route", async () => {
  for (const message of ["what is your name?", "Tomar naam ki", "who are you?"]) {
    const result = await getDemoChatResponse(message);

    assert.equal(result.type, "conversation", `expected conversation for ${message}`);
    assert.match(result.reply, /RouteGPT/);
    assert.match(result.reply, /bus routes/i);
  }
});

test("understands Banglish typo variants of identity questions", async () => {
  for (const message of ["Tomar nam ki", "tumar naam ki?", "tomar name ki", "who r u"]) {
    const result = await getDemoChatResponse(message);

    assert.equal(result.type, "conversation", `expected conversation for ${message}`);
    assert.match(result.reply, /RouteGPT/);
  }
});

test("answers creator questions", async () => {
  const result = await getDemoChatResponse("Who made you?");

  assert.equal(result.type, "conversation");
  assert.match(result.reply, /built as RouteGPT/);
});

test("responds to thanks and small talk", async () => {
  const thanks = await getDemoChatResponse("thanks");
  assert.equal(thanks.type, "conversation");
  assert.match(thanks.reply, /welcome/i);

  const wellbeing = await getDemoChatResponse("how are you?");
  assert.equal(wellbeing.type, "conversation");
  assert.match(wellbeing.reply, /doing great/i);

  const banglishWellbeing = await getDemoChatResponse("kemon aso?");
  assert.equal(banglishWellbeing.type, "conversation");
  assert.match(banglishWellbeing.reply, /doing great/i);
});

test("handles unusual general questions conversationally", async () => {
  for (const message of ["tell me a joke", "what is the capital of france?"]) {
    const result = await getDemoChatResponse(message);

    assert.equal(result.type, "conversation", `expected conversation for ${message}`);
    assert.match(result.reply, /static route data/);
    assert.equal(result.cards.length, 0);
  }
});

test("still answers a direct bus route query", async () => {
  const result = await getDemoChatResponse("Gabtoli to Mirpur 1");

  assert.equal(result.type, "answer");
  assert.ok(result.results.buses.length > 0, "expected bus results");
  assert.match(result.reply, /Gabtoli to Mirpur 1/);
});

test("still returns a named bus full route", async () => {
  const result = await getDemoChatResponse("Raida bus er route bolo");

  assert.equal(result.type, "bus_route");
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].type, "bus_route");
  assert.ok(result.cards[0].stops.length > 5, "expected the full Raida stop list");
});

test("matches shortened stop names like kuril", async () => {
  const result = await getDemoChatResponse("kuril to airport bus");

  assert.equal(result.type, "answer");
  assert.ok(result.results.buses.length > 0, "expected bus results for kuril");
  assert.match(result.results.buses[0].route.originStopName, /^Kuril/);
});

test("matches sibling variants of multi-word stop names by first word", async () => {
  const result = await getDemoChatResponse("kuril flyover to airport bus");

  assert.equal(result.type, "answer");
  assert.ok(result.results.buses.length > 0, "expected bus results for kuril flyover");
  assert.match(result.results.buses[0].route.originStopName, /^Kuril/);
});

test("still estimates CNG fares", async () => {
  const result = await getDemoChatResponse("Gulshan to Dhanmondi CNG");

  assert.equal(result.type, "answer");
  assert.ok(result.results.cng, "expected a CNG card");
});

test("still asks clarification for ambiguous Mirpur queries", async () => {
  const result = await getDemoChatResponse("mirpur to dhanmondi");

  assert.equal(result.type, "clarification");
  assert.match(result.reply, /Which Mirpur stop/);
});

test("route-shaped nonsense still gets the route clarification", async () => {
  for (const message of ["Dhaka to Mars", "asdfgh qwerty"]) {
    const result = await getDemoChatResponse(message);

    assert.equal(result.type, "clarification", `expected clarification for ${message}`);
    assert.match(result.reply, /starting point and destination/);
  }
});
