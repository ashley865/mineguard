import { resolveSetting } from "./systemSettings";

export interface WhatsAppMessage {
  to: string;
  text: string;
}

function toChatId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `${digits}@c.us` : null;
}

async function resolveConfig() {
  const [apiUrl, apiKey, sessionId] = await Promise.all([
    resolveSetting("WHATSAPP_API_URL"),
    resolveSetting("WHATSAPP_API_KEY"),
    resolveSetting("WHATSAPP_SESSION_ID"),
  ]);
  if (!apiUrl || !apiKey || !sessionId) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey, sessionId };
}

export async function isWhatsAppConfigured(): Promise<boolean> {
  return (await resolveConfig()) !== null;
}

async function postSendText(config: { apiUrl: string; apiKey: string; sessionId: string }, chatId: string, text: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${config.apiUrl}/api/sessions/${config.sessionId}/messages/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
      body: JSON.stringify({ chatId, text }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Fire-and-forget by design, the same fail-open reasoning as sendEmail and
// notifySecurityWebhook — a misconfigured or unreachable OpenWA gateway must never block the
// notification flow that triggered it. Callers that need to know whether it actually sent
// (the "Test" button) should use sendTestWhatsApp instead.
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  try {
    const config = await resolveConfig();
    if (!config) return;
    const chatId = toChatId(message.to);
    if (!chatId) return;
    await postSendText(config, chatId, message.text);
  } catch {
    // Best-effort only — see comment above.
  }
}

// OpenWA's send-bulk endpoint caps a single batch at 100 items and handles inter-message
// pacing itself (default 3s, randomized) — the pacing that keeps a brand-new WhatsApp
// account from immediately tripping WhatsApp's own anti-spam bans. A large workforce is
// chunked into multiple sequential batches rather than one oversized request.
const BULK_BATCH_SIZE = 100;

export interface WhatsAppBroadcastResult {
  success: boolean;
  message: string;
  recipientCount: number;
}

export async function sendWhatsAppBroadcast(phones: string[], text: string): Promise<WhatsAppBroadcastResult> {
  const config = await resolveConfig();
  if (!config) return { success: false, message: "WhatsApp gateway URL, API key, and session ID must all be configured first", recipientCount: 0 };

  const chatIds = Array.from(new Set(phones.map(toChatId).filter((c): c is string => !!c)));
  if (chatIds.length === 0) return { success: false, message: "None of the workers have a phone number on file", recipientCount: 0 };

  try {
    for (let i = 0; i < chatIds.length; i += BULK_BATCH_SIZE) {
      const chunk = chatIds.slice(i, i + BULK_BATCH_SIZE);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let res;
      try {
        res = await fetch(`${config.apiUrl}/api/sessions/${config.sessionId}/messages/send-bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
          body: JSON.stringify({ messages: chunk.map((chatId) => ({ chatId, type: "text", content: { text } })) }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const body: any = await res.json().catch(() => null);
        return { success: false, message: body?.message || `OpenWA responded with ${res.status}`, recipientCount: chatIds.length };
      }
    }
    return { success: true, message: `Announcement queued for ${chatIds.length} worker${chatIds.length === 1 ? "" : "s"}`, recipientCount: chatIds.length };
  } catch (err: any) {
    return { success: false, message: err?.name === "AbortError" ? "Request to the WhatsApp gateway timed out" : "Could not reach the WhatsApp gateway", recipientCount: chatIds.length };
  }
}

export async function sendTestWhatsApp(toPhone: string): Promise<{ success: boolean; message: string }> {
  const config = await resolveConfig();
  if (!config) return { success: false, message: "WhatsApp gateway URL, API key, and session ID must all be configured first" };
  const chatId = toChatId(toPhone);
  if (!chatId) return { success: false, message: "No usable phone number on your account" };
  try {
    const res = await postSendText(config, chatId, "This is a test message from MineGuard's Cyber Command Center System Configuration panel.");
    if (!res.ok) {
      const body: any = await res.json().catch(() => null);
      return { success: false, message: body?.message || `OpenWA responded with ${res.status}` };
    }
    return { success: true, message: `Test WhatsApp message sent to ${toPhone}` };
  } catch (err: any) {
    return { success: false, message: err?.name === "AbortError" ? "Request to the WhatsApp gateway timed out" : "Could not reach the WhatsApp gateway" };
  }
}
