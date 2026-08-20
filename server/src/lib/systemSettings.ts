import { prisma } from "../prisma";

// Integration values and operational controls that used to be configurable only by
// redeploying the server with a different environment variable, or not configurable at
// runtime at all. Cyber Command Center's System Configuration tab can override any of these
// from the UI (see routes/cyberSettings.ts); resolveSetting() prefers the DB override and
// falls back to process.env[key] (for the settings that have an env-var equivalent) so a
// deployment that has never touched this panel keeps working exactly as before this table
// existed.
export type SystemSettingType = "text" | "password" | "boolean" | "number";

export interface SystemSettingDef {
  key: string;
  label: string;
  description: string;
  type: SystemSettingType;
  secret: boolean;
  testable: boolean;
  /** Shown/used when neither a DB override nor an env var is set. */
  defaultValue?: string;
}

export const SYSTEM_SETTING_KEYS: SystemSettingDef[] = [
  {
    key: "AI_API_KEY",
    label: "AI provider API key",
    description: "Bearer key for the OpenAI-compatible chat completions endpoint used by the AI Analyst tab.",
    type: "password",
    secret: true,
    testable: true,
  },
  {
    key: "AI_API_BASE_URL",
    label: "AI provider base URL",
    description: 'OpenAI-compatible API base URL.',
    type: "text",
    secret: false,
    testable: false,
    defaultValue: "https://api.openai.com/v1",
  },
  {
    key: "AI_MODEL",
    label: "AI model",
    description: "Chat completions model name.",
    type: "text",
    secret: false,
    testable: false,
    defaultValue: "gpt-4o-mini",
  },
  {
    key: "METALS_API_PROVIDER",
    label: "Metals API provider",
    description: 'Which provider the Metals API key below belongs to. Valid values: "twelvedata" or "metals-api". Switching providers is just changing this and pasting the new provider\'s key — no other changes needed.',
    type: "text",
    secret: false,
    testable: false,
    defaultValue: "twelvedata",
  },
  {
    key: "METALS_API_KEY",
    label: "Metals API key",
    description: "Access key for whichever provider is selected above, used to refine live commodity prices beyond the free Yahoo feed.",
    type: "password",
    secret: true,
    testable: true,
  },
  {
    key: "SECURITY_ALERT_WEBHOOK_URL",
    label: "Security alert webhook",
    description:
      "Slack-compatible incoming webhook URL. A message is posted here whenever a CRITICAL cyber alert or incident is created, or an IP is auto-blocked after repeated failed logins.",
    type: "password",
    secret: true,
    testable: true,
  },
  {
    key: "MAINTENANCE_MODE",
    label: "Maintenance mode",
    description:
      "When on, blocks new staff, contractor, and buyer logins with a maintenance message. Owners and IT Managers can still log in so they can turn this back off.",
    type: "boolean",
    secret: false,
    testable: false,
    defaultValue: "false",
  },
  {
    key: "BRUTE_FORCE_THRESHOLD",
    label: "Brute-force threshold",
    description: "Number of failed logins from one IP, within the window below, before it is auto-blocked.",
    type: "number",
    secret: false,
    testable: false,
    defaultValue: "5",
  },
  {
    key: "BRUTE_FORCE_WINDOW_HOURS",
    label: "Brute-force window (hours)",
    description: "The rolling time window (in hours) that failed logins are counted over for auto-blocking and threat detection.",
    type: "number",
    secret: false,
    testable: false,
    defaultValue: "24",
  },
  {
    key: "SMTP_HOST",
    label: "Email server (SMTP host)",
    description:
      "Outgoing mail server used to send request notifications and executive invites by email, e.g. smtp.sendgrid.net. Testing this sends a test email to your own account.",
    type: "text",
    secret: false,
    testable: true,
  },
  {
    key: "SMTP_PORT",
    label: "Email server port",
    description: 'Usually 587 (STARTTLS) or 465 (implicit TLS — pair with "Use TLS" on).',
    type: "number",
    secret: false,
    testable: false,
    defaultValue: "587",
  },
  {
    key: "SMTP_SECURE",
    label: "Use TLS",
    description: "On for port 465 (implicit TLS). Off for port 587 (STARTTLS, negotiated automatically).",
    type: "boolean",
    secret: false,
    testable: false,
    defaultValue: "false",
  },
  {
    key: "SMTP_USER",
    label: "Email server username",
    description: "Login username for the SMTP server, if it requires authentication.",
    type: "text",
    secret: false,
    testable: false,
  },
  {
    key: "SMTP_PASSWORD",
    label: "Email server password",
    description: "Login password (or provider API key used as a password) for the SMTP server.",
    type: "password",
    secret: true,
    testable: false,
  },
  {
    key: "SMTP_FROM_EMAIL",
    label: "\"From\" email address",
    description: "The sender address recipients see, e.g. notifications@yourmine.co.za.",
    type: "text",
    secret: false,
    testable: false,
  },
  {
    key: "SMTP_FROM_NAME",
    label: "\"From\" display name",
    description: 'The sender name recipients see next to the address.',
    type: "text",
    secret: false,
    testable: false,
    defaultValue: "MineGuard",
  },
];

