import { prisma } from "../prisma";
import { sendEmail } from "../lib/email";
import { DAY_MS, GRACE_PERIOD_DAYS, WARN_BEFORE_EXPIRY_DAYS } from "../lib/licensing";

/**
 * Emails a customer's contact once — and only once — the first time their license enters
 * the "expiring soon" window, and again the first time it enters its post-expiry grace
 * period (see lib/licensing.ts for what those windows mean and how login enforcement uses
 * them). Idempotent via expiryReminderSentAt/graceReminderSentAt on LicenseKey, so running
 * this hourly (see index.ts) never sends the same warning twice, and a missed run just
 * catches up on the next tick rather than losing the reminder.
 */
export async function sendLicenseRenewalReminders(): Promise<void> {
  const now = Date.now();
  const licenses = await prisma.licenseKey.findMany({
    where: { status: "ACTIVE", expiresAt: { not: null } },
    select: {
      id: true,
      key: true,
      plan: true,
      expiresAt: true,
      expiryReminderSentAt: true,
      graceReminderSentAt: true,
      customer: { select: { companyName: true, contactName: true, contactEmail: true } },
    },
  });

  for (const license of licenses) {
    if (!license.expiresAt) continue;
    const daysUntil = Math.ceil((license.expiresAt.getTime() - now) / DAY_MS);

    if (daysUntil >= 0 && daysUntil <= WARN_BEFORE_EXPIRY_DAYS && !license.expiryReminderSentAt) {
      await sendEmail({
        to: license.customer.contactEmail,
        subject: `Your MineGuard license expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
        text: `Hi ${license.customer.contactName},\n\n${license.customer.companyName}'s MineGuard ${license.plan} license (${license.key}) expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}. Contact your account manager to renew before then to avoid any interruption.\n\n— MineGuard`,
        html: `<p>Hi ${license.customer.contactName},</p><p>${license.customer.companyName}'s MineGuard ${license.plan} license (<code>${license.key}</code>) expires in <strong>${daysUntil} day${daysUntil === 1 ? "" : "s"}</strong>. Contact your account manager to renew before then to avoid any interruption.</p><p>— MineGuard</p>`,
      });
      await prisma.licenseKey.update({ where: { id: license.id }, data: { expiryReminderSentAt: new Date() } }).catch(() => {});
      continue;
    }

    if (daysUntil < 0) {
      const daysOverdue = -daysUntil;
      if (daysOverdue <= GRACE_PERIOD_DAYS && !license.graceReminderSentAt) {
        const daysRemaining = GRACE_PERIOD_DAYS - daysOverdue;
        await sendEmail({
          to: license.customer.contactEmail,
          subject: `Action needed: ${license.customer.companyName}'s MineGuard license has expired`,
          text: `Hi ${license.customer.contactName},\n\n${license.customer.companyName}'s MineGuard ${license.plan} license (${license.key}) expired. Access continues for ${daysRemaining} more day${daysRemaining === 1 ? "" : "s"} before it's suspended. Contact your account manager to renew now.\n\n— MineGuard`,
          html: `<p>Hi ${license.customer.contactName},</p><p>${license.customer.companyName}'s MineGuard ${license.plan} license (<code>${license.key}</code>) expired. Access continues for <strong>${daysRemaining} more day${daysRemaining === 1 ? "" : "s"}</strong> before it's suspended. Contact your account manager to renew now.</p><p>— MineGuard</p>`,
        });
        await prisma.licenseKey.update({ where: { id: license.id }, data: { graceReminderSentAt: new Date() } }).catch(() => {});
      }
    }
  }
}
