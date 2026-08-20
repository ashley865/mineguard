import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

// "The 6-digit code the IT Manager can set" — a single-use fallback for a user locked out
// of their TOTP authenticator app, distinct from the TOTP code itself (lib/totp.ts), which
// is algorithmically derived every 30 seconds and can never be hand-picked without
// defeating MFA. Only an Owner/IT Manager can generate one (see routes/cyberIdentity.ts),
// never the user for themselves, and it's shown in plaintext exactly once at creation.
function generateSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Revokes any previous unused code for this user, then issues a new one. Returns the plaintext code — shown once, never retrievable again. */
export async function issueBackupCode(userId: string, generatedById: string | null, generatedByName: string | null): Promise<string> {
  await prisma.mfaBackupCode.updateMany({
    where: { userId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 12);
  await prisma.mfaBackupCode.create({
    data: { userId, codeHash, generatedById, generatedByName },
  });
  return code;
}

/**
 * Checks `code` against this user's single active backup code and, if it matches, consumes
 * it (marks it used, so it can never be replayed). Called as a fallback during login only
 * after the submitted code has already failed TOTP verification — see routes/auth.ts.
 */
export async function verifyAndConsumeBackupCode(
  userId: string,
  code: string,
  ipAddress: string | undefined,
  userAgent: string | string[] | undefined
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const active = await prisma.mfaBackupCode.findFirst({
    where: { userId, usedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return false;
  const matches = await bcrypt.compare(code, active.codeHash);
  if (!matches) return false;
  await prisma.mfaBackupCode.update({
    where: { id: active.id },
    data: { usedAt: new Date(), usedIpAddress: ipAddress, usedUserAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent },
  });
  return true;
}
