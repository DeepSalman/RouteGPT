import { createConfiguredLlmClients, extractJsonObjectText } from "./intentExtraction.js";

const MAX_REPLY_LENGTH = 900;

const CONVERSATION_SYSTEM_PROMPT = `
You are RouteGPT, a friendly Dhaka transport assistant chatting with a user.

The current message is conversational (it is not a route lookup), so reply naturally, the way a helpful assistant would.

Rules:
- Match the user's language: reply in English to English, Bengali to Bengali, Banglish to Banglish.
- Keep it short and warm: one to three sentences unless the question genuinely needs more.
- If the user asks your name or who or what you are, introduce yourself as RouteGPT, a Dhaka transport assistant that finds bus routes from verified local data, calculates bus and student fares, and estimates CNG, Pathao, and Uber costs.
- You may briefly answer general questions like a normal assistant. When it fits naturally, offer to help with Dhaka routes, but do not force it into every reply.
- Never state specific Dhaka bus names, bus routes, stop lists, fares, or schedules in this reply; those facts must come from the route database. If the user wants route or fare details, ask for their starting point and destination instead.
- Do not claim live bus tracking, ticket booking, or live ride-hailing prices.
- No markdown formatting and no corporate filler.

Return only one JSON object in this exact shape, with no extra text:
{"reply": "your reply as one string"}
`.trim();

function buildConversationPrompt(userMessage) {
  return `
The user said:
${JSON.stringify(userMessage)}

Reply as RouteGPT. Return only the JSON object {"reply":"..."}.
`.trim();
}

function buildConversationRetryPrompt(userMessage, invalidResponse, validationError) {
  return `
Your previous response was not a valid RouteGPT conversation reply.

User message:
${JSON.stringify(userMessage)}

Invalid response:
${JSON.stringify(invalidResponse)}

Validation error:
${validationError}

Return only one JSON object in this exact shape:
{"reply": "your reply as one string"}
`.trim();
}

function cleanReplyText(value) {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (cleaned.length <= MAX_REPLY_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_REPLY_LENGTH - 3).trimEnd()}...`;
}

function parseConversationReply(text) {
  const payload = JSON.parse(extractJsonObjectText(text));

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Conversation payload must be a JSON object.");
  }

  const reply = cleanReplyText(payload.reply);

  if (!reply) {
    throw new Error("Conversation payload did not include a non-empty reply string.");
  }

  return reply;
}

async function callClientForReply(client, userMessage, { maxRetries }) {
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const userPrompt =
      attempt === 0
        ? buildConversationPrompt(userMessage)
        : buildConversationRetryPrompt(userMessage, lastResponse, lastError.message);

    lastResponse = await client.generateText({
      systemPrompt: CONVERSATION_SYSTEM_PROMPT,
      userPrompt
    });

    try {
      return parseConversationReply(lastResponse);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function generateConversationReply(
  userMessage,
  { primaryClient, fallbackClient, maxRetries = 1 } = {}
) {
  const message = String(userMessage ?? "").replace(/\s+/g, " ").trim();

  if (!message) {
    throw new Error("Conversation reply generation needs a user message.");
  }

  const providerErrors = [];
  let resolvedPrimaryClient = primaryClient;
  let resolvedFallbackClient = fallbackClient;

  if (!resolvedPrimaryClient && !resolvedFallbackClient) {
    const configuredClients = createConfiguredLlmClients();
    resolvedPrimaryClient = configuredClients.primaryClient;
    resolvedFallbackClient = configuredClients.fallbackClient;
    providerErrors.push(...configuredClients.configErrors);
  }

  for (const [client, fallbackUsed] of [
    [resolvedPrimaryClient, false],
    [resolvedFallbackClient, true]
  ]) {
    if (!client) continue;

    try {
      const reply = await callClientForReply(client, message, { maxRetries });

      return {
        reply,
        provider: client.provider || "unknown",
        model: client.model || null,
        fallbackUsed
      };
    } catch (error) {
      providerErrors.push({
        provider: client.provider || "unknown",
        message: error.message
      });
    }
  }

  const error = new Error("No LLM provider could generate a conversation reply.");
  error.providerErrors = providerErrors;
  throw error;
}

export { CONVERSATION_SYSTEM_PROMPT, generateConversationReply, parseConversationReply };
