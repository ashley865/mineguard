import { prisma } from "../prisma";
import { invalidateIpBlocklistCache, invalidateGlobalIpBlocklistCache } from "./ipBlocklist";

// Same threshold/window Identity & Access's "Access Threats" view already uses to
// surface brute-force IPs (see cyberAccessControl.ts) — an IP that crosses this line is
// no longer just "worth watching," it gets enforced automatically instead of waiting for
// an admin to notice the dashboard and click Block.
export const BRUTE_FORCE_WINDOW_HOURS = 24;
export const BRUTE_FORCE_THRESHOLD = 5;

// Called after every failed staff or contractor login (both write into the same
// mine-scoped CyberLoginEvent table) — counts recent failures from this IP against this
// mine and, once the threshold is crossed, adds it to that mine's own blocklist.
export async function autoBlockMineIpIfBruteForced(mineId: string, ipAddress: string | undefined | null): Promise<void> {
  if (!ipAddress) return;
  try {
    const since = new Date(Date.now() - BRUTE_FORCE_WINDOW_HOURS * 3600000);
    const count = await prisma.cyberLoginEvent.count({
      where: { mineId, ipAddress, eventType: "LOGIN_FAILED", occurredAt: { gte: since } },
    });
    if (count < BRUTE_FORCE_THRESHOLD) return;
    const already = await prisma.cyberBlockedIp.findUnique({ where: { mineId_ipOrCidr: { mineId, ipOrCidr: ipAddress } } });
    if (already) return;
    await prisma.cyberBlockedIp.create({
      data: {
        mineId,
        ipOrCidr: ipAddress,
        reason: `Auto-blocked after ${count} failed login attempts within ${BRUTE_FORCE_WINDOW_HOURS} hours`,
        autoBlocked: true,
      },
    });
    invalidateIpBlocklistCache(mineId);
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
    const since = new Date(Date.now() - BRUTE_FORCE_WINDOW_HOURS * 3600000);
    const count = await prisma.buyerLoginEvent.count({
      where: { ipAddress, eventType: "LOGIN_FAILED", occurredAt: { gte: since } },
    });
    if (count < BRUTE_FORCE_THRESHOLD) return;
    const already = await prisma.globalBlockedIp.findUnique({ where: { ipOrCidr: ipAddress } });
    if (already) return;
    await prisma.globalBlockedIp.create({
      data: {
        ipOrCidr: ipAddress,
        reason: `Auto-blocked after ${count} failed buyer login attempts within ${BRUTE_FORCE_WINDOW_HOURS} hours`,
        autoBlocked: true,
      },
    });
    invalidateGlobalIpBlocklistCache();
  } catch {
    // Same fail-open reasoning as above.
  }
}
