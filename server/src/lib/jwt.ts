import jwt from "jsonwebtoken";

const ISSUER = "mineguard-api";
const AUDIENCE = "mineguard-client";
// Deliberately distinct from AUDIENCE: jwt.verify enforces an exact audience match, so a
// buyer token can never be presented to requireAuth (the staff app) and a staff token can
// never be presented to requireBuyerAuth (the buyer portal) — the two principal types are
// cryptographically unable to cross into each other's routes, without either verifier
// needing to inspect a "type" claim that a forged/tampered token could try to spoof.
const BUYER_AUDIENCE = "mineguard-buyer-client";

export interface TokenPayload {
  userId: string;
}

export interface BuyerTokenPayload {
  buyerId: string;
}

/**
 * Only userId goes in the token. Role and mine membership are re-read from the
 * database on every request (see requireAuth) so a token can never carry stale
 * or forged privilege — see "never trust role information supplied by the browser".
 */
export function signAuthToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

export function verifyAuthToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof decoded !== "object" || decoded === null || typeof (decoded as any).userId !== "string") {
    throw new Error("Malformed token payload");
  }
  return { userId: (decoded as any).userId };
}

// Same signing secret and issuer as staff tokens (no new secret to provision), but a
// separate audience — see BUYER_AUDIENCE above — and its own status re-check in
// requireBuyerAuth, mirroring how requireAuth re-reads role/isActive on every request.
export function signBuyerAuthToken(buyerId: string): string {
  return jwt.sign({ buyerId }, process.env.JWT_SECRET as string, {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: BUYER_AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

export function verifyBuyerAuthToken(token: string): BuyerTokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: BUYER_AUDIENCE,
  });
  if (typeof decoded !== "object" || decoded === null || typeof (decoded as any).buyerId !== "string") {
    throw new Error("Malformed token payload");
  }
  return { buyerId: (decoded as any).buyerId };
}
