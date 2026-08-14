import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { controlledDocumentFileFilter } from "../lib/uploadFilters";

const router = Router();
router.use(requireAuth);

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: controlledDocumentFileFilter,
});

const investigationSchema = z.object({
  siteId: z.string().min(1),
  securityIncidentId: z.string().optional().nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().nullable(),
  leadInvestigatorId: z.string().optional().nullable(),
});

const investigationUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().nullable(),
  leadInvestigatorId: z.string().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  outcome: z.enum(["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE", "REFERRED_EXTERNAL"]).optional().nullable(),
  findings: z.string().optional().nullable(),
});

const investigationSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  securityIncidentId: true,
  securityIncident: { select: { id: true, category: true, description: true, occurredAt: true } },
  title: true,
  summary: true,
  severity: true,
  status: true,
  outcome: true,
  findings: true,
  leadInvestigator: { select: { id: true, name: true } },
  openedAt: true,
  closedAt: true,
  createdBy: { select: { id: true, name: true } },
  _count: { select: { evidenceItems: true, statements: true } },
  createdAt: true,
} as const;

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await prisma.securityInvestigation.findMany({
    where: { site: { mineId }, siteId: siteId || undefined, status: (status as any) || undefined },
    select: investigationSelect,
    orderBy: { openedAt: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = investigationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (parsed.data.securityIncidentId) {
    const incident = await prisma.securityIncident.findFirst({
      where: { id: parsed.data.securityIncidentId, site: { mineId } },
    });
    if (!incident) return res.status(404).json({ error: "Security incident not found" });
    const already = await prisma.securityInvestigation.findUnique({ where: { securityIncidentId: incident.id } });
    if (already) return res.status(409).json({ error: "This incident already has an investigation" });
  }
  const item = await prisma.securityInvestigation.create({
    data: { ...parsed.data, createdById: req.auth!.userId },
    select: investigationSelect,
  });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = investigationUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Investigation not found" });
  const closedAt = parsed.data.status === "CLOSED" && existing.status !== "CLOSED" ? new Date() : undefined;
  const item = await prisma.securityInvestigation.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(closedAt ? { closedAt } : {}) },
    select: investigationSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Investigation not found" });
  await prisma.securityInvestigation.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const evidenceSelect = {
  id: true,
  description: true,
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  collectedAt: true,
  addedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/:id/evidence", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const investigation = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!investigation) return res.status(404).json({ error: "Investigation not found" });
  const items = await prisma.investigationEvidence.findMany({
    where: { investigationId: investigation.id },
    select: evidenceSelect,
    orderBy: { collectedAt: "desc" },
  });
  res.json(items);
});

router.post(
  "/:id/evidence",
  requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"),
  evidenceUpload.single("file"),
  async (req, res) => {
    const mineId = requireMineId(req, res);
    if (!mineId) return;
    const investigation = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
    if (!investigation) return res.status(404).json({ error: "Investigation not found" });
    const description = (req.body?.description as string) || "";
    if (!description.trim()) return res.status(400).json({ error: "Description is required" });
    const item = await prisma.investigationEvidence.create({
      data: {
        investigationId: investigation.id,
        description,
        fileName: req.file?.originalname,
        fileMimeType: req.file?.mimetype,
        fileSize: req.file?.size,
        fileData: req.file ? Uint8Array.from(req.file.buffer) : undefined,
        addedById: req.auth!.userId,
      },
      select: evidenceSelect,
    });
    res.status(201).json(item);
  }
);

router.get("/evidence/:evidenceId/file", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const item = await prisma.investigationEvidence.findFirst({
    where: { id: req.params.evidenceId, investigation: { site: { mineId } } },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!item?.fileData || !item.fileMimeType) return res.status(404).json({ error: "No file on this evidence item" });
  res.setHeader("Content-Type", item.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${item.fileName ?? "evidence"}"`);
  res.send(Buffer.from(item.fileData));
});

router.delete("/evidence/:evidenceId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.investigationEvidence.findFirst({
    where: { id: req.params.evidenceId, investigation: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Evidence item not found" });
  await prisma.investigationEvidence.delete({ where: { id: existing.id } });
  res.status(204).send();
});

const statementSchema = z.object({
  witnessName: z.string().min(1),
  role: z.string().optional().nullable(),
  statement: z.string().min(1),
  statementDate: z.coerce.date().optional(),
});

const statementSelect = {
  id: true,
  witnessName: true,
  role: true,
  statement: true,
  statementDate: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.get("/:id/statements", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const investigation = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!investigation) return res.status(404).json({ error: "Investigation not found" });
  const items = await prisma.investigationStatement.findMany({
    where: { investigationId: investigation.id },
    select: statementSelect,
    orderBy: { statementDate: "desc" },
  });
  res.json(items);
});

router.post("/:id/statements", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const investigation = await prisma.securityInvestigation.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!investigation) return res.status(404).json({ error: "Investigation not found" });
  const parsed = statementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.investigationStatement.create({
    data: { ...parsed.data, investigationId: investigation.id, recordedById: req.auth!.userId },
    select: statementSelect,
  });
  res.status(201).json(item);
});

router.delete("/statements/:statementId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.investigationStatement.findFirst({
    where: { id: req.params.statementId, investigation: { site: { mineId } } },
  });
  if (!existing) return res.status(404).json({ error: "Statement not found" });
  await prisma.investigationStatement.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
