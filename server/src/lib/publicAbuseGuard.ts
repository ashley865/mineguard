import { prisma } from "../prisma";
import { invalidateIpBlocklistCache, invalidateGlobalIpBlocklistCache } from "./ipBlocklist";
import { notifySecurityWebhook } from "./securityWebhook";

export type PublicFormType = "VISITOR_CHECKIN" | "CONTRACTOR_REGISTER" | "BUYER_REGISTER" | "MINERAL_BID" | "CONTRACT_BID";

// How many submissions from one IP within the window are tolerated before that IP is
// auto-blocked — tuned per form to roughly how often a genuine person would ever submit
// one: a real visitor checks in once, a real bidder might place a handful of bids.
const BURST_WINDOW_MINUTES = 15;
const BURST_THRESHOLD: Record<PublicFormType, number> = {
  VISITOR_CHECKIN: 5,
  CONTRACTOR_REGISTER: 5,
  BUYER_REGISTER: 5,
  MINERAL_BID: 8,
  CONTRACT_BID: 8,
};

const FORM_LABEL: Record<PublicFormType, string> = {
  VISITOR_CHECKIN: "visitor check-ins",
  CONTRACTOR_REGISTER: "contractor registrations",
  BUYER_REGISTER: "buyer registrations",
  MINERAL_BID: "marketplace bids",
  CONTRACT_BID: "tender bids",
};

/**
 * Logs one public-form submission and auto-blocks the submitting IP the moment it crosses
 * a burst threshold within a short window — the same reasoning as lib/autoBlock.ts's login
 * brute-force protection, extended to forms that have no login/failure concept of their
 * own to count against. The submission that crosses the threshold still succeeds (it was
 * already valid) — this only protects every subsequent one, exactly like a brute-forced
 * login: the Nth failed attempt still returns "invalid password," and the block bites on
 * attempt N+1. Pass `mineId` for a form tied to one mine (checkin, contractor register,
 * a mineral/tender bid on that mine's listing) — the block only applies there. Omit it for
 * a mine-independent form (buyer register) — the block applies platform-wide.
 */
export async function recordPublicSubmission(formType: PublicFormType, ip: string | undefined | null, mineId?: string | null): Promise<void> {
  if (!ip) return;
  try {
    await prisma.publicSubmissionEvent.create({ data: { formType, ip, mineId: mineId ?? null } });
    const since = new Date(Date.now() - BURST_WINDOW_MINUTES * 60_000);
    const count = await prisma.publicSubmissionEvent.count({ where: { formType, ip, createdAt: { gte: since } } });
    if (count < BURST_THRESHOLD[formType]) return;

    const reason = `Auto-blocked after ${count} ${FORM_LABEL[formType]} within ${BURST_WINDOW_MINUTES} minutes`;
    if (mineId) {
      const already = await prisma.cyberBlockedIp.findUnique({ where: { mineId_ipOrCidr: { mineId, ipOrCidr: ip } } });
      if (already) return;
      await prisma.cyberBlockedIp.create({ data: { mineId, ipOrCidr: ip, reason, autoBlocked: true } });
      invalidateIpBlocklistCache(mineId);
    } else {
      const already = await prisma.globalBlockedIp.findUnique({ where: { ipOrCidr: ip } });
      if (already) return;
      await prisma.globalBlockedIp.create({ data: { ipOrCidr: ip, reason, autoBlocked: true } });
      invalidateGlobalIpBlocklistCache();
    }
    void notifySecurityWebhook({
      severity: "AUTO_BLOCK",
      title: `IP auto-blocked after a burst of ${FORM_LABEL[formType]}`,
      detail: `${ip} submitted ${count} ${FORM_LABEL[formType]} within ${BURST_WINDOW_MINUTES} minutes.`,
    });
  } catch {
    // Best-effort only — abuse detection must never fail the request that triggered it.
  }
}

/**
 * A hidden field real users never see or fill in (see the client forms — positioned
 * off-screen, never `display:none`, which some bots skip specifically). Any non-empty
 * value means whatever submitted this form didn't render like a browser would.
 */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
