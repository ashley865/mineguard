import { NextFunction, Request, Response } from "express";
import { BuyerStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { verifyBuyerAuthToken } from "../lib/jwt";

export interface BuyerAuthPayload {
  buyerId: string;
  status: BuyerStatus;
}

declare global {
  namespace Express {
    interface Request {
      buyerAuth?: BuyerAuthPayload;
    }
  }
}

// Parallel to requireAuth (middleware/auth.ts), but for the buyer-portal principal type
// entirely — separate token audience (see lib/jwt.ts), separate table, no staff role or
// mine membership involved. A buyer token can never satisfy requireAuth and a staff token
// can never satisfy this, so the two auth systems can't be crossed into one another.
export async function requireBuyerAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  const token = header.slice("Bearer ".length);

  let buyerId: string;
  try {
    buyerId = verifyBuyerAuthToken(token).buyerId;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId }, select: { id: true, status: true } });
  if (!buyer) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  // A suspended buyer is rejected immediately on its very next request, even with an
  // already-issued, still-valid token — the same "takes effect on the next request"
  // behavior as a deactivated staff account in requireAuth.
  if (buyer.status === "SUSPENDED") {
    return res.status(403).json({ error: "This buyer account has been suspended" });
  }
  req.buyerAuth = { buyerId: buyer.id, status: buyer.status };
  next();
}
