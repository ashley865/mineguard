import { prisma } from "../prisma";

// Enforced on every authenticated request (see middleware/auth.ts), so this has to be
// fast and can't fail the request on a transient DB hiccup — a cached-per-mine,
// fail-open design: an error loading the blocklist is treated as "nothing blocked"
// rather than locking every user in the mine out of the whole app. The blocklist is
// normally empty or tiny (a handful of entries an IT Manager has explicitly added),
// so the cache miss cost is negligible either way.
const CACHE_TTL_MS = 30_000;

interface ParsedEntry {
  raw: string;
  net?: { base: number; mask: number };
}

interface CacheEntry {
  entries: ParsedEntry[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function parseEntry(raw: string): ParsedEntry {
  const trimmed = raw.trim();
  const [ipPart, maskPart] = trimmed.split("/");
  const base = parseIpv4(ipPart);
  if (base == null) return { raw: trimmed };
  const mask = maskPart != null ? Number(maskPart) : 32;
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return { raw: trimmed };
  return { raw: trimmed, net: { base, mask } };
}

async function loadEntries(mineId: string): Promise<ParsedEntry[]> {
  const rows = await prisma.cyberBlockedIp.findMany({ where: { mineId }, select: { ipOrCidr: true } });
  return rows.map((r) => parseEntry(r.ipOrCidr));
}

async function getEntries(mineId: string): Promise<ParsedEntry[]> {
  const cached = cache.get(mineId);
  if (cached && cached.expiresAt > Date.now()) return cached.entries;
  try {
    const entries = await loadEntries(mineId);
    cache.set(mineId, { entries, expiresAt: Date.now() + CACHE_TTL_MS });
    return entries;
  } catch {
    // Fail open — see module comment.
    return cached?.entries ?? [];
  }
}

export async function isIpBlocked(mineId: string, ip: string | undefined | null): Promise<boolean> {
  if (!ip) return false;
  // Strip the IPv4-mapped-IPv6 prefix Node sometimes reports (e.g. "::ffff:41.2.3.4").
  const normalized = ip.replace(/^::ffff:/, "");
  const entries = await getEntries(mineId);
  if (entries.length === 0) return false;
  const target = parseIpv4(normalized);
  for (const entry of entries) {
    if (entry.raw === normalized) return true;
    if (target != null && entry.net) {
      const shift = 32 - entry.net.mask;
      const maskBits = shift >= 32 ? 0 : (~0 << shift) >>> 0;
      if ((target & maskBits) === (entry.net.base & maskBits)) return true;
    }
  }
  return false;
}

export function invalidateIpBlocklistCache(mineId: string): void {
  cache.delete(mineId);
}
