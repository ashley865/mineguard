import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { controlledDocumentFileFilter } from "../lib/uploadFilters";

const router = Router();

router.use(requireAuth);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: controlledDocumentFileFilter,
});

// Bringing a candidate onto the books as a real Worker is an HR function, same reasoning
// as requireWorkerCreateAccess in workers.ts — everyone who can manage the pipeline can
// move a candidate through stages, but only HR (or Admin/Supervisor) can finalise a hire.
async function requireHireAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN" || req.auth!.role === "SUPERVISOR") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "HR_MANAGER") {
    res.status(403).json({ error: "Only HR can convert a candidate to a worker" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Job requisitions
// ---------------------------------------------------------------------------

const requisitionSchema = z.object({
  siteId: z.string().min(1),
  positionTitle: z.string().min(1),
  category: z
    .enum([
      "MINING_OPERATIONS",
      "ENGINEERING_TECHNICAL",
      "DRIVER",
      "CLEANER",
      "SECURITY",
      "ADMINISTRATION",
      "EXECUTIVE",
      "MEDICAL",
      "SAFETY_HEALTH",
      "MAINTENANCE",
      "CATERING",
      "OTHER",
    ])
    .optional(),
  numberOfPositions: z.number().int().min(1).optional(),
  justification: z.string().optional(),
  status: z.enum(["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CANCELLED"]).optional(),
  targetFillDate: z.string().optional().nullable(),
});

const requisitionSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  positionTitle: true,
  category: true,
  numberOfPositions: true,
  justification: true,
  status: true,
  targetFillDate: true,
  requestedById: true,
  requestedBy: { select: { id: true, name: true } },
  approvedById: true,
  approvedBy: { select: { id: true, name: true } },
  approvedAt: true,
  createdAt: true,
  _count: { select: { candidates: true } },
} as const;

router.get("/requisitions", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const requisitions = await prisma.jobRequisition.findMany({
    where: { site: { mineId } },
    select: requisitionSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(requisitions);
});

router.post("/requisitions", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = requisitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid requisition data" });

  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const requisition = await prisma.jobRequisition.create({
    data: {
      siteId: parsed.data.siteId,
      positionTitle: parsed.data.positionTitle,
      category: parsed.data.category,
      numberOfPositions: parsed.data.numberOfPositions ?? 1,
      justification: parsed.data.justification || undefined,
      status: parsed.data.status ?? "DRAFT",
      targetFillDate: parsed.data.targetFillDate || undefined,
      requestedById: req.auth!.userId,
    },
    select: requisitionSelect,
  });
  res.status(201).json(requisition);
});

router.put("/requisitions/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.jobRequisition.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Requisition not found" });

  const parsed = requisitionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid requisition data" });

  const becomingOpen = parsed.data.status === "OPEN" && existing.status !== "OPEN";

  const requisition = await prisma.jobRequisition.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      targetFillDate: parsed.data.targetFillDate === undefined ? undefined : parsed.data.targetFillDate || null,
      approvedById: becomingOpen ? req.auth!.userId : undefined,
      approvedAt: becomingOpen ? new Date() : undefined,
    },
    select: requisitionSelect,
  });
  res.json(requisition);
});

router.delete("/requisitions/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.jobRequisition.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Requisition not found" });
  await prisma.jobRequisition.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

const candidateSchema = z.object({
  requisitionId: z.string().min(1),
  fullName: z.string().min(1),
  idNumber: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.enum(["REFERRAL", "AGENCY", "WALK_IN", "ONLINE_APPLICATION", "INTERNAL", "OTHER"]).optional(),
  stage: z.enum(["APPLIED", "SHORTLISTED", "INTERVIEWED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"]).optional(),
  appliedDate: z.string().optional(),
  interviewDate: z.string().optional().nullable(),
  interviewNotes: z.string().optional(),
  offerAmount: z.number().optional().nullable(),
  rejectionReason: z.string().optional(),
});

