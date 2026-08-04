import jwt from "jsonwebtoken";

const ISSUER = "mineguard-api";
const AUDIENCE = "mineguard-client";

export interface TokenPayload {
  userId: string;
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
