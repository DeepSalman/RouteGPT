import { createGeminiClient } from "./geminiClient.js";
import { createGroqClient } from "./groqClient.js";
import {
  INTENT_EXTRACTION_SYSTEM_PROMPT,
  SUPPORTED_MODES,
  buildIntentExtractionPrompt,
  buildIntentRetryPrompt
} from "./intentPrompt.js";

const ALL_MODES = Object.freeze([...SUPPORTED_MODES]);

class IntentExtractionError extends Error {
  constructor(message, { providerErrors = [] } = {}) {
    super(message);
    this.name = "IntentExtractionError";
    this.providerErrors = providerErrors;
  }
}

function cleanNullableText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function extractJsonObjectText(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    throw new Error("Model returned an empty response.");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    return candidate;
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }

  return candidate.slice(start, end + 1);
}

function parseIntentJson(text) {
  const jsonText = extractJsonObjectText(text);
  return JSON.parse(jsonText);
}

function normalizeMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();

  if (normalized === "ride_hailing" || normalized === "rideshare" || normalized === "bike") {
    return ["pathao", "uber"];
  }

  if (!SUPPORTED_MODES.includes(normalized)) {
    return [];
  }

  return [normalized];
}

function normalizeModes(modes) {
  if (!Array.isArray(modes) || modes.length === 0) {
    return [...ALL_MODES];
  }

  const normalized = modes.flatMap(normalizeMode);
  const deduped = [...new Set(normalized)];
  return deduped.length ? deduped : [...ALL_MODES];
}

function normalizeIntentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Intent payload must be a JSON object.");
  }

  const origin = cleanNullableText(payload.origin);
  const destination = cleanNullableText(payload.destination);
  const modes = normalizeModes(payload.modes);
  const studentFare = Boolean(payload.studentFare);
  const needsClarification = Boolean(
    payload.needsClarification || !origin || !destination
  );
  const clarificationQuestion = cleanNullableText(payload.clarificationQuestion);

  return {
    origin,
    destination,
    modes,
    studentFare,
    needsClarification,
    clarificationQuestion:
      needsClarification && !clarificationQuestion
        ? buildDefaultClarificationQuestion({ origin, destination })
        : clarificationQuestion,
    raw: payload
  };
}

function buildDefaultClarificationQuestion({ origin, destination }) {
  if (!origin && !destination) {
    return "Where are you starting from and where do you want to go?";
  }

  if (!origin) {
    return "Where are you starting from?";
  }

  if (!destination) {
    return "Where do you want to go?";
  }

  return "Can you clarify the exact stop or area?";
}

function createConfiguredIntentClients() {
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const fallbackProvider = (process.env.LLM_FALLBACK_PROVIDER || "groq").toLowerCase();
  const configErrors = [];
  let primaryClient = null;
  let fallbackClient = null;

  if (provider === "gemini") {
    try {
      primaryClient = createGeminiClient();
    } catch (error) {
      configErrors.push({
        provider,
        message: error.message
      });
    }
  }

  if (fallbackProvider === "groq") {
    try {
      fallbackClient = createGroqClient();
    } catch (error) {
      configErrors.push({
        provider: fallbackProvider,
        message: error.message
      });
    }
  }

  return {
    primaryClient,
    fallbackClient,
    configErrors
  };
}

async function callClientForIntent(client, userMessage, { maxRetries }) {
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const userPrompt =
      attempt === 0
        ? buildIntentExtractionPrompt(userMessage)
        : buildIntentRetryPrompt(userMessage, lastResponse, lastError.message);

    lastResponse = await client.generateText({
      systemPrompt: INTENT_EXTRACTION_SYSTEM_PROMPT,
      userPrompt
    });

    try {
      return normalizeIntentPayload(parseIntentJson(lastResponse));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function extractIntent(
  userMessage,
  {
    primaryClient,
    fallbackClient,
    maxRetries = 1,
    includeMeta = false
  } = {}
) {
  const message = cleanNullableText(userMessage);

  if (!message) {
    const intent = normalizeIntentPayload({
      origin: null,
      destination: null,
      modes: ALL_MODES,
      studentFare: false,
      needsClarification: true,
      clarificationQuestion: "Where are you starting from and where do you want to go?"
    });

    return includeMeta
      ? {
          ...intent,
          meta: {
            provider: "local",
            model: null,
            fallbackUsed: false
          }
        }
      : intent;
  }

  const providerErrors = [];
  let resolvedPrimaryClient = primaryClient;
  let resolvedFallbackClient = fallbackClient;

  if (!resolvedPrimaryClient && !resolvedFallbackClient) {
    const configuredClients = createConfiguredIntentClients();
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
      const intent = await callClientForIntent(client, message, { maxRetries });

      return includeMeta
        ? {
            ...intent,
            meta: {
              provider: client.provider || "unknown",
              model: client.model || null,
              fallbackUsed
            }
          }
        : intent;
    } catch (error) {
      providerErrors.push({
        provider: client.provider || "unknown",
        message: error.message
      });
    }
  }

  throw new IntentExtractionError("Intent extraction failed for all configured providers.", {
    providerErrors
  });
}

export {
  IntentExtractionError,
  extractIntent,
  extractJsonObjectText,
  normalizeIntentPayload,
  parseIntentJson
};
