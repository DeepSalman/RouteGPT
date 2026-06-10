import assert from "node:assert/strict";
import test from "node:test";
import { generateConversationReply, parseConversationReply } from "./conversationReply.js";

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

test("parses a fenced conversation reply", () => {
  const reply = parseConversationReply('```json\n{"reply":"Hi there!"}\n```');
  assert.equal(reply, "Hi there!");
});

test("rejects an empty conversation reply", () => {
  assert.throws(() => parseConversationReply('{"reply":"   "}'), /non-empty reply/);
});

test("generates a conversation reply with the primary client", async () => {
  const primaryClient = createMockClient({
    responses: [JSON.stringify({ reply: "I'm RouteGPT, your Dhaka transport assistant." })]
  });

  const result = await generateConversationReply("what is your name?", { primaryClient });

  assert.equal(result.reply, "I'm RouteGPT, your Dhaka transport assistant.");
  assert.equal(result.provider, "gemini");
  assert.equal(result.fallbackUsed, false);
  assert.equal(primaryClient.calls.length, 1);
  assert.match(primaryClient.calls[0].systemPrompt, /You are RouteGPT/);
  assert.match(primaryClient.calls[0].systemPrompt, /Never state specific Dhaka bus names/);
  assert.match(primaryClient.calls[0].userPrompt, /what is your name\?/);
});

test("retries once when the model returns malformed JSON", async () => {
  const primaryClient = createMockClient({
    responses: ["just some plain text", JSON.stringify({ reply: "Hello!" })]
  });

  const result = await generateConversationReply("hello", { primaryClient });

  assert.equal(result.reply, "Hello!");
  assert.equal(primaryClient.calls.length, 2);
  assert.match(primaryClient.calls[1].userPrompt, /previous response was not a valid/i);
});

test("falls back to the secondary client when the primary fails", async () => {
  const primaryClient = createMockClient({
    provider: "gemini",
    responses: [new Error("Gemini unavailable")]
  });
  const fallbackClient = createMockClient({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    responses: [JSON.stringify({ reply: "Hi! I'm RouteGPT." })]
  });

  const result = await generateConversationReply("hi", { primaryClient, fallbackClient });

  assert.equal(result.reply, "Hi! I'm RouteGPT.");
  assert.equal(result.provider, "groq");
  assert.equal(result.fallbackUsed, true);
});

test("throws when no provider can generate a reply", async () => {
  const primaryClient = createMockClient({
    responses: [new Error("provider down")]
  });

  await assert.rejects(
    generateConversationReply("hello", { primaryClient }),
    /No LLM provider could generate a conversation reply/
  );
});

test("clamps very long replies", async () => {
  const primaryClient = createMockClient({
    responses: [JSON.stringify({ reply: "a".repeat(2000) })]
  });

  const result = await generateConversationReply("tell me everything", { primaryClient });

  assert.equal(result.reply.length, 900);
  assert.match(result.reply, /\.\.\.$/);
});
