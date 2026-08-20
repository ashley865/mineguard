import { Request, Response } from "express";
import { ExecutiveTitle, Role } from "@prisma/client";
import { prisma } from "../prisma";

// The entire Cyber Command Center — every route in every cyber*.ts file, GETs included
// — is restricted to the mine owner and the IT Manager specifically. Cybersecurity data
// (vulnerabilities, incidents, compromised endpoints, other users' login activity) isn't
// broadly appropriate for every Supervisor/Viewer or unrelated executive to see, unlike
// most of the app's read endpoints. Callers apply `requireRole("ADMIN", "EXECUTIVE")` as
// router-level middleware first (screens out SUPERVISOR/VIEWER cheaply), then this
// narrows EXECUTIVE further to the IT_MANAGER title.
const CYBER_AUDIENCE: ExecutiveTitle[] = ["IT_MANAGER"];

// Shared by requireCyberAccess (route gate) and the maintenance-mode login check
// (lib/systemSettings.ts / routes/auth.ts) — whoever can turn maintenance mode ON from
// Cyber Command Center must always be able to log back IN while it's on, or they'd lock
// themselves out of the only place that can turn it back off.
export function isCyberPrivilegedUser(role: Role, title: ExecutiveTitle | null): boolean {
  if (role === "ADMIN") return true;
  if (role !== "EXECUTIVE") return false;
  return !!title && CYBER_AUDIENCE.includes(title);
}

export async function requireCyberAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!isCyberPrivilegedUser(req.auth!.role, me?.title ?? null)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}
