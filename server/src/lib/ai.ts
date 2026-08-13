export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI assistant is not configured");
    this.name = "AiNotConfiguredError";
  }
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isAiConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

/**
 * Talks to any OpenAI-compatible chat completions endpoint (OpenAI, Groq,
 * OpenRouter, a local proxy, etc.) behind a single env-var-driven client, so
 * picking a provider later is a config change, never a code change.
 * AI_API_KEY is intentionally left unset until a provider is chosen.
 */
export async function aiChatComplete(messages: AiMessage[]): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const baseUrl = (process.env.AI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 700 }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI provider request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI provider returned an unexpected response shape");
  }
  return content;
}
