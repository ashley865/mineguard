import { prisma } from "../prisma";

// Integration values that used to be configurable only by redeploying the server with a
// different environment variable. Cyber Command Center can now override any of these from
// the UI (see routes/cyberSettings.ts); resolveSetting() prefers the DB override and falls
// back to process.env[key] so a deployment that has never touched this panel keeps working
// exactly as it did before this table existed.
export interface SystemSettingDef {
  key: string;
  label: string;
  description: string;
  secret: boolean;
}

export const SYSTEM_SETTING_KEYS: SystemSettingDef[] = [
  {
    key: "AI_API_KEY",
    label: "AI provider API key",
    description: "Bearer key for the OpenAI-compatible chat completions endpoint used by the AI Analyst tab.",
    secret: true,
  },
  {
    key: "AI_API_BASE_URL",
    label: "AI provider base URL",
    description: 'OpenAI-compatible API base URL. Defaults to "https://api.openai.com/v1" when unset.',
    secret: false,
  },
  {
    key: "AI_MODEL",
    label: "AI model",
    description: 'Chat completions model name. Defaults to "gpt-4o-mini" when unset.',
    secret: false,
  },
  {
    key: "METALS_API_KEY",
    label: "Metals API key",
    description: "metals-api.com access key used to refine live commodity prices beyond the free Yahoo feed.",
    secret: true,
  },
];

const SETTING_KEY_SET = new Set(SYSTEM_SETTING_KEYS.map((s) => s.key));
export function isKnownSystemSetting(key: string): boolean {
  return SETTING_KEY_SET.has(key);
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

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export interface SystemSettingView extends SystemSettingDef {
  source: "database" | "environment" | "unset";
  maskedValue: string | null;
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
        maskedValue: def.secret ? mask(row.value) : row.value,
        updatedAt: row.updatedAt.toISOString(),
        updatedByName: row.updatedByName,
      };
    }
    const envValue = process.env[def.key];
    if (envValue) {
      return {
        ...def,
        source: "environment" as const,
        maskedValue: def.secret ? mask(envValue) : envValue,
        updatedAt: null,
        updatedByName: null,
      };
    }
    return { ...def, source: "unset" as const, maskedValue: null, updatedAt: null, updatedByName: null };
  });
}
