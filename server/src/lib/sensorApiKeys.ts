import crypto from "crypto";
import bcrypt from "bcryptjs";

// Prefixed so a key found loose in a config file, a support ticket or a log is
// immediately identifiable as a MineGuard sensor credential rather than an
// anonymous hex blob nobody can place.
const KEY_PREFIX = "mgs_";

export interface GeneratedSensorKey {
  /** Shown to IT exactly once, at issue time — only the hash is stored. */
  key: string;
  hash: string;
}

export async function generateSensorApiKey(): Promise<GeneratedSensorKey> {
  const key = `${KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
  return { key, hash: await bcrypt.hash(key, 12) };
}

export async function verifySensorApiKey(presented: string, hash: string): Promise<boolean> {
  return bcrypt.compare(presented, hash);
}
