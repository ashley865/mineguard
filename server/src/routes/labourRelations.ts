import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { documentFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

function fileFields(req: Request) {
  return req.file
    ? { fileName: req.file.originalname, fileMimeType: req.file.mimetype, fileSize: req.file.size, fileData: Uint8Array.from(req.file.buffer) }
    : {};
}

// Disciplinary/grievance/CCMA records are among the most sensitive HR data a mine holds —
// visible only to HR, Compliance, and the GM/COO, mirroring the POPIA-style gating already
// used for worker documents and certificates elsewhere in the app.
const IR_AUDIENCE: ExecutiveTitle[] = ["HR_MANAGER", "COMPLIANCE_OFFICER", "GENERAL_MANAGER", "COO"];

async function requireIrAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (!me?.title || !IR_AUDIENCE.includes(me.title)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

const disciplinarySchema = z.object({
  workerId: z.string().min(1),
  chargeDescription: z.string().min(1),
  hearingDate: z.coerce.date().optional().nullable(),
  chairperson: z.string().optional(),
  outcome: z.enum(["PENDING", "VERBAL_WARNING", "WRITTEN_WARNING", "FINAL_WRITTEN_WARNING", "DISMISSAL", "NOT_GUILTY", "WITHDRAWN"]).optional(),
  sanctionDetails: z.string().optional(),
  status: z.enum(["OPEN", "SCHEDULED", "CONCLUDED", "APPEALED"]).optional(),
  notes: z.string().optional(),
});

const grievanceSchema = z.object({
  workerId: z.string().min(1),
  raisedAgainst: z.string().optional(),
  description: z.string().min(1),
  dateRaised: z.coerce.date(),
  status: z.enum(["OPEN", "UNDER_INVESTIGATION", "RESOLVED", "ESCALATED", "WITHDRAWN"]).optional(),
  resolution: z.string().optional(),
});

const ccmaSchema = z.object({
  workerId: z.string().optional().nullable(),
  referralNumber: z.string().optional(),
  caseType: z.enum(["UNFAIR_DISMISSAL", "UNFAIR_LABOUR_PRACTICE", "DISCRIMINATION", "WAGE_DISPUTE", "OTHER"]),
  conciliationDate: z.coerce.date().optional().nullable(),
  arbitrationDate: z.coerce.date().optional().nullable(),
  outcome: z.string().optional(),
  status: z.enum(["REFERRED", "CONCILIATION", "ARBITRATION", "SETTLED", "AWARD_ISSUED", "WITHDRAWN"]).optional(),
  notes: z.string().optional(),
});

const unionAgreementSchema = z.object({
  unionName: z.string().min(1),
  agreementType: z.string().optional(),
  recognitionThresholdPercent: z.coerce.number().optional().nullable(),
  membershipCount: z.coerce.number().int().optional().nullable(),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "UNDER_NEGOTIATION"]).optional(),
  notes: z.string().optional(),
});

const disciplinarySelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  chargeDescription: true,
  hearingDate: true,
  chairperson: true,
  outcome: true,
  sanctionDetails: true,
  status: true,
  notes: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const grievanceSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, category: true } },
  raisedAgainst: true,
  description: true,
  dateRaised: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

const ccmaSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true } },
  referralNumber: true,
  caseType: true,
  conciliationDate: true,
  arbitrationDate: true,
  outcome: true,
  status: true,
  notes: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

const unionSelect = {
  id: true,
  unionName: true,
  agreementType: true,
  recognitionThresholdPercent: true,
  membershipCount: true,
  effectiveDate: true,
  expiryDate: true,
  status: true,
  notes: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/disciplinary", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const cases = await prisma.disciplinaryCase.findMany({
    where: { worker: { site: { mineId } } },
    select: disciplinarySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(cases);
});

router.post("/disciplinary", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = disciplinarySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const created = await prisma.disciplinaryCase.create({
    data: { ...parsed.data, ...fileFields(req), createdById: req.auth!.userId },
    select: disciplinarySelect,
  });
  res.status(201).json(created);
});

router.put("/disciplinary/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = disciplinarySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.disciplinaryCase.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Case not found" });
  const updated = await prisma.disciplinaryCase.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...fileFields(req) },
    select: disciplinarySelect,
  });
  res.json(updated);
});

router.get("/disciplinary/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.disciplinaryCase.findFirst({
    where: { id: req.params.id, worker: { site: { mineId } } },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!existing?.fileData || !existing.fileMimeType) return res.status(404).json({ error: "No attachment on this case" });
  res.setHeader("Content-Type", existing.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${existing.fileName}"`);
  res.send(Buffer.from(existing.fileData));
});

