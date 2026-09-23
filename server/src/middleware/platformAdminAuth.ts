import { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma";
import { verifyPlatformAdminToken } from "../lib/jwt";

export interface PlatformAdminAuthPayload {
  platformAdminId: string;
}

declare global {
  namespace Express {
    interface Request {
      platformAdminAuth?: PlatformAdminAuthPayload;
    }
  }
}

// Parallel to requireAuth/requireBuyerAuth/requireContractorAuth, but for the platform
// team's own accounts — a principal type with no relation to any Mine/User, since this is
// the one part of the system that legitimately needs to see across every tenant.
export async function requirePlatformAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  const token = header.slice("Bearer ".length);

  let platformAdminId: string;
  try {
    platformAdminId = verifyPlatformAdminToken(token).platformAdminId;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { id: platformAdminId }, select: { id: true } });
  if (!admin) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.platformAdminAuth = { platformAdminId: admin.id };
  next();
}
