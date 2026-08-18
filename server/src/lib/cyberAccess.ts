import { Request, Response } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";

// High-risk cybersecurity actions (resolving a CRITICAL incident, accepting risk on a
// CRITICAL vulnerability, etc.) require sign-off from someone with an actual security
// mandate — the mine owner or the IT Manager specifically — not just any executive,
// mirroring requireExpenseApprovalAccess/requireFinanceAccess elsewhere in the app.
const CYBER_APPROVAL_AUDIENCE: ExecutiveTitle[] = ["IT_MANAGER"];

export async function requireCyberApprovalAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !CYBER_APPROVAL_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}
