import assert from "node:assert/strict";
import test from "node:test";
import {
  extractIntent,
  normalizeIntentPayload,
  parseIntentJson
} from "./intentExtraction.js";

function createMockClient({ provider = "gemini", model = "mock-model", responses = [] }) {
  const calls = [];

  return {
    provider,
    model,
    calls,
    async generateText(input) {
      calls.push(input);

      if (!responses.length) {
        throw new Error(`${provider} mock has no response left.`);
      }

      const response = responses.shift();

      if (response instanceof Error) {
        throw response;
      }

      return response;
    }
  };
}

test("parses JSON from a fenced model response", () => {
  const parsed = parseIntentJson(`
    \`\`\`json
    {"origin":"Gabtoli","destination":"Mirpur 1","modes":["bus"]}
    \`\`\`
  `);

  assert.equal(parsed.origin, "Gabtoli");
  assert.equal(parsed.destination, "Mirpur 1");
  assert.deepEqual(parsed.modes, ["bus"]);
});

test("normalizes missing modes to all supported modes", () => {
  const intent = normalizeIntentPayload({
    origin: "Mirpur 10",
    destination: "Motijheel",
    modes: [],
    studentFare: false,
    needsClarification: false,
    clarificationQuestion: null
  });

  assert.deepEqual(intent.modes, ["bus", "cng", "pathao", "uber"]);
});

test("classifies a greeting locally without calling an LLM", async () => {
  const primaryClient = createMockClient({
    responses: [new Error("should not be called")]
  });

  const intent = await extractIntent("hello", {
    primaryClient,
    includeMeta: true
  });

  assert.equal(intent.intentType, "conversation");
  assert.equal(intent.needsClarification, false);
  assert.match(intent.conversationReply, /Hello/);
  assert.equal(intent.meta.provider, "local");
  assert.equal(primaryClient.calls.length, 0);
});

test("uses local route parsing when providers are unavailable", async () => {
  const intent = await extractIntent("Bashundhara theke Jatrabari bus e jabo", {
    includeMeta: true
  });

  assert.equal(intent.intentType, "route");
  assert.equal(intent.origin, "Bashundhara");
  assert.equal(intent.destination, "Jatrabari");
  assert.deepEqual(intent.modes, ["bus"]);
  assert.equal(intent.meta.provider, "local");
});

test("parses no-space Shonir Akhra spelling locally", async () => {
  const intent = await extractIntent("shonirakra to gabtoli bus", {
    includeMeta: true
  });

  assert.equal(intent.origin, "Shonirakra");
  assert.equal(intent.destination, "Gabtoli");
  assert.deepEqual(intent.modes, ["bus"]);
});

test("parses Bengali route separators locally", async () => {
  const intent = await extractIntent("শনিরআখরা থেকে গাবতলি বাস", {
    includeMeta: true
  });

  assert.equal(intent.origin, "শনিরআখরা");
  assert.equal(intent.destination, "গাবতলি");
  assert.deepEqual(intent.modes, ["bus"]);
});

test("extracts Banglish bus intent with Gemini primary", async () => {
  const primaryClient = createMockClient({
    responses: [
      JSON.stringify({
        origin: "Gabtoli",
        destination: "Mirpur 1",
        modes: ["bus"],
        studentFare: false,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("Gabtoli theke Mirpur 1 bus e jabo", {
    primaryClient,
    includeMeta: true
  });

  assert.equal(intent.origin, "Gabtoli");
  assert.equal(intent.destination, "Mirpur 1");
  assert.deepEqual(intent.modes, ["bus"]);
  assert.equal(intent.studentFare, false);
  assert.equal(intent.needsClarification, false);
  assert.equal(intent.meta.provider, "gemini");
});

test("extracts Bengali CNG intent", async () => {
  const primaryClient = createMockClient({
    responses: [
      JSON.stringify({
        origin: "Gulshan",
        destination: "Dhanmondi",
        modes: ["cng"],
        studentFare: false,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("গুলশান থেকে ধানমন্ডি সিএনজি", {
    primaryClient
  });

  assert.equal(intent.origin, "Gulshan");
  assert.equal(intent.destination, "Dhanmondi");
  assert.deepEqual(intent.modes, ["cng"]);
});

test("extracts English all-mode intent when no mode is mentioned", async () => {
  const primaryClient = createMockClient({
    responses: [
      JSON.stringify({
        origin: "Mirpur 10",
        destination: "Motijheel",
        modes: ["bus", "cng", "pathao", "uber"],
        studentFare: false,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("Mirpur 10 to Motijheel", {
    primaryClient
  });

  assert.equal(intent.origin, "Mirpur 10");
  assert.equal(intent.destination, "Motijheel");
  assert.deepEqual(intent.modes, ["bus", "cng", "pathao", "uber"]);
});

test("detects student fare intent", async () => {
  const primaryClient = createMockClient({
    responses: [
      JSON.stringify({
        origin: "Gabtoli",
        destination: "Mirpur 1",
        modes: ["bus"],
        studentFare: true,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("Student fare koto Gabtoli to Mirpur 1 bus?", {
    primaryClient
  });

  assert.equal(intent.studentFare, true);
  assert.deepEqual(intent.modes, ["bus"]);
});

test("missing origin triggers clarification", async () => {
  const primaryClient = createMockClient({
    responses: [
      JSON.stringify({
        origin: null,
        destination: "Farmgate",
        modes: ["bus", "cng", "pathao", "uber"],
        studentFare: false,
        needsClarification: true,
        clarificationQuestion: "Where are you starting from?"
      })
    ]
  });

  const intent = await extractIntent("farmgate boss?", {
    primaryClient
  });

  assert.equal(intent.origin, null);
  assert.equal(intent.destination, "Farmgate");
  assert.equal(intent.needsClarification, true);
  assert.equal(intent.clarificationQuestion, "Where are you starting from?");
});

test("retries once when primary returns malformed JSON", async () => {
  const primaryClient = createMockClient({
    responses: [
      "origin: Gabtoli, destination: Mirpur 1",
      JSON.stringify({
        origin: "Gabtoli",
        destination: "Mirpur 1",
        modes: ["bus"],
        studentFare: false,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("Gabtoli to Mirpur 1 bus", {
    primaryClient,
    maxRetries: 1
  });

  assert.equal(intent.origin, "Gabtoli");
  assert.equal(intent.destination, "Mirpur 1");
  assert.equal(primaryClient.calls.length, 2);
  assert.match(primaryClient.calls[1].userPrompt, /previous response was invalid/i);
});

test("falls back to Groq when primary fails", async () => {
  const primaryClient = createMockClient({
    provider: "gemini",
    responses: [new Error("Gemini unavailable")]
  });
  const fallbackClient = createMockClient({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    responses: [
      JSON.stringify({
        origin: "Airport",
        destination: "Gabtoli",
        modes: ["uber"],
        studentFare: false,
        needsClarification: false,
        clarificationQuestion: null
      })
    ]
  });

  const intent = await extractIntent("airport to gabtoli uber", {
    primaryClient,
    fallbackClient,
    includeMeta: true
  });

  assert.equal(intent.origin, "Airport");
  assert.equal(intent.destination, "Gabtoli");
  assert.deepEqual(intent.modes, ["uber"]);
  assert.equal(intent.meta.provider, "groq");
  assert.equal(intent.meta.fallbackUsed, true);
});
