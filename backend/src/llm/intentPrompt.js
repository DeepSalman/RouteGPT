const SUPPORTED_MODES = Object.freeze(["bus", "cng", "pathao", "uber"]);

const INTENT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "intentType",
    "origin",
    "destination",
    "modes",
    "studentFare",
    "needsClarification",
    "clarificationQuestion",
    "conversationReply"
  ],
  properties: {
    intentType: {
      type: "string",
      enum: ["route", "conversation"]
    },
    origin: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    destination: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    modes: {
      type: "array",
      items: {
        type: "string",
        enum: SUPPORTED_MODES
      }
    },
    studentFare: {
      type: "boolean"
    },
    needsClarification: {
      type: "boolean"
    },
    clarificationQuestion: {
      anyOf: [{ type: "string" }, { type: "null" }]
    },
    conversationReply: {
      anyOf: [{ type: "string" }, { type: "null" }]
    }
  }
});

const INTENT_EXTRACTION_SYSTEM_PROMPT = `
You are RouteGPT's transport intent extraction layer for Dhaka, Bangladesh.

Return only one JSON object. Do not return Markdown, comments, or prose.

Your job:
- Understand Banglish, Bengali, and English transport queries.
- Classify greetings, thanks, and general app-help messages as conversation, not route.
- Extract origin and destination as concise English canonical-looking Dhaka place names.
- Preserve Bengali place names when the user writes Bengali.
- Treat missing spaces, punctuation differences, and small Banglish spelling mistakes as normal user input.
- Examples: "shonirakra" can mean "Shonir Akhra"; "শনিরআখরা" can mean "শনির আখরা".
- Detect transport modes only when the user mentions them.
- If no mode is mentioned, use all modes: ["bus","cng","pathao","uber"].
- Detect student fare intent when the user asks as a student or asks for student fare.
- If origin or destination is missing, set the missing field to null and needsClarification to true.
- If a location is ambiguous, set needsClarification to true and ask a short clarification question.
- Never invent transport routes, bus names, fares, or facts.
- For conversation messages, set intentType to "conversation", origin and destination to null, modes to [], needsClarification to false, and include a short conversationReply.
- For transport requests, set intentType to "route".

Allowed modes:
- "bus"
- "cng"
- "pathao"
- "uber"

Mode hints:
- "bus", "বাস", "local", "local bus" -> "bus"
- "cng", "সিএনজি" -> "cng"
- "pathao", "পাঠাও" -> "pathao"
- "uber", "উবার" -> "uber"
- "bike" without a provider usually means ride-hailing, so include ["pathao","uber"] unless another mode is mentioned.

Return this exact JSON shape:
{
  "intentType": "route",
  "origin": "Gabtoli",
  "destination": "Mirpur 1",
  "modes": ["bus"],
  "studentFare": false,
  "needsClarification": false,
  "clarificationQuestion": null,
  "conversationReply": null
}

Examples:
User: "Gabtoli theke Mirpur 1 bus e jabo"
JSON: {"intentType":"route","origin":"Gabtoli","destination":"Mirpur 1","modes":["bus"],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}

User: "mirpur 10 to motijheel"
JSON: {"intentType":"route","origin":"Mirpur 10","destination":"Motijheel","modes":["bus","cng","pathao","uber"],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}

User: "গুলশান থেকে ধানমন্ডি সিএনজি"
JSON: {"intentType":"route","origin":"Gulshan","destination":"Dhanmondi","modes":["cng"],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}

User: "Student fare koto Gabtoli to Mirpur 1?"
JSON: {"intentType":"route","origin":"Gabtoli","destination":"Mirpur 1","modes":["bus","cng","pathao","uber"],"studentFare":true,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}

User: "farmgate boss?"
JSON: {"intentType":"route","origin":null,"destination":"Farmgate","modes":["bus","cng","pathao","uber"],"studentFare":false,"needsClarification":true,"clarificationQuestion":"Where are you starting from?","conversationReply":null}

User: "hello"
JSON: {"intentType":"conversation","origin":null,"destination":null,"modes":[],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":"Hello! Tell me your starting point and destination in Dhaka."}

User: "shonirakra to gabtoli bus"
JSON: {"intentType":"route","origin":"Shonir Akhra","destination":"Gabtoli","modes":["bus"],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}

User: "শনিরআখরা থেকে গাবতলি বাস"
JSON: {"intentType":"route","origin":"শনিরআখরা","destination":"গাবতলি","modes":["bus"],"studentFare":false,"needsClarification":false,"clarificationQuestion":null,"conversationReply":null}
`.trim();

function buildIntentExtractionPrompt(userMessage) {
  return `
Extract a Dhaka transport intent from this user message.

User message:
${JSON.stringify(userMessage)}

Return only valid JSON matching the required shape.
`.trim();
}

function buildIntentRetryPrompt(userMessage, invalidResponse, validationError) {
  return `
Your previous response was invalid for RouteGPT intent extraction.

User message:
${JSON.stringify(userMessage)}

Invalid response:
${JSON.stringify(invalidResponse)}

Validation error:
${validationError}

Return only one valid JSON object with this shape:
{
  "intentType": "route" or "conversation",
  "origin": string or null,
  "destination": string or null,
  "modes": array of "bus" | "cng" | "pathao" | "uber",
  "studentFare": boolean,
  "needsClarification": boolean,
  "clarificationQuestion": string or null,
  "conversationReply": string or null
}
`.trim();
}

export {
  INTENT_EXTRACTION_SYSTEM_PROMPT,
  INTENT_SCHEMA,
  SUPPORTED_MODES,
  buildIntentExtractionPrompt,
  buildIntentRetryPrompt
};