router.delete("/disciplinary/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.disciplinaryCase.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Case not found" });
  await prisma.disciplinaryCase.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/grievances", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const cases = await prisma.grievanceCase.findMany({
    where: { worker: { site: { mineId } } },
    select: grievanceSelect,
    orderBy: { dateRaised: "desc" },
  });
  res.json(cases);
});

router.post("/grievances", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = grievanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  const created = await prisma.grievanceCase.create({ data: { ...parsed.data, ...fileFields(req) }, select: grievanceSelect });
  res.status(201).json(created);
});

router.put("/grievances/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = grievanceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.grievanceCase.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Grievance not found" });
  const data = { ...parsed.data, ...fileFields(req), resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : existing.resolvedAt };
  const updated = await prisma.grievanceCase.update({ where: { id: existing.id }, data, select: grievanceSelect });
  res.json(updated);
});

router.get("/grievances/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.grievanceCase.findFirst({
    where: { id: req.params.id, worker: { site: { mineId } } },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!existing?.fileData || !existing.fileMimeType) return res.status(404).json({ error: "No attachment on this grievance" });
  res.setHeader("Content-Type", existing.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${existing.fileName}"`);
  res.send(Buffer.from(existing.fileData));
});

router.delete("/grievances/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.grievanceCase.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Grievance not found" });
  await prisma.grievanceCase.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/ccma-cases", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const cases = await prisma.ccmaCase.findMany({
    where: { OR: [{ worker: { site: { mineId } } }, { workerId: null }] },
    select: ccmaSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(cases);
});

router.post("/ccma-cases", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = ccmaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.workerId) {
    const worker = await prisma.worker.findFirst({ where: { id: parsed.data.workerId, site: { mineId } } });
    if (!worker) return res.status(404).json({ error: "Worker not found" });
  }
  const created = await prisma.ccmaCase.create({ data: { ...parsed.data, ...fileFields(req) }, select: ccmaSelect });
  res.status(201).json(created);
});

router.put("/ccma-cases/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = ccmaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.ccmaCase.findFirst({
    where: { id: req.params.id, OR: [{ worker: { site: { mineId } } }, { workerId: null }] },
  });
  if (!existing) return res.status(404).json({ error: "Case not found" });
  const updated = await prisma.ccmaCase.update({ where: { id: existing.id }, data: { ...parsed.data, ...fileFields(req) }, select: ccmaSelect });
  res.json(updated);
});

router.get("/ccma-cases/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.ccmaCase.findFirst({
    where: { id: req.params.id, OR: [{ worker: { site: { mineId } } }, { workerId: null }] },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!existing?.fileData || !existing.fileMimeType) return res.status(404).json({ error: "No attachment on this case" });
  res.setHeader("Content-Type", existing.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${existing.fileName}"`);
  res.send(Buffer.from(existing.fileData));
});

router.delete("/ccma-cases/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const existing = await prisma.ccmaCase.findFirst({
    where: { id: req.params.id, OR: [{ worker: { site: { mineId } } }, { workerId: null }] },
  });
  if (!existing) return res.status(404).json({ error: "Case not found" });
  await prisma.ccmaCase.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/union-agreements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const agreements = await prisma.unionAgreement.findMany({ where: { mineId }, select: unionSelect, orderBy: { effectiveDate: "desc" } });
  res.json(agreements);
});

router.post("/union-agreements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = unionAgreementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.unionAgreement.create({ data: { ...parsed.data, ...fileFields(req), mineId }, select: unionSelect });
  res.status(201).json(created);
});

router.put("/union-agreements/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireIrAccess(req, res))) return;
  const parsed = unionAgreementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.unionAgreement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agreement not found" });
  const updated = await prisma.unionAgreement.update({ where: { id: existing.id }, data: { ...parsed.data, ...fileFields(req) }, select: unionSelect });
  res.json(updated);
});

router.get("/union-agreements/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.unionAgreement.findFirst({
    where: { id: req.params.id, mineId },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!existing?.fileData || !existing.fileMimeType) return res.status(404).json({ error: "No attachment on this agreement" });
  res.setHeader("Content-Type", existing.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${existing.fileName}"`);
  res.send(Buffer.from(existing.fileData));
});

router.delete("/union-agreements/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.unionAgreement.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agreement not found" });
  await prisma.unionAgreement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
