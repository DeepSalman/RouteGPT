const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function getGeminiText(responseBody) {
  const parts = responseBody?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("").trim();

  if (!text) {
    throw new Error("Gemini response did not include text content.");
  }

  return text;
}

function createGeminiClient({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.LLM_MODEL || "gemini-2.5-flash",
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
} = {}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Gemini intent extraction.");
  }

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required for Gemini intent extraction.");
  }

  const modelPath = model.startsWith("models/") ? model : `models/${model}`;

  return {
    provider: "gemini",
    model,
    async generateText({ systemPrompt, userPrompt }) {
      const response = await fetchImpl(`${GEMINI_BASE_URL}/${modelPath}:generateContent`, {
        method: "POST",
        signal: createTimeoutSignal(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json"
          }
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${responseText}`);
      }

      return getGeminiText(JSON.parse(responseText));
    }
  };
}

export { createGeminiClient };
