import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

const payslipMetaSchema = z.object({
  workerId: z.string().min(1),
  payPeriodStart: z.coerce.date(),
  payPeriodEnd: z.coerce.date(),
  grossPay: z.coerce.number(),
  deductions: z.coerce.number(),
  netPay: z.coerce.number(),
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
  const workerId = req.query.workerId as string | undefined;
  const status = req.query.status as string | undefined;
  const requests = await prisma.leaveRequest.findMany({
    where: { workerId: workerId || undefined, status: (status as any) || undefined },
    select: leaveSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

router.post("/leave", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const request = await prisma.leaveRequest.create({ data: parsed.data, select: leaveSelect });
  res.status(201).json(request);
});

router.post("/leave/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = leaveReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const request = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: parsed.data.decision, approvedById: req.auth!.userId, approvedAt: new Date() },
      select: leaveSelect,
    });
    res.json(request);
  } catch {
    res.status(404).json({ error: "Leave request not found" });
  }
});

router.delete("/leave/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.leaveRequest.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Leave request not found" });
  }
});

router.get("/payslips", async (req, res) => {
  const workerId = req.query.workerId as string | undefined;
  const payslips = await prisma.payslip.findMany({
    where: { workerId: workerId || undefined },
    select: payslipSelect,
    orderBy: { issuedAt: "desc" },
  });
  res.json(payslips);
});

router.post("/payslips", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("file"), async (req, res) => {
  const parsed = payslipMetaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const payslip = await prisma.payslip.create({
    data: {
      ...parsed.data,
      fileName: req.file?.originalname,
      fileMimeType: req.file?.mimetype,
      fileSize: req.file?.size,
      fileData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
      uploadedById: req.auth!.userId,
    },
    select: payslipSelect,
  });
  res.status(201).json(payslip);
});

router.get("/payslips/:id/download", async (req, res) => {
  const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id } });
  if (!payslip || !payslip.fileData) return res.status(404).json({ error: "Payslip file not found" });
  res.setHeader("Content-Type", payslip.fileMimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(payslip.fileName || "payslip")}"`);
  res.send(Buffer.from(payslip.fileData));
});

router.delete("/payslips/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.payslip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Payslip not found" });
  }
});

export default router;