const SETTING_DEF_BY_KEY = new Map(SYSTEM_SETTING_KEYS.map((s) => [s.key, s]));
export function isKnownSystemSetting(key: string): boolean {
  return SETTING_DEF_BY_KEY.has(key);
}

const URL_KEYS = new Set(["AI_API_BASE_URL", "SECURITY_ALERT_WEBHOOK_URL"]);

// Plain "text" settings that are really a closed set of choices, not free-form input —
// enforced here instead of adding a whole new SystemSettingType, since there are only a
// couple of these and a typo (e.g. "twelve-data" instead of "twelvedata") would otherwise
// silently fall through to the resolveSetting() default rather than erroring at save time.
const ENUM_VALUES: Record<string, string[]> = {
  METALS_API_PROVIDER: ["twelvedata", "metals-api"],
};

/** Returns an error message if invalid, or null if the value is acceptable for this key's type. */
export function validateSettingValue(key: string, value: string): string | null {
  const def = SETTING_DEF_BY_KEY.get(key);
  if (!def) return "Unknown setting";
  if (def.type === "boolean") {
    return value === "true" || value === "false" ? null : 'Must be "true" or "false"';
  }
  if (def.type === "number") {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return "Must be a positive whole number";
    if (key === "BRUTE_FORCE_THRESHOLD" && n > 1000) return "Must be 1000 or less";
    if (key === "BRUTE_FORCE_WINDOW_HOURS" && n > 8760) return "Must be 8760 (one year) or less";
    return null;
  }
  if (ENUM_VALUES[key]) {
    const allowed = ENUM_VALUES[key];
    return allowed.includes(value) ? null : `Must be one of: ${allowed.join(", ")}`;
  }
  if (URL_KEYS.has(key)) {
    // Cheap, synchronous format check only — the real SSRF/DNS check (lib/ssrfGuard.ts)
    // runs at the point each URL is actually fetched, since that check needs a live DNS
    // lookup and shouldn't be able to block a save on a transient resolver hiccup.
    try {
      if (new URL(value).protocol !== "https:") return "Must be an https:// URL";
    } catch {
      return "Must be a valid URL";
    }
    return null;
  }
  return value.trim().length > 0 ? null : "A non-empty value is required";
}

const CACHE_TTL_MS = 30_000;
let cache: Map<string, string> | null = null;
let cacheLoadedAt = 0;

async function loadCache(): Promise<Map<string, string>> {
  const rows = await prisma.systemSetting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function getCache(): Promise<Map<string, string>> {
  if (!cache || Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadCache();
    cacheLoadedAt = Date.now();
  }
  return cache;
}

export function invalidateSystemSettingsCache(): void {
  cache = null;
}

/** DB override if one has been saved, otherwise the environment variable, otherwise null. */
export async function resolveSetting(key: string): Promise<string | null> {
  const stored = (await getCache()).get(key);
  if (stored) return stored;
  return process.env[key] || null;
}

/** Like resolveSetting, but falls back to a hardcoded default when nothing is configured. */
export async function resolveSettingOrDefault(key: string, fallback: string): Promise<string> {
  return (await resolveSetting(key)) ?? fallback;
}

export async function resolveBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  const raw = await resolveSetting(key);
  if (raw === null) return fallback;
  return raw === "true";
}

export async function resolveIntSetting(key: string, fallback: number): Promise<number> {
  const raw = await resolveSetting(key);
  const n = raw !== null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setSystemSetting(key: string, value: string, updatedByName: string | null): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, updatedByName },
    update: { value, updatedByName },
  });
  invalidateSystemSettingsCache();
}

export async function clearSystemSetting(key: string): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { key } });
  invalidateSystemSettingsCache();
}

export interface SystemSettingView extends SystemSettingDef {
  source: "database" | "environment" | "default" | "unset";
  configured: boolean;
  // Deliberately omitted entirely for secret settings — not masked, not truncated, not
  // present in the JSON at all — so nothing derivable from a real key ever reaches the
  // browser (Network tab, React DevTools, a service worker cache, an error-reporting SDK
  // that snapshots state, etc). A non-secret setting's actual value is fine to show, since
  // it's operational config (a model name, a URL, a threshold), not a credential.
  value: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export async function listSystemSettings(): Promise<SystemSettingView[]> {
  const rows = await prisma.systemSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return SYSTEM_SETTING_KEYS.map((def) => {
    const row = byKey.get(def.key);
    if (row) {
      return {
        ...def,
        source: "database" as const,
        configured: true,
        value: def.secret ? null : row.value,
        updatedAt: row.updatedAt.toISOString(),
        updatedByName: row.updatedByName,
      };
    }
    const envValue = process.env[def.key];
    if (envValue) {
      return {
        ...def,
        source: "environment" as const,
        configured: true,
        value: def.secret ? null : envValue,
        updatedAt: null,
        updatedByName: null,
      };
    }
    if (def.defaultValue !== undefined) {
      return { ...def, source: "default" as const, configured: true, value: def.secret ? null : def.defaultValue, updatedAt: null, updatedByName: null };
    }
    return { ...def, source: "unset" as const, configured: false, value: null, updatedAt: null, updatedByName: null };
  });
}
