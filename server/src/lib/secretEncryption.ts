import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Outbound credentials a sensor poll presents to a third-party API (see pollAuthSecretEnc on
 * Sensor) have to be recoverable — MineGuard sends them on, it doesn't just verify them the
 * way it does the sensor's own push apiKeyHash — so they're encrypted rather than hashed.
 * SENSOR_SECRET_KEY can be any length; hashing it to 32 bytes avoids forcing a specific key
 * length on whoever sets the env var.
 */
function getKey(): Buffer {
  const raw = process.env.SENSOR_SECRET_KEY;
  if (!raw) throw new Error("SENSOR_SECRET_KEY is not configured");
  return crypto.createHash("sha256").update(raw).digest();
}

export function isSecretEncryptionConfigured(): boolean {
  return !!process.env.SENSOR_SECRET_KEY;
}

/** Returns iv.authTag.ciphertext, each base64, joined with ".". */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
