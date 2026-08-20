import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";

const router = Router();

const DORMANT_THRESHOLD_DAYS = 60;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

// Any authenticated user in the mine can be assigned security work, so the *content*
// of this list is broad — but calling the endpoint itself is still restricted to the
// Cyber Command Center's own audience, same as every other route in this module.
router.get("/assignable-users", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
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
  if (!(await requireCyberAccess(req, res))) return;
  const dormantSince = new Date(Date.now() - DORMANT_THRESHOLD_DAYS * 86400000);

  const [users, recentEvents, buyers, visitors, activeBlacklist, gateLogs, contractors] = await Promise.all([
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
        contractor: { select: { id: true, companyName: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    // Buyers aren't scoped to a single mine (the marketplace is shared), so "belongs to
    // this mine's identity picture" means having actually bid on one of this mine's
    // listings — not every registered buyer in the whole system.
    prisma.buyer.findMany({
      where: { bids: { some: { listing: { site: { mineId } } } } },
      select: {
        id: true,
        legalName: true,
        contactEmail: true,
        status: true,
        passwordHash: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { bids: { where: { listing: { site: { mineId } } } } } },
      },
      orderBy: { legalName: "asc" },
      take: 200,
    }),
    prisma.visitor.findMany({
      where: { site: { mineId } },
      select: {
        id: true,
        fullName: true,
        company: true,
        hostName: true,
        site: { select: { id: true, name: true } },
        status: true,
        scheduledFor: true,
        checkInAt: true,
        checkOutAt: true,
      },
      orderBy: { scheduledFor: "desc" },
      take: 200,
    }),
    // Same "who's currently barred" set Access Control's own gate-log-entry endpoint checks
    // against at creation time (see accessControl.ts) — recomputed here against the
    // *current* blacklist, so a person added to the list after they were logged still
    // surfaces retroactively, which is exactly the kind of thing a security review needs.
    prisma.securityBlacklistEntry.findMany({
      where: { isActive: true, OR: [{ site: { mineId } }, { siteId: null }] },
      select: { name: true, vehicleReg: true, reason: true },
    }),
    prisma.gateLog.findMany({
      where: { site: { mineId } },
      select: {
        id: true,
        personName: true,
        company: true,
        vehicleReg: true,
        direction: true,
        gateName: true,
        loggedAt: true,
        site: { select: { id: true, name: true } },
      },
      orderBy: { loggedAt: "desc" },
      take: 300,
    }),
    // Unlike Buyer, a Contractor belongs directly to one site/mine, so this is scoped the
    // same simple way as staff Users — no bid-based derivation needed.
    prisma.contractor.findMany({
      where: { site: { mineId } },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        status: true,
        passwordHash: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { permitsToWork: true } },
      },
      orderBy: { companyName: "asc" },
      take: 200,
    }),
  ]);

  // Digital access threats (below) are IP-based; this is the physical-access equivalent —
  // someone the mine has explicitly barred was nonetheless logged moving through a gate.
  const blacklistedNames = new Set(activeBlacklist.map((b) => b.name.toLowerCase()));
  const blacklistedVehicles = new Set(
    activeBlacklist.filter((b): b is typeof b & { vehicleReg: string } => !!b.vehicleReg).map((b) => b.vehicleReg.toLowerCase())
  );
  const physicalAccessAlerts = gateLogs
    .filter(
      (g) =>
        blacklistedNames.has(g.personName.toLowerCase()) ||
        (g.vehicleReg && blacklistedVehicles.has(g.vehicleReg.toLowerCase()))
    )
    .map((g) => {
      const matched = activeBlacklist.find(
        (b) =>
          b.name.toLowerCase() === g.personName.toLowerCase() ||
          (g.vehicleReg && b.vehicleReg?.toLowerCase() === g.vehicleReg.toLowerCase())
      );
      return { ...g, matchedReason: matched?.reason ?? null };
    });

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
    totalBuyers: buyers.length,
    buyers: buyers.map((b) => ({
      id: b.id,
      legalName: b.legalName,
      contactEmail: b.contactEmail,
      status: b.status,
      hasPortalAccess: !!b.passwordHash,
      lastLoginAt: b.lastLoginAt,
      bidCount: b._count.bids,
      createdAt: b.createdAt,
    })),
    totalVisitors: visitors.length,
    visitors,
    physicalAccessAlerts,
    totalContractors: contractors.length,
    contractors: contractors.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      contactEmail: c.contactEmail,
      status: c.status,
      hasPortalAccess: !!c.passwordHash,
      lastLoginAt: c.lastLoginAt,
      permitCount: c._count.permitsToWork,
      createdAt: c.createdAt,
    })),
  });
});

// MFA is real (TOTP, enforced at login — see routes/auth.ts) and tied to a secret only the
// user's own authenticator app holds, so there is no "enable on someone's behalf" action
// here. This only ever resets — for a lost/replaced device or a suspected compromise — so
// the user can re-enroll from scratch via their own POST /auth/mfa/setup.
router.post("/users/:id/mfa-reset", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "User not found" });
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { mfaEnabled: false, mfaSecret: null },
    select: { id: true, name: true, mfaEnabled: true },
  });
  res.json(user);
});

export default router;
