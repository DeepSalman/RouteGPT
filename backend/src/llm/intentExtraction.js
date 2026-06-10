import { createGeminiClient } from "./geminiClient.js";
import { createGroqClient } from "./groqClient.js";
import {
  INTENT_EXTRACTION_SYSTEM_PROMPT,
  SUPPORTED_MODES,
  buildIntentExtractionPrompt,
  buildIntentRetryPrompt
} from "./intentPrompt.js";

const ALL_MODES = Object.freeze([...SUPPORTED_MODES]);
const CONVERSATION_REPLIES = Object.freeze({
  greeting:
    "Hello! Tell me your starting point and destination in Dhaka, and I can check bus routes plus CNG, Pathao, and Uber estimates.",
  help:
    "I can help with Dhaka route questions. Try something like \"Gabtoli to Mirpur 1\", \"Bashundhara theke Jatrabari bus\", or \"Gulshan to Dhanmondi CNG\"."
});
const LEADING_ROUTE_WORDS =
  /^(?:how\s+(?:do|can)\s+i\s+(?:go|get)|how\s+to\s+(?:go|get)|route|bus\s+route|student\s+fare\s+koto|fare\s+koto|student\s+fare|student|ami|i|from|আমি|আমার|আমাকে|কিভাবে|কীভাবে)\s+/i;
const TRAILING_ROUTE_WORDS =
  /(?:\b(?:bus|base|buse|local|cng|pathao|uber|bike|car|moto|go|diye|using|public\s+transport|jabo|jabo\??|jete\s+chai|lagbe|fare|koto|please|pls|e|te)\b|(?:বাস|সিএনজি|পাঠাও|উবার|বাইক|কার|মোটো|যাবো|যাব|যেতে\s+চাই|লাগবে|ভাড়া|ভাড়া|কত|দিয়ে|দিয়ে)).*$/i;
const BANGLA_RANGE = /[\u0980-\u09FF]/u;

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

function createConversationIntent(reply) {
  return {
    intentType: "conversation",
    origin: null,
    destination: null,
    modes: [],
    studentFare: false,
    needsClarification: false,
    clarificationQuestion: null,
    conversationReply: reply,
    raw: {
      intentType: "conversation"
    }
  };
}

function isGreetingMessage(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    "hi",
    "hello",
    "hey",
    "salam",
    "assalamualaikum",
    "assalamu alaikum",
    "good morning",
    "good afternoon",
    "good evening"
  ].includes(normalized);
}

function isHelpMessage(message) {
  const normalized = String(message || "").toLowerCase().trim();
  return /^(help|what can you do|how does this work|ki korte paro)\??$/i.test(normalized);
}

function normalizePlaceName(value) {
  const cleaned = cleanNullableText(value)
    ?.replace(LEADING_ROUTE_WORDS, "")
    .replace(TRAILING_ROUTE_WORDS, "")
    .replace(/^(?:from|theke|to|থেকে|হতে|টু)\s+/i, "")
    .replace(/\s+(?:from|theke|to|থেকে|হতে|টু)$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  if (BANGLA_RANGE.test(cleaned)) {
    return cleaned;
  }

  return cleaned
    .split(" ")
    .map((part) => {
      if (/^(dohs|ecb|mes|brtc)$/i.test(part)) return part.toUpperCase();
      if (/^[0-9]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function detectModesFromText(message) {
  const normalized = String(message || "").toLowerCase();
  const modes = [];

  if (/\b(bus|base|buse|local)\b|বাস/.test(normalized)) modes.push("bus");
  if (/\bcng\b|সিএনজি/.test(normalized)) modes.push("cng");
  if (/\bpathao\b|\bbike\b|পাঠাও|বাইক/.test(normalized)) modes.push("pathao");
  if (/\buber\b|\bbike\b|\bmoto\b|উবার|বাইক|মোটো/.test(normalized)) modes.push("uber");

  return modes.length ? modes : [...ALL_MODES];
}

function hasStudentFareIntent(message) {
  return /\b(student|half|student fare|chhatro|chatro)\b/i.test(String(message || ""));
}

function parseLocalRouteIntent(message) {
  const text = cleanNullableText(message);
  if (!text) return null;

  const routePatterns = [
    /\bfrom\s+(.+?)\s+to\s+(.+)/i,
    /(.+?)\s+(?:theke|to|থেকে|হতে|টু)\s+(.+)/i
  ];

  for (const pattern of routePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const origin = normalizePlaceName(match[1]);
    const destination = normalizePlaceName(match[2]);

    if (!origin || !destination || origin.toLowerCase() === destination.toLowerCase()) {
      continue;
    }

    return normalizeIntentPayload({
      intentType: "route",
      origin,
      destination,
      modes: detectModesFromText(text),
      studentFare: hasStudentFareIntent(text),
      needsClarification: false,
      clarificationQuestion: null
    });
  }

  return null;
}

function buildLocalClarificationIntent() {
  return normalizeIntentPayload({
    intentType: "route",
    origin: null,
    destination: null,
    modes: ALL_MODES,
    studentFare: false,
    needsClarification: true,
    clarificationQuestion:
      "Tell me your starting point and destination, for example: Gabtoli to Mirpur 1."
  });
}

function detectLocalConversationIntent(message) {
  if (isGreetingMessage(message)) {
    return createConversationIntent(CONVERSATION_REPLIES.greeting);
  }

  if (isHelpMessage(message)) {
    return createConversationIntent(CONVERSATION_REPLIES.help);
  }

  return null;
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

  const intentType = payload.intentType === "conversation" ? "conversation" : "route";
  const origin = cleanNullableText(payload.origin);
  const destination = cleanNullableText(payload.destination);
  const modes = intentType === "conversation" ? [] : normalizeModes(payload.modes);
  const studentFare = Boolean(payload.studentFare);
  const needsClarification = Boolean(
    intentType === "route" && (payload.needsClarification || !origin || !destination)
  );
  const clarificationQuestion = cleanNullableText(payload.clarificationQuestion);

  return {
    intentType,
    origin,
    destination,
    modes,
    studentFare,
    needsClarification,
    clarificationQuestion:
      needsClarification && !clarificationQuestion
        ? buildDefaultClarificationQuestion({ origin, destination })
        : clarificationQuestion,
    conversationReply: cleanNullableText(payload.conversationReply),
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

  const conversationIntent = detectLocalConversationIntent(message);
  if (conversationIntent) {
    return includeMeta
      ? {
          ...conversationIntent,
          meta: {
            provider: "local",
            model: "conversation-guard",
            fallbackUsed: false
          }
        }
      : conversationIntent;
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

  const localRouteIntent = parseLocalRouteIntent(message) || buildLocalClarificationIntent();
  return includeMeta
    ? {
        ...localRouteIntent,
        meta: {
          provider: "local",
          model: "rule-fallback",
          fallbackUsed: true,
          providerErrors
        }
      }
    : localRouteIntent;
}

export {
  CONVERSATION_REPLIES,
  IntentExtractionError,
  extractIntent,
  extractJsonObjectText,
  parseLocalRouteIntent,
  normalizeIntentPayload,
  parseIntentJson
};
