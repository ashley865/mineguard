import { resolveSetting } from "./systemSettings";
import { assertSafeExternalUrl, UnsafeUrlError } from "./ssrfGuard";

export interface SecurityWebhookEvent {
  title: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "AUTO_BLOCK";
}

// Fire-and-forget, Slack-compatible ("text" field renders in Slack/Teams/Discord-via-relay
// without any extra formatting work). Fails open — a webhook misconfiguration or an
// unreachable endpoint must never block the alert/incident/auto-block flow that triggered
// it, so every failure is swallowed here rather than surfaced to the caller.
export async function notifySecurityWebhook(event: SecurityWebhookEvent): Promise<void> {
  try {
    const url = await resolveSetting("SECURITY_ALERT_WEBHOOK_URL");
    if (!url) return;
    await assertSafeExternalUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[MineGuard ${event.severity}] ${event.title}\n${event.detail}` }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Best-effort notification only.
  }
}

export async function sendTestWebhook(url: string): Promise<{ success: boolean; message: string }> {
  try {
    await assertSafeExternalUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "[MineGuard] Test notification from Cyber Command Center's System Configuration panel." }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return { success: false, message: `Webhook endpoint responded with ${res.status}` };
    return { success: true, message: "Test notification sent" };
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) return { success: false, message: err.message };
    return { success: false, message: err?.name === "AbortError" ? "Webhook request timed out" : "Could not reach the webhook URL" };
  }
}
