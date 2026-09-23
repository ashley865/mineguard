import crypto from "crypto";
import bcrypt from "bcryptjs";

// Same shape as lib/sensorApiKeys.ts — prefixed so a key found loose is identifiable as a
// MineGuard platform-admin credential, distinct from a sensor ("mgs_") or agent ("mga_")
// key, which grant far narrower access than this one (every customer and license).
export interface GeneratedPlatformAdminKey {
  /** Shown once, at issue time — only the hash is stored. */
  key: string;
  hash: string;
}

export async function generatePlatformAdminAccessKey(): Promise<GeneratedPlatformAdminKey> {
  const key = `mgpa_${crypto.randomBytes(24).toString("hex")}`;
  return { key, hash: await bcrypt.hash(key, 12) };
}

export async function verifyPlatformAdminAccessKey(presented: string, hash: string): Promise<boolean> {
  return bcrypt.compare(presented, hash);
}
