import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { verifyAuthToken } from "../lib/jwt";
import { requestContextStorage } from "../lib/requestContext";

export interface AuthPayload {
  userId: string;
  role: Role;
  mineId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  const token = header.slice("Bearer ".length);

  let userId: string;
  try {
    // Validates signature (HS256 only), issuer, audience, and expiry.
    userId = verifyAuthToken(token).userId;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    // Role and mine membership are always re-read from the database on every
    // request, never trusted from the token payload itself. This means a role
    // change (promotion, demotion, removal from a mine) takes effect on the
    // user's very next request instead of waiting out the token's lifetime.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, mineId: true, isActive: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    // A banned account (isActive: false) is rejected immediately on its very next
    // request, the same way a role/mine change takes effect without waiting for the
    // token to expire — a removed executive can't keep using an already-issued token.
    if (!user.isActive) {
      return res.status(403).json({ error: "This account has been deactivated" });
    }
    req.auth = { userId: user.id, role: user.role, mineId: user.mineId };
    // Everything downstream of this call — including any awaited Prisma writes deep in a
    // route handler — runs inside this store, so the audit extension can attribute writes
    // to the requester without every route needing to pass userId/mineId through explicitly.
    requestContextStorage.run({ userId: user.id, mineId: user.mineId }, next);
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
