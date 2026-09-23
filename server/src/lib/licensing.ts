import crypto from "crypto";
import { prisma } from "../prisma";

// A lapsed expiry date is a calendar event, not a decision by the platform team — unlike
// SUSPENDED/REVOKED, which are deliberate calls that take effect immediately — so it gets
// this many days of continued access before login is actually blocked, giving a genuine
// renewal delay (an invoice in transit, a signature pending) room to resolve without an
// unannounced lockout on a live mine safety system.
const GRACE_PERIOD_DAYS = 14;
// Surfaced as a non-blocking warning this many days before expiry, so it's never a surprise.
const WARN_BEFORE_EXPIRY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function generateLicenseKey(): string {
  const segment = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `MG-${segment()}-${segment()}-${segment()}-${segment()}`;
}

export type LicenseWarningCode = "EXPIRES_SOON" | "GRACE_PERIOD";
export type LicenseBlockCode = "NO_LICENSE" | "SUSPENDED" | "EXPIRED";

export type LicenseCheckResult =
  | { blocked: false; warning: null }
  | { blocked: false; warning: { code: LicenseWarningCode; days: number } }
  | { blocked: true; code: LicenseBlockCode };

/**
 * Whether this mine's access should be restricted, based on its linked Customer's current
 * license. A mine with no Customer record at all isn't opted into the licensing system —
 * treated as unrestricted, rather than retroactively locking out every mine that existed
 * before this feature shipped (see the `customer` field on Mine in schema.prisma).
 */
export async function checkMineLicense(mineId: string): Promise<LicenseCheckResult> {
  const customer = await prisma.customer.findUnique({ where: { mineId }, select: { id: true } });
  if (!customer) return { blocked: false, warning: null };

  const license = await prisma.licenseKey.findFirst({
    where: { customerId: customer.id, status: { not: "REVOKED" } },
    orderBy: { issuedAt: "desc" },
  });
  if (!license) return { blocked: true, code: "NO_LICENSE" };
  if (license.status === "SUSPENDED") return { blocked: true, code: "SUSPENDED" };

  if (license.expiresAt) {
    const now = Date.now();
    const expiry = license.expiresAt.getTime();
    if (now > expiry) {
      const daysOverdue = Math.floor((now - expiry) / DAY_MS);
      if (daysOverdue > GRACE_PERIOD_DAYS) return { blocked: true, code: "EXPIRED" };
      return { blocked: false, warning: { code: "GRACE_PERIOD", days: GRACE_PERIOD_DAYS - daysOverdue } };
    }
    const daysUntilExpiry = Math.ceil((expiry - now) / DAY_MS);
    if (daysUntilExpiry <= WARN_BEFORE_EXPIRY_DAYS) {
      return { blocked: false, warning: { code: "EXPIRES_SOON", days: daysUntilExpiry } };
    }
  }

  return { blocked: false, warning: null };
}
