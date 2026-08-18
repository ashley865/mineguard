import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const DORMANT_THRESHOLD_DAYS = 60;

router.use(requireAuth);

// Any authenticated user in the mine can be assigned security work, so this powers
// the "assign to" dropdowns across vulnerabilities/incidents/alerts.
router.get("/assignable-users", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const users = await prisma.user.findMany({
    where: { mineId, isActive: true, role: { in: ["ADMIN", "SUPERVISOR", "EXECUTIVE"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

router.get("/overview", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const dormantSince = new Date(Date.now() - DORMANT_THRESHOLD_DAYS * 86400000);

  const [users, recentEvents] = await Promise.all([
    prisma.user.findMany({
      where: { mineId },
      select: { id: true, name: true, email: true, role: true, title: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.cyberLoginEvent.findMany({
      where: { mineId },
      select: {
        id: true,
        eventType: true,
        ipAddress: true,
        userAgent: true,
        flagged: true,
        occurredAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
  ]);

  const privilegedAccounts = users.filter((u) => u.role === "ADMIN" || u.role === "EXECUTIVE");
  const dormantUsers = users.filter(
    (u) => u.isActive && (u.lastLoginAt == null ? u.createdAt < dormantSince : u.lastLoginAt < dormantSince)
  );
  const mfaGapAccounts = privilegedAccounts.filter((u) => u.isActive && !u.mfaEnabled);

  res.json({
    totalUsers: users.length,
    privilegedAccounts: privilegedAccounts.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, mfaEnabled: u.mfaEnabled })),
    dormantUsers: dormantUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, lastLoginAt: u.lastLoginAt })),
    mfaGapCount: mfaGapAccounts.length,
    recentEvents,
    accessViolations: recentEvents.filter((e) => e.flagged),
  });
});

const mfaSchema = z.object({ mfaEnabled: z.boolean() });

router.put("/users/:id/mfa", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = mfaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "User not found" });
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { mfaEnabled: parsed.data.mfaEnabled },
    select: { id: true, name: true, mfaEnabled: true },
  });
  res.json(user);
});

export default router;
