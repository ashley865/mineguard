import nodemailer from "nodemailer";
import { resolveBooleanSetting, resolveIntSetting, resolveSetting } from "./systemSettings";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function buildTransport() {
  const host = await resolveSetting("SMTP_HOST");
  const fromEmail = await resolveSetting("SMTP_FROM_EMAIL");
  if (!host || !fromEmail) return null;

  const [port, secure, user, pass, fromName] = await Promise.all([
    resolveIntSetting("SMTP_PORT", 587),
    resolveBooleanSetting("SMTP_SECURE", false),
    resolveSetting("SMTP_USER"),
    resolveSetting("SMTP_PASSWORD"),
    resolveSetting("SMTP_FROM_NAME"),
  ]);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return { transporter, from: `"${fromName || "MineGuard"}" <${fromEmail}>` };
}

export async function isEmailConfigured(): Promise<boolean> {
  return !!(await resolveSetting("SMTP_HOST")) && !!(await resolveSetting("SMTP_FROM_EMAIL"));
}

// Fire-and-forget by design — a misconfigured or unreachable mail server must never break
// the request/notification flow that triggered the email, the same fail-open reasoning as
// notifySecurityWebhook. Callers that need to know whether it actually sent (the "Test
// connection" button) should use sendTestEmail instead.
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    const built = await buildTransport();
    if (!built) return;
    await built.transporter.sendMail({ from: built.from, to: message.to, subject: message.subject, html: message.html, text: message.text });
  } catch {
    // Best-effort only — see comment above.
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
  const built = await buildTransport();
  if (!built) return { success: false, message: "SMTP host and from-address must both be configured first" };
  try {
    await built.transporter.sendMail({
      from: built.from,
      to: toEmail,
      subject: "MineGuard test email",
      text: "This is a test email from Cyber Command Center's System Configuration panel. If you're reading this, outgoing email is configured correctly.",
      html: "<p>This is a test email from Cyber Command Center's System Configuration panel.</p><p>If you're reading this, outgoing email is configured correctly.</p>",
    });
    return { success: true, message: `Test email sent to ${toEmail}` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Failed to send test email" };
  }
}