const candidateSelect = {
  id: true,
  requisitionId: true,
  requisition: { select: { id: true, positionTitle: true } },
  fullName: true,
  idNumber: true,
  email: true,
  phone: true,
  source: true,
  stage: true,
  appliedDate: true,
  interviewDate: true,
  interviewNotes: true,
  offerAmount: true,
  rejectionReason: true,
  resumeFileName: true,
  hiredWorkerId: true,
  createdAt: true,
} as const;

router.get("/candidates", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const requisitionId = req.query.requisitionId as string | undefined;
  const candidates = await prisma.candidate.findMany({
    where: { requisition: { site: { mineId } }, requisitionId: requisitionId || undefined },
    select: candidateSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(candidates);
});

router.post("/candidates", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = candidateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid candidate data" });

  const requisition = await prisma.jobRequisition.findFirst({ where: { id: parsed.data.requisitionId, site: { mineId } } });
  if (!requisition) return res.status(404).json({ error: "Requisition not found" });

  const candidate = await prisma.candidate.create({
    data: {
      requisitionId: parsed.data.requisitionId,
      fullName: parsed.data.fullName,
      idNumber: parsed.data.idNumber || undefined,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      source: parsed.data.source,
      stage: parsed.data.stage ?? "APPLIED",
      appliedDate: parsed.data.appliedDate || undefined,
      createdById: req.auth!.userId,
    },
    select: candidateSelect,
  });
  res.status(201).json(candidate);
});

router.put("/candidates/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.candidate.findFirst({ where: { id: req.params.id, requisition: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Candidate not found" });
  if (existing.hiredWorkerId) {
    return res.status(400).json({ error: "This candidate has already been hired and can no longer be edited" });
  }

  const parsed = candidateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid candidate data" });
  if (parsed.data.stage === "HIRED") {
    return res.status(400).json({ error: "Use the hire action to convert a candidate to a worker" });
  }

  const candidate = await prisma.candidate.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      interviewDate: parsed.data.interviewDate === undefined ? undefined : parsed.data.interviewDate || null,
      offerAmount: parsed.data.offerAmount === undefined ? undefined : parsed.data.offerAmount,
    },
    select: candidateSelect,
  });
  res.json(candidate);
});

router.delete("/candidates/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.candidate.findFirst({ where: { id: req.params.id, requisition: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Candidate not found" });
  await prisma.candidate.delete({ where: { id: existing.id } });
  res.status(204).end();
});

