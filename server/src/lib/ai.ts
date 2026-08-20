import { resolveSetting } from "./systemSettings";
import { assertSafeExternalUrl, UnsafeUrlError } from "./ssrfGuard";

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

export async function isAiConfigured(): Promise<boolean> {
  return !!(await resolveSetting("AI_API_KEY"));
}

/**
 * Talks to any OpenAI-compatible chat completions endpoint (OpenAI, Groq,
 * OpenRouter, a local proxy, etc.) behind a single client, so picking a
 * provider later is a config change, never a code change. AI_API_KEY is
 * intentionally left unset until a provider is chosen — configurable via
 * the AI_API_KEY env var or, preferably, Cyber Command Center's System
 * Configuration panel (see lib/systemSettings.ts).
 */
export async function aiChatComplete(messages: AiMessage[]): Promise<string> {
  const apiKey = await resolveSetting("AI_API_KEY");
  if (!apiKey) throw new AiNotConfiguredError();

  const baseUrl = ((await resolveSetting("AI_API_BASE_URL")) || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (await resolveSetting("AI_MODEL")) || "gpt-4o-mini";

  // An admin-editable base URL is an SSRF vector like any other admin-configured
  // outbound URL — see lib/ssrfGuard.ts.
  try {
    await assertSafeExternalUrl(`${baseUrl}/chat/completions`);
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new Error(`AI provider base URL is not allowed: ${err.message}`);
    throw err;
  }

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
