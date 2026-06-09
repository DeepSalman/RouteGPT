const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function createGroqClient({
  apiKey = process.env.GROQ_API_KEY,
  model = process.env.LLM_FALLBACK_MODEL || "llama-3.3-70b-versatile",
  baseUrl = GROQ_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
} = {}) {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq fallback intent extraction.");
  }

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required for Groq fallback intent extraction.");
  }

  return {
    provider: "groq",
    model,
    async generateText({ systemPrompt, userPrompt }) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: createTimeoutSignal(timeoutMs),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          temperature: 0.1,
          response_format: {
            type: "json_object"
          }
        })
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Groq API error ${response.status}: ${responseText}`);
      }

      const responseBody = JSON.parse(responseText);
      const content = responseBody?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("Groq response did not include message content.");
      }

      return content;
    }
  };
}

export { createGroqClient };
