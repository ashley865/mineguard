import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { documentFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";
import { notifyExecutives } from "../lib/notify";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const leaveSchema = z.object({
  workerId: z.string().min(1),
  leaveType: z.enum(["ANNUAL", "SICK", "FAMILY_RESPONSIBILITY", "UNPAID", "STUDY", "MATERNITY_PATERNITY", "OTHER"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  daysRequested: z.coerce.number().positive(),
  reason: z.string().optional(),
});

const leaveReviewSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

const leaveBalanceSchema = z.object({
  workerId: z.string().min(1),
  leaveType: z.enum(["ANNUAL", "SICK", "FAMILY_RESPONSIBILITY", "UNPAID", "STUDY", "MATERNITY_PATERNITY", "OTHER"]),
  cycleStartDate: z.coerce.date(),
  cycleEndDate: z.coerce.date(),
  entitlementDays: z.coerce.number().min(0),
  carriedOverDays: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

const payslipMetaSchema = z
  .object({
    workerId: z.string().min(1).optional(),
    payeeId: z.string().min(1).optional(),
    payPeriodStart: z.coerce.date(),
    payPeriodEnd: z.coerce.date(),
    grossPay: z.coerce.number(),
    deductions: z.coerce.number(),
    netPay: z.coerce.number(),
  })
  .refine((d) => Boolean(d.workerId) !== Boolean(d.payeeId), {
    message: "Provide either workerId (employee) or payeeId (company), not both",
  });

const leaveSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true, site: { select: { id: true, name: true } } } },
  leaveType: true,
  startDate: true,
  endDate: true,
  daysRequested: true,
  reason: true,
  status: true,
  approvedBy: { select: { id: true, name: true } },
  approvedAt: true,
  createdAt: true,
} as const;

const payslipSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true } },
  payeeId: true,
  payee: { select: { id: true, name: true, payeeType: true } },
  payPeriodStart: true,
  payPeriodEnd: true,
  grossPay: true,
  deductions: true,
  netPay: true,
  issuedAt: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  uploadedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/leave", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const status = req.query.status as string | undefined;
  const requests = await prisma.leaveRequest.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined, status: (status as any) || undefined },
    select: leaveSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

router.post("/leave", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const request = await prisma.leaveRequest.create({ data: parsed.data, select: leaveSelect });

  await notifyExecutives(req.app.get("io"), {
    mineId,
    titles: ["HR_MANAGER"],
    type: "LEAVE_REQUEST",
    title: `Leave request — ${worker.name}`,
    body: `${request.leaveType} · ${request.daysRequested} day(s)`,
    link: "/payroll",
  });

  res.status(201).json(request);
});

router.post("/leave/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = leaveReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Leave request not found" });
  const request = await prisma.leaveRequest.update({
    where: { id: existing.id },
    data: { status: parsed.data.decision, approvedById: req.auth!.userId, approvedAt: new Date() },
    select: leaveSelect,
  });
  res.json(request);
});

router.delete("/leave/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.leaveRequest.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Leave request not found" });
  await prisma.leaveRequest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/payslips", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const payslips = await prisma.payslip.findMany({
    where: {
      OR: [{ worker: { site: { mineId } } }, { payee: { mineId } }],
      workerId: workerId || undefined,
    },
    select: payslipSelect,
    orderBy: { issuedAt: "desc" },
  });
  res.json(payslips);
});

router.post("/payslips", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = payslipMetaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let worker: { id: string; siteId: string; name: string; employeeId: string } | null = null;
  let payee: { id: string; name: string };
  let siteId: string;
  let expenseNumber: string;

  if (parsed.data.workerId) {
    worker = await prisma.worker.findFirst({
      where: { id: parsed.data.workerId, site: { mineId } },
      select: { id: true, siteId: true, name: true, employeeId: true },
    });
    if (!worker) return res.status(404).json({ error: "Worker not found" });
    siteId = worker.siteId;
    expenseNumber = `PS-${worker.employeeId}-${parsed.data.payPeriodEnd.toISOString().slice(0, 10)}`;

    // Every payslip also shows up in the expense ledger so payroll cost flows through the
    // same CFO approval pipeline as any other expense, reusing the worker's auto-synced
    // EMPLOYEE payee rather than creating a duplicate payee entry.
    let employeePayee = await prisma.payee.findFirst({ where: { workerId: worker.id, payeeType: "EMPLOYEE" } });
    if (!employeePayee) {
      employeePayee = await prisma.payee.create({ data: { mineId, payeeType: "EMPLOYEE", name: worker.name, workerId: worker.id } });
    }
    payee = employeePayee;
  } else {
    const companyPayee = await prisma.payee.findFirst({ where: { id: parsed.data.payeeId, mineId } });
    if (!companyPayee) return res.status(404).json({ error: "Payee not found" });
    // Company-level payroll payments (e.g. a labour broker) aren't tied to one worker's
    // site, so they're booked against the mine's primary site.
    const site = await prisma.site.findFirst({ where: { mineId }, orderBy: { createdAt: "asc" } });
    if (!site) return res.status(400).json({ error: "No site found for this mine" });
    siteId = site.id;
    payee = companyPayee;
    expenseNumber = `PS-CO-${companyPayee.id.slice(-6)}-${parsed.data.payPeriodEnd.toISOString().slice(0, 10)}`;
  }

  const payslip = await prisma.payslip.create({
    data: {
      workerId: worker?.id,
      payeeId: worker ? undefined : payee.id,
      payPeriodStart: parsed.data.payPeriodStart,
      payPeriodEnd: parsed.data.payPeriodEnd,
      grossPay: parsed.data.grossPay,
      deductions: parsed.data.deductions,
      netPay: parsed.data.netPay,
      fileName: req.file?.originalname,
      fileMimeType: req.file?.mimetype,
      fileSize: req.file?.size,
      fileData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
      uploadedById: req.auth!.userId,
    },
    select: payslipSelect,
  });

  await prisma.expense.create({
    data: {
      siteId,
      payeeId: payee.id,
      expenseNumber,
      category: "SALARIES_WAGES",
      description: `Payslip - ${payee.name} (${parsed.data.payPeriodStart.toISOString().slice(0, 10)} to ${parsed.data.payPeriodEnd.toISOString().slice(0, 10)})`,
      amount: parsed.data.grossPay,
      currency: "ZAR",
      expenseDate: parsed.data.payPeriodEnd,
      paymentMethod: "EFT",
      payslipId: payslip.id,
      createdById: req.auth!.userId,
    },
  });

  res.status(201).json(payslip);
});

