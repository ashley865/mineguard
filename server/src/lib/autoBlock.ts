import { prisma } from "../prisma";
import { invalidateIpBlocklistCache, invalidateGlobalIpBlocklistCache } from "./ipBlocklist";
import { resolveIntSetting } from "./systemSettings";
import { notifySecurityWebhook } from "./securityWebhook";

// Defaults used until an admin overrides them from Cyber Command Center's System
// Configuration tab (BRUTE_FORCE_THRESHOLD / BRUTE_FORCE_WINDOW_HOURS) — Identity &
// Access's "Access Threats" view uses the same resolved values to surface brute-force IPs
// (see cyberAccessControl.ts) as this module uses to enforce them, so detection and
// enforcement can never drift out of sync with each other.
export const DEFAULT_BRUTE_FORCE_THRESHOLD = 5;
export const DEFAULT_BRUTE_FORCE_WINDOW_HOURS = 24;

export async function getBruteForceThreshold(): Promise<number> {
  return resolveIntSetting("BRUTE_FORCE_THRESHOLD", DEFAULT_BRUTE_FORCE_THRESHOLD);
}

export async function getBruteForceWindowHours(): Promise<number> {
  return resolveIntSetting("BRUTE_FORCE_WINDOW_HOURS", DEFAULT_BRUTE_FORCE_WINDOW_HOURS);
}

// Called after every failed staff or contractor login (both write into the same
// mine-scoped CyberLoginEvent table) — counts recent failures from this IP against this
// mine and, once the threshold is crossed, adds it to that mine's own blocklist.
export async function autoBlockMineIpIfBruteForced(mineId: string, ipAddress: string | undefined | null): Promise<void> {
  if (!ipAddress) return;
  try {
    const [threshold, windowHours] = await Promise.all([getBruteForceThreshold(), getBruteForceWindowHours()]);
    const since = new Date(Date.now() - windowHours * 3600000);
    const count = await prisma.cyberLoginEvent.count({
      where: { mineId, ipAddress, eventType: "LOGIN_FAILED", occurredAt: { gte: since } },
    });
    if (count < threshold) return;
    const already = await prisma.cyberBlockedIp.findUnique({ where: { mineId_ipOrCidr: { mineId, ipOrCidr: ipAddress } } });
    if (already) return;
    await prisma.cyberBlockedIp.create({
      data: {
        mineId,
        ipOrCidr: ipAddress,
        reason: `Auto-blocked after ${count} failed login attempts within ${windowHours} hours`,
        autoBlocked: true,
      },
    });
    invalidateIpBlocklistCache(mineId);
    void notifySecurityWebhook({
      severity: "AUTO_BLOCK",
      title: "IP auto-blocked after repeated failed logins",
      detail: `${ipAddress} was blocked after ${count} failed login attempts within ${windowHours} hours.`,
    });
  } catch {
    // Detection is a best-effort enhancement layered on top of login — never let it
    // fail the login request itself.
  }
}

// Same idea, but for the marketplace-wide BuyerLoginEvent table (see schema.prisma) —
// buyer login has no mine to scope a block to, so a confirmed brute-force IP is added to
// the shared GlobalBlockedIp list instead, protecting every mine's marketplace at once.
export async function autoBlockGlobalIpIfBruteForced(ipAddress: string | undefined | null): Promise<void> {
  if (!ipAddress) return;
  try {
    const [threshold, windowHours] = await Promise.all([getBruteForceThreshold(), getBruteForceWindowHours()]);
    const since = new Date(Date.now() - windowHours * 3600000);
    const count = await prisma.buyerLoginEvent.count({
      where: { ipAddress, eventType: "LOGIN_FAILED", occurredAt: { gte: since } },
    });
    if (count < threshold) return;
    const already = await prisma.globalBlockedIp.findUnique({ where: { ipOrCidr: ipAddress } });
    if (already) return;
    await prisma.globalBlockedIp.create({
      data: {
        ipOrCidr: ipAddress,
        reason: `Auto-blocked after ${count} failed buyer login attempts within ${windowHours} hours`,
        autoBlocked: true,
      },
    });
    invalidateGlobalIpBlocklistCache();
    void notifySecurityWebhook({
      severity: "AUTO_BLOCK",
      title: "Buyer IP auto-blocked marketplace-wide after repeated failed logins",
      detail: `${ipAddress} was blocked after ${count} failed buyer login attempts within ${windowHours} hours.`,
    });
  } catch {
    // Same fail-open reasoning as above.
  }
}
