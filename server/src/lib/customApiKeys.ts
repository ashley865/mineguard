import { CustomApiKeyAuthStyle } from "@prisma/client";
import { prisma } from "../prisma";
import { assertSafeExternalUrl, UnsafeUrlError } from "./ssrfGuard";

// "Add a new API key" for integrations MineGuard's own code doesn't wire up itself —
// unlike SYSTEM_SETTING_KEYS (lib/systemSettings.ts), which are consumed by specific,
// known code paths (the AI assistant, the metals feed), a custom key is just stored and,
// optionally, exercised against an admin-supplied testUrl on demand. value is never
// selected back out in list/get — only execute() reads it, server-side only.
const NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export function validateCustomKeyName(name: string): string | null {
  if (!NAME_PATTERN.test(name)) {
    return "Must be 3-64 characters, uppercase letters/numbers/underscores only, starting with a letter (e.g. SLACK_API_KEY)";
  }
  return null;
}

const listSelect = {
  id: true,
  name: true,
  testUrl: true,
  authStyle: true,
  headerName: true,
  queryParam: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CustomApiKeySummary = {
  id: string;
  name: string;
  testUrl: string | null;
  authStyle: CustomApiKeyAuthStyle;
  headerName: string | null;
  queryParam: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listCustomApiKeys(): Promise<CustomApiKeySummary[]> {
  return prisma.customApiKey.findMany({ select: listSelect, orderBy: { createdAt: "desc" } });
}

export interface CreateCustomApiKeyInput {
  name: string;
  value: string;
  testUrl?: string | null;
  authStyle?: CustomApiKeyAuthStyle;
  headerName?: string | null;
  queryParam?: string | null;
  createdByName: string | null;
}

export async function createCustomApiKey(input: CreateCustomApiKeyInput): Promise<CustomApiKeySummary> {
  return prisma.customApiKey.create({
    data: {
      name: input.name,
      value: input.value,
      testUrl: input.testUrl || null,
      authStyle: input.authStyle ?? "BEARER",
      headerName: input.headerName || null,
      queryParam: input.queryParam || null,
      createdByName: input.createdByName,
    },
    select: listSelect,
  });
}

export interface UpdateCustomApiKeyInput {
  value?: string;
  testUrl?: string | null;
  authStyle?: CustomApiKeyAuthStyle;
  headerName?: string | null;
  queryParam?: string | null;
}

export async function updateCustomApiKey(id: string, input: UpdateCustomApiKeyInput): Promise<CustomApiKeySummary> {
  return prisma.customApiKey.update({
    where: { id },
    data: {
      value: input.value,
      testUrl: input.testUrl === undefined ? undefined : input.testUrl || null,
      authStyle: input.authStyle,
      headerName: input.headerName === undefined ? undefined : input.headerName || null,
      queryParam: input.queryParam === undefined ? undefined : input.queryParam || null,
    },
    select: listSelect,
  });
}

export async function deleteCustomApiKey(id: string): Promise<void> {
  await prisma.customApiKey.delete({ where: { id } });
}

export interface ExecuteResult {
  success: boolean;
  message: string;
  status?: number;
  bodySnippet?: string;
}

const MAX_SNIPPET_LENGTH = 500;

/** Replays the stored key against its testUrl, exactly the way "Execute" is meant to prove it works. */
export async function executeCustomApiKey(id: string): Promise<ExecuteResult> {
  const key = await prisma.customApiKey.findUnique({ where: { id } });
  if (!key) return { success: false, message: "Key not found" };
  if (!key.testUrl) return { success: false, message: "No test URL is configured for this key" };

  let url: URL;
  try {
    url = await assertSafeExternalUrl(key.testUrl);
  } catch (err) {
    return { success: false, message: err instanceof UnsafeUrlError ? err.message : "Invalid test URL" };
  }

  const headers: Record<string, string> = {};
  if (key.authStyle === "BEARER") {
    headers.Authorization = `Bearer ${key.value}`;
  } else if (key.authStyle === "HEADER") {
    if (!key.headerName) return { success: false, message: "No header name is configured for this key" };
    headers[key.headerName] = key.value;
  } else if (key.authStyle === "QUERY") {
    if (!key.queryParam) return { success: false, message: "No query parameter name is configured for this key" };
    url.searchParams.set(key.queryParam, key.value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url.toString(), { method: "GET", headers, signal: controller.signal });
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, MAX_SNIPPET_LENGTH);
    return { success: res.ok, message: res.ok ? "Request succeeded" : `Endpoint responded with ${res.status}`, status: res.status, bodySnippet: snippet };
  } catch (err: any) {
    return { success: false, message: err?.name === "AbortError" ? "Request timed out" : "Could not reach the test URL" };
  } finally {
    clearTimeout(timeout);
  }
}
