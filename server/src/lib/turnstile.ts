// Cloudflare Turnstile verification. Dormant until TURNSTILE_SECRET_KEY is set — same
// "stays dormant until configured" convention as AI_API_KEY/WHATSAPP_API_KEY (see
// server/.env.example) — so every form using this works exactly as before if the operator
// never signs up for Turnstile, and starts requiring a human-verified token the moment it's
// configured, with no code change or redeploy needed.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Returns true if the token is valid, or if Turnstile isn't configured (nothing to check
 * against). Never throws — a Cloudflare outage should degrade to "not configured" rather
 * than take down every registration/bid form on the site.
 */
export async function verifyTurnstileToken(token: string | undefined | null, ip: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
