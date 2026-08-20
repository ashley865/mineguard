import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";
import { invalidateIpBlocklistCache } from "../lib/ipBlocklist";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

const DEVICE_WINDOW_DAYS = 90;
const BRUTE_FORCE_WINDOW_HOURS = 24;
const BRUTE_FORCE_THRESHOLD = 5;
const MULTI_ACCOUNT_WINDOW_DAYS = 7;

// Deliberately rough — a real UA parser is a whole dependency of its own, and this is
// only ever shown as a human-readable label, never used for any access decision.
function parseDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  return `${os} · ${browser}`;
}

router.get("/devices", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const since = new Date(Date.now() - DEVICE_WINDOW_DAYS * 86400000);

  const groups = await prisma.cyberLoginEvent.groupBy({
    by: ["userId", "contractorId", "ipAddress", "userAgent"],
    where: { mineId, eventType: "LOGIN_SUCCESS", occurredAt: { gte: since } },
    _count: true,
    _min: { occurredAt: true },
    _max: { occurredAt: true },
  });

  const userIds = [...new Set(groups.map((g) => g.userId).filter((id): id is string => !!id))];
  const contractorIds = [...new Set(groups.map((g) => g.contractorId).filter((id): id is string => !!id))];
  const [users, contractors] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    prisma.contractor.findMany({ where: { id: { in: contractorIds } }, select: { id: true, companyName: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u.name]));
  const contractorById = new Map(contractors.map((c) => [c.id, c.companyName]));

  const blockedEntries = await prisma.cyberBlockedIp.findMany({ where: { mineId }, select: { ipOrCidr: true } });
  const blockedRaw = new Set(blockedEntries.map((b) => b.ipOrCidr));

  const devices = groups
    .map((g) => ({
      userId: g.userId,
      userName: g.userId
        ? userById.get(g.userId) ?? "Unknown user"
        : g.contractorId
          ? `${contractorById.get(g.contractorId) ?? "Unknown contractor"} (contractor)`
          : "Unknown user",
      ipAddress: g.ipAddress,
      deviceLabel: parseDeviceLabel(g.userAgent),
      loginCount: g._count,
      firstSeenAt: g._min.occurredAt,
      lastSeenAt: g._max.occurredAt,
      // Exact-match indicator only (CIDR ranges aren't expanded here) — the blocklist
      // tab is still the source of truth for whether a range covers this IP.
      isBlocked: g.ipAddress != null && blockedRaw.has(g.ipAddress),
    }))
    .sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0));

  res.json(devices);
});

router.get("/threats", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;

  const bruteForceSince = new Date(Date.now() - BRUTE_FORCE_WINDOW_HOURS * 3600000);
  const multiAccountSince = new Date(Date.now() - MULTI_ACCOUNT_WINDOW_DAYS * 86400000);

  const [failedEvents, successEvents, blockedEvents] = await Promise.all([
    prisma.cyberLoginEvent.findMany({
      where: { mineId, eventType: "LOGIN_FAILED", occurredAt: { gte: bruteForceSince }, ipAddress: { not: null } },
      select: { ipAddress: true, user: { select: { name: true } }, contractor: { select: { companyName: true } }, occurredAt: true },
    }),
    prisma.cyberLoginEvent.findMany({
      where: { mineId, eventType: "LOGIN_SUCCESS", occurredAt: { gte: multiAccountSince }, ipAddress: { not: null } },
      select: { ipAddress: true, userId: true, contractorId: true },
    }),
    prisma.cyberLoginEvent.findMany({
      where: { mineId, eventType: "BLOCKED", occurredAt: { gte: bruteForceSince } },
      select: { ipAddress: true, user: { select: { name: true } }, contractor: { select: { companyName: true } }, occurredAt: true },
    }),
  ]);

  const byIpFailed = new Map<string, { count: number; usernames: Set<string>; lastAttempt: Date }>();
  for (const e of failedEvents) {
    const ip = e.ipAddress!;
    const bucket = byIpFailed.get(ip) ?? { count: 0, usernames: new Set<string>(), lastAttempt: e.occurredAt };
    bucket.count += 1;
    const label = e.user?.name ?? (e.contractor ? `${e.contractor.companyName} (contractor)` : null);
    if (label) bucket.usernames.add(label);
    if (e.occurredAt > bucket.lastAttempt) bucket.lastAttempt = e.occurredAt;
    byIpFailed.set(ip, bucket);
  }
  const bruteForceIps = [...byIpFailed.entries()]
    .filter(([, v]) => v.count >= BRUTE_FORCE_THRESHOLD)
    .map(([ip, v]) => ({ ipAddress: ip, failedAttempts: v.count, targetedAccounts: [...v.usernames], lastAttemptAt: v.lastAttempt }))
    .sort((a, b) => b.failedAttempts - a.failedAttempts);

  const byIpAccounts = new Map<string, Set<string>>();
  for (const e of successEvents) {
    const ip = e.ipAddress!;
    const set = byIpAccounts.get(ip) ?? new Set<string>();
    // Prefixed so a user id and a contractor id can never collide into the same key.
    if (e.userId) set.add(`user:${e.userId}`);
    if (e.contractorId) set.add(`contractor:${e.contractorId}`);
    byIpAccounts.set(ip, set);
  }
  const multiAccountIps = [...byIpAccounts.entries()]
    .filter(([, accounts]) => accounts.size >= 2)
    .map(([ip, accounts]) => ({ ipAddress: ip, distinctAccounts: accounts.size }))
    .sort((a, b) => b.distinctAccounts - a.distinctAccounts);

  const recentBlockedAttempts = blockedEvents
    .map((e) => ({
      ipAddress: e.ipAddress,
      userName: e.user?.name ?? (e.contractor ? `${e.contractor.companyName} (contractor)` : null),
      occurredAt: e.occurredAt,
    }))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  res.json({ bruteForceIps, multiAccountIps, recentBlockedAttempts });
});

const blockedIpSelect = {
  id: true,
  ipOrCidr: true,
  reason: true,
  blockedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/blocklist", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const entries = await prisma.cyberBlockedIp.findMany({ where: { mineId }, select: blockedIpSelect, orderBy: { createdAt: "desc" } });
  res.json(entries);
});

// Loose on purpose: strict IPv4/CIDR gets full range-matching support in isIpBlocked;
// anything else (IPv6, typos) is still accepted and stored, but only ever matches by
// exact string equality — better to let the IT Manager block it and see it listed than
// to reject a value they clearly intend as an address.
const blockedIpSchema = z.object({
  ipOrCidr: z.string().trim().min(3).max(64),
  reason: z.string().optional(),
});

router.post("/blocklist", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = blockedIpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.cyberBlockedIp.findFirst({ where: { mineId, ipOrCidr: parsed.data.ipOrCidr } });
  if (existing) return res.status(409).json({ error: "This IP or range is already blocked" });
  const entry = await prisma.cyberBlockedIp.create({
    data: { mineId, ipOrCidr: parsed.data.ipOrCidr, reason: parsed.data.reason || undefined, blockedById: req.auth!.userId },
    select: blockedIpSelect,
  });
  invalidateIpBlocklistCache(mineId);
  res.status(201).json(entry);
});

router.delete("/blocklist/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.cyberBlockedIp.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Blocked entry not found" });
  await prisma.cyberBlockedIp.delete({ where: { id: existing.id } });
  invalidateIpBlocklistCache(mineId);
  res.status(204).send();
});

export default router;
