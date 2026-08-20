import crypto from "crypto";

// A self-contained RFC 6238 TOTP implementation (the algorithm every authenticator app —
// Google Authenticator, Authy, 1Password, etc. — speaks) built on Node's built-in crypto
// rather than pulling in a dependency for what's a well-defined ~100-line spec: HMAC-SHA1
// over a 30-second time counter, base32-encoded secret, 6-digit truncated output.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// 20 random bytes (160 bits) is the standard TOTP secret size — matches what every
// authenticator app expects and generates itself.
export function generateMfaSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secretBytes: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  // TOTP counters never approach 2^32, so writing the high 32 bits as 0 and the low 32
  // bits as the counter (big-endian) covers the full practical range.
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);
  const hmac = crypto.createHmac("sha1", secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(truncated % 10 ** DIGITS).padStart(DIGITS, "0");
}

// Accepts the current time step plus one step on either side (±30s of clock drift) —
// the standard tolerance window every TOTP implementation allows, since the user's phone
// clock and the server clock are never perfectly in sync.
export function verifyMfaToken(base32Secret: string, token: string): boolean {
  const cleanedToken = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanedToken)) return false;
  const secretBytes = base32Decode(base32Secret);
  if (secretBytes.length === 0) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    if (hotp(secretBytes, counter + drift) === cleanedToken) return true;
  }
  return false;
}

export function buildOtpAuthUrl(base32Secret: string, accountLabel: string, issuer = "MineGuard"): string {
  const encodedLabel = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodedLabel}?${params.toString()}`;
}