router.get("/payslips/:id/download", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const payslip = await prisma.payslip.findFirst({
    where: { id: req.params.id, OR: [{ worker: { site: { mineId } } }, { payee: { mineId } }] },
  });
  if (!payslip || !payslip.fileData) return res.status(404).json({ error: "Payslip file not found" });
  res.setHeader("Content-Type", payslip.fileMimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(payslip.fileName || "payslip")}"`);
  res.send(Buffer.from(payslip.fileData));
});

router.delete("/payslips/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.payslip.findFirst({
    where: { id: req.params.id, OR: [{ worker: { site: { mineId } } }, { payee: { mineId } }] },
  });
  if (!existing) return res.status(404).json({ error: "Payslip not found" });
  await prisma.payslip.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// LeaveRequest is a request/approve workflow with no accrual — LeaveBalance is the ledger
// HR sets an entitlement + carry-over on, with "taken" computed live from approved requests
// that fall inside the cycle window (rather than kept as a second, driftable field).
router.get("/leave-balances", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const workerId = req.query.workerId as string | undefined;
  const balances = await prisma.leaveBalance.findMany({
    where: { worker: { site: { mineId } }, workerId: workerId || undefined },
    include: { worker: { select: { id: true, name: true, employeeId: true } } },
    orderBy: { cycleStartDate: "desc" },
  });
  const enriched = await Promise.all(
    balances.map(async (b) => {
      const taken = await prisma.leaveRequest.aggregate({
        where: {
          workerId: b.workerId,
          leaveType: b.leaveType,
          status: "APPROVED",
          startDate: { gte: b.cycleStartDate },
          endDate: { lte: b.cycleEndDate },
        },
        _sum: { daysRequested: true },
      });
      const takenDays = taken._sum.daysRequested ?? 0;
      return { ...b, takenDays, remainingDays: b.entitlementDays + b.carriedOverDays - takenDays };
    })
  );
  res.json(enriched);
});

router.post("/leave-balances", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = leaveBalanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const balance = await prisma.leaveBalance.create({ data: parsed.data });
  res.status(201).json(balance);
});

router.put("/leave-balances/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = leaveBalanceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.leaveBalance.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Leave balance not found" });
  const balance = await prisma.leaveBalance.update({ where: { id: existing.id }, data: parsed.data });
  res.json(balance);
});

router.delete("/leave-balances/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.leaveBalance.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Leave balance not found" });
  await prisma.leaveBalance.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// BCEA working-time compliance, computed live from WorkerAttendance clock records: ordinary
// hours may not exceed 45/week (s9), a daily rest period of 12 consecutive hours is required
// between shifts (s14). Attendance is already this app's system of record for hours actually
// worked, so this reads it directly rather than keeping a parallel breach-tracking table.
router.get("/bcea-compliance", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const days = Math.min(Number(req.query.days) || 7, 31);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await prisma.workerAttendance.findMany({
    where: { worker: { site: { mineId } }, checkInAt: { gte: since }, checkOutAt: { not: null } },
    select: { workerId: true, worker: { select: { name: true } }, checkInAt: true, checkOutAt: true },
    orderBy: { checkInAt: "asc" },
  });

  const byWorker = new Map<string, typeof records>();
  for (const r of records) {
    if (!byWorker.has(r.workerId)) byWorker.set(r.workerId, []);
    byWorker.get(r.workerId)!.push(r);
  }

  const breaches: { workerId: string; workerName: string; type: string; detail: string }[] = [];
  for (const [workerId, shifts] of byWorker) {
    const totalHours = shifts.reduce((sum, s) => sum + (s.checkOutAt!.getTime() - s.checkInAt.getTime()) / 3_600_000, 0);
    const weeklyEquivalent = totalHours / (days / 7);
    const workerName = shifts[0].worker.name;
    if (weeklyEquivalent > 45) {
      breaches.push({
        workerId,
        workerName,
        type: "ORDINARY_HOURS_EXCEEDED",
        detail: `Averaging ${weeklyEquivalent.toFixed(1)} hours/week over the last ${days} days (BCEA s9 limit: 45)`,
      });
    }
    for (let i = 1; i < shifts.length; i++) {
      const restHours = (shifts[i].checkInAt.getTime() - shifts[i - 1].checkOutAt!.getTime()) / 3_600_000;
      if (restHours < 12) {
        breaches.push({
          workerId,
          workerName,
          type: "DAILY_REST_SHORT",
          detail: `Only ${restHours.toFixed(1)} hours' rest before the shift starting ${shifts[i].checkInAt.toISOString()} (BCEA s14 minimum: 12)`,
        });
      }
    }
  }

  res.json({ periodDays: days, workersChecked: byWorker.size, breaches });
});

export default router;
