import { NextFunction, Request, Response } from "express";
import { ContractorStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { verifyContractorAuthToken } from "../lib/jwt";
import { isIpBlocked } from "../lib/ipBlocklist";

export interface ContractorAuthPayload {
  contractorId: string;
  siteId: string;
  mineId: string;
  status: ContractorStatus;
}

declare global {
  namespace Express {
    interface Request {
      contractorAuth?: ContractorAuthPayload;
    }
  }
}

// Parallel to requireBuyerAuth, but for contractors — who, unlike buyers, belong to
// exactly one site/mine, so this can enforce that mine's own IP blocklist directly on
// every request, the same protection staff get from requireAuth.
export async function requireContractorAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  const token = header.slice("Bearer ".length);

  let contractorId: string;
  try {
    contractorId = verifyContractorAuthToken(token).contractorId;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, status: true, siteId: true, site: { select: { mineId: true } } },
  });
  if (!contractor) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  if (contractor.status === "TERMINATED" || contractor.status === "SUSPENDED") {
    return res.status(403).json({ error: "This contractor account is no longer active" });
  }
  if (await isIpBlocked(contractor.site.mineId, req.ip)) {
    return res.status(403).json({ error: "Access blocked from this network" });
  }
  req.contractorAuth = { contractorId: contractor.id, siteId: contractor.siteId, mineId: contractor.site.mineId, status: contractor.status };
  next();
}
