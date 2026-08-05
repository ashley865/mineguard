import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

const attendanceSelect = {
  id: true,
  checkInAt: true,
  checkOutAt: true,
} as const;

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sumHours(records: { checkInAt: Date; checkOutAt: Date | null }[]): number {
  return records.reduce((sum, r) => {
    if (!r.checkOutAt) return sum;
    return sum + (r.checkOutAt.getTime() - r.checkInAt.getTime()) / (1000 * 60 * 60);
  }, 0);
}

// Self-service — every authenticated user clocks themselves in/out, not just Workers.
router.post("/toggle", async (req, res) => {
  const userId = req.auth!.userId;

  const openRecord = await prisma.userAttendance.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (openRecord) {
    const record = await prisma.userAttendance.update({
      where: { id: openRecord.id },
      data: { checkOutAt: new Date() },
      select: attendanceSelect,
    });
    return res.json({ action: "CHECKED_OUT" as const, record });
  }

  const record = await prisma.userAttendance.create({ data: { userId }, select: attendanceSelect });
  res.json({ action: "CHECKED_IN" as const, record });
});

router.get("/me", async (req, res) => {
  const userId = req.auth!.userId;

  const since30 = new Date(Date.now() - 30 * 86400000);

  const [open, recent, attendance30] = await Promise.all([
    prisma.userAttendance.findFirst({ where: { userId, checkOutAt: null }, select: attendanceSelect }),
    prisma.userAttendance.findMany({
      where: { userId },
      select: attendanceSelect,
      orderBy: { checkInAt: "desc" },
      take: 20,
    }),
    prisma.userAttendance.findMany({ where: { userId, checkInAt: { gte: since30 } }, select: attendanceSelect }),
  ]);

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const completedShifts30 = attendance30.filter((a) => a.checkOutAt);

  res.json({
    open,
    recent,
    stats: {
      hoursThisWeek: Math.round(sumHours(attendance30.filter((a) => a.checkInAt >= weekStart)) * 10) / 10,
      hoursThisMonth: Math.round(sumHours(attendance30.filter((a) => a.checkInAt >= monthStart)) * 10) / 10,
      avgHoursPerShift:
        completedShifts30.length > 0 ? Math.round((sumHours(completedShifts30) / completedShifts30.length) * 10) / 10 : null,
      shiftsLast30: attendance30.length,
    },
  });
});

// Admin-facing report of executive login/attendance times, bucketed every 3 days,
// so an admin can spot who is (and isn't) logging in regularly without digging
// through each executive's individual attendance history one at a time.
router.get("/team", requireRole("ADMIN"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const bucketSize = 3;
  const days = Math.min(Math.max(Number(req.query.days) || 9, bucketSize), 90);
  const bucketCount = Math.ceil(days / bucketSize);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (bucketCount * bucketSize - 1));

  const executives = await prisma.user.findMany({
    where: { mineId, role: "EXECUTIVE" },
    select: { id: true, name: true, title: true },
    orderBy: { name: "asc" },
  });

  const records = await prisma.userAttendance.findMany({
    where: { userId: { in: executives.map((e) => e.id) }, checkInAt: { gte: start } },
    select: { userId: true, checkInAt: true, checkOutAt: true },
    orderBy: { checkInAt: "desc" },
  });

  const bucketStarts: Date[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(start);
    bucketStart.setDate(bucketStart.getDate() + i * bucketSize);
    bucketStarts.push(bucketStart);
  }

  const executiveReports = executives.map((exec) => {
    const own = records.filter((r) => r.userId === exec.id);
    const buckets = bucketStarts.map((bucketStart) => {
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize);
      const inBucket = own.filter((r) => r.checkInAt >= bucketStart && r.checkInAt < bucketEnd);
      return {
        periodStart: bucketStart.toISOString().slice(0, 10),
        hours: Math.round(sumHours(inBucket) * 10) / 10,
        logins: inBucket.length,
      };
    });
    return {
      userId: exec.id,
      name: exec.name,
      title: exec.title,
      lastLogin: own[0]?.checkInAt ?? null,
      buckets,
    };
  });

  res.json({ bucketSize, buckets: bucketStarts.map((d) => d.toISOString().slice(0, 10)), executives: executiveReports });
});

export default router;
