import crypto from "crypto";
import bcrypt from "bcryptjs";

// Prefixed so a key found loose in a config file, a support ticket or a log is
// immediately identifiable as a MineGuard credential rather than an anonymous hex blob
// nobody can place — and so a sensor key ("mgs_") isn't mistaken for an agent key
// ("mga_"), which grants far more: every sensor assigned to that agent.
export interface GeneratedSensorKey {
  /** Shown to IT exactly once, at issue time — only the hash is stored. */
  key: string;
  hash: string;
}

export async function generateSensorApiKey(prefix = "mgs_"): Promise<GeneratedSensorKey> {
  const key = `${prefix}${crypto.randomBytes(24).toString("hex")}`;
  return { key, hash: await bcrypt.hash(key, 12) };
}

export async function verifySensorApiKey(presented: string, hash: string): Promise<boolean> {
  return bcrypt.compare(presented, hash);
}