router.post("/candidates/:id/resume", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), resumeUpload.single("file"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.candidate.findFirst({ where: { id: req.params.id, requisition: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Candidate not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  await prisma.candidate.update({
    where: { id: existing.id },
    data: {
      resumeFileName: req.file.originalname,
      resumeMimeType: req.file.mimetype,
      resumeFileSize: req.file.size,
      resumeFileData: Uint8Array.from(req.file.buffer),
    },
  });
  res.status(204).end();
});

router.get("/candidates/:id/resume", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const candidate = await prisma.candidate.findFirst({
    where: { id: req.params.id, requisition: { site: { mineId } } },
    select: { resumeFileName: true, resumeMimeType: true, resumeFileData: true },
  });
  if (!candidate?.resumeFileData || !candidate.resumeMimeType) {
    return res.status(404).json({ error: "No resume uploaded" });
  }
  res.setHeader("Content-Type", candidate.resumeMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(candidate.resumeFileName ?? "resume")}"`);
  res.send(Buffer.from(candidate.resumeFileData));
});

const hireSchema = z.object({
  employeeId: z.string().min(1),
  role: z.string().min(1),
});

// The single point where a candidate becomes a real Worker record — creates the Worker,
// links the candidate to it, marks the candidate HIRED, and opens an OnboardingChecklist
// in one transaction so the new hire never exists without one.
router.post("/candidates/:id/hire", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireHireAccess(req, res))) return;

  const candidate = await prisma.candidate.findFirst({
    where: { id: req.params.id, requisition: { site: { mineId } } },
    include: { requisition: true },
  });
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  if (candidate.hiredWorkerId) return res.status(400).json({ error: "This candidate has already been hired" });

  const parsed = hireSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "employeeId and role are required" });

  const existingEmployeeId = await prisma.worker.findUnique({ where: { employeeId: parsed.data.employeeId } });
  if (existingEmployeeId) return res.status(400).json({ error: "That employee ID is already in use" });

  const [worker] = await prisma.$transaction([
    prisma.worker.create({
      data: {
        name: candidate.fullName,
        employeeId: parsed.data.employeeId,
        role: parsed.data.role,
        category: candidate.requisition.category,
        phone: candidate.phone || undefined,
        siteId: candidate.requisition.siteId,
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.candidate.update({ where: { id: candidate.id }, data: { stage: "HIRED", hiredWorkerId: worker.id } }),
    prisma.onboardingChecklist.create({ data: { workerId: worker.id, createdById: req.auth!.userId } }),
  ]);

  res.status(201).json({ workerId: worker.id });
});

// ---------------------------------------------------------------------------
// Onboarding checklists
// ---------------------------------------------------------------------------

const onboardingSchema = z.object({
  inductionCompleted: z.boolean().optional(),
  inductionDate: z.string().optional().nullable(),
  medicalCompleted: z.boolean().optional(),
  medicalDate: z.string().optional().nullable(),
  ppeIssued: z.boolean().optional(),
  ppeIssuedDate: z.string().optional().nullable(),
  contractSigned: z.boolean().optional(),
  contractSignedDate: z.string().optional().nullable(),
  bankDetailsCollected: z.boolean().optional(),
  statutoryFormsCompleted: z.boolean().optional(),
  systemAccessGranted: z.boolean().optional(),
  notes: z.string().optional(),
});

const onboardingSelect = {
  id: true,
  workerId: true,
  worker: { select: { id: true, name: true, employeeId: true, site: { select: { id: true, name: true } } } },
  inductionCompleted: true,
  inductionDate: true,
  medicalCompleted: true,
  medicalDate: true,
  ppeIssued: true,
  ppeIssuedDate: true,
  contractSigned: true,
  contractSignedDate: true,
  bankDetailsCollected: true,
  statutoryFormsCompleted: true,
  systemAccessGranted: true,
  notes: true,
  completedAt: true,
  createdAt: true,
} as const;

router.get("/onboarding", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const onlyIncomplete = req.query.incomplete === "true";
  const checklists = await prisma.onboardingChecklist.findMany({
    where: { worker: { site: { mineId } }, completedAt: onlyIncomplete ? null : undefined },
    select: onboardingSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(checklists);
});

router.put("/onboarding/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.onboardingChecklist.findFirst({ where: { id: req.params.id, worker: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Onboarding checklist not found" });

  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid onboarding data" });

  const merged = { ...existing, ...parsed.data };
  const allDone =
    merged.inductionCompleted &&
    merged.medicalCompleted &&
    merged.ppeIssued &&
    merged.contractSigned &&
    merged.bankDetailsCollected &&
    merged.statutoryFormsCompleted &&
    merged.systemAccessGranted;

  const checklist = await prisma.onboardingChecklist.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      inductionDate: parsed.data.inductionDate === undefined ? undefined : parsed.data.inductionDate || null,
      medicalDate: parsed.data.medicalDate === undefined ? undefined : parsed.data.medicalDate || null,
      ppeIssuedDate: parsed.data.ppeIssuedDate === undefined ? undefined : parsed.data.ppeIssuedDate || null,
      contractSignedDate: parsed.data.contractSignedDate === undefined ? undefined : parsed.data.contractSignedDate || null,
      completedAt: allDone ? existing.completedAt ?? new Date() : null,
    },
    select: onboardingSelect,
  });
  res.json(checklist);
});

export default router;
