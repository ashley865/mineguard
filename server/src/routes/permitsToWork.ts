import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAssignedSiteIds } from "../services/executiveSites";

const router = Router();

const ptwSchema = z.object({
  contractorId: z.string().min(1),
  siteId: z.string().min(1),
  workDescription: z.string().min(1),
  workArea: z.string().min(1),
  hazardsIdentified: z.string().min(1),
  controlMeasures: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  requestedByName: z.string().min(1),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

const ptwSelect = {
  id: true,
  contractorId: true,
  siteId: true,
  workDescription: true,
  workArea: true,
  hazardsIdentified: true,
  controlMeasures: true,
  startDate: true,
  endDate: true,
  requestedByName: true,
  status: true,
  supervisorNote: true,
  supervisorDecidedAt: true,
  executiveNote: true,
  executiveDecidedAt: true,
  createdAt: true,
  contractor: { select: { id: true, companyName: true } },
  site: { select: { id: true, name: true } },
  supervisorDecidedBy: { select: { id: true, name: true } },
  executiveDecidedBy: { select: { id: true, name: true } },
} as const;

async function assertSiteAccess(req: any, res: any, siteId: string): Promise<boolean> {
  if (req.auth!.role === "EXECUTIVE") {
    const allowed = await getAssignedSiteIds(req.auth!.userId);
    if (!allowed.includes(siteId)) {
      res.status(403).json({ error: "You are not assigned to this site" });
      return false;
    }
  }
  return true;
}

router.use(requireAuth);
router.use(requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  let allowedSiteIds: string[] | null = null;
  if (req.auth!.role === "EXECUTIVE") {
    allowedSiteIds = await getAssignedSiteIds(req.auth!.userId);
    if (siteId && !allowedSiteIds.includes(siteId)) {
      return res.status(403).json({ error: "You are not assigned to this site" });
    }
  }
  const items = await prisma.permitToWork.findMany({
    where: { siteId: siteId ?? (allowedSiteIds ? { in: allowedSiteIds } : undefined) },
    select: ptwSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.post("/", async (req, res) => {
  const parsed = ptwSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!(await assertSiteAccess(req, res, parsed.data.siteId))) return;

  const item = await prisma.permitToWork.create({ data: parsed.data, select: ptwSelect });
  res.status(201).json(item);
});

router.post("/:id/supervisor-decision", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ptw = await prisma.permitToWork.findUnique({ where: { id: req.params.id } });
  if (!ptw) return res.status(404).json({ error: "Permit to work not found" });
  if (ptw.status !== "PENDING_SUPERVISOR") {
    return res.status(409).json({ error: "This permit is not awaiting a supervisor decision" });
  }
  if (!(await assertSiteAccess(req, res, ptw.siteId))) return;

  const item = await prisma.permitToWork.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.decision === "APPROVED" ? "PENDING_EXECUTIVE" : "REJECTED",
      supervisorNote: parsed.data.note || undefined,
      supervisorDecidedAt: new Date(),
      supervisorDecidedById: req.auth!.userId,
    },
    select: ptwSelect,
  });
  res.json(item);
});

router.post("/:id/executive-decision", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ptw = await prisma.permitToWork.findUnique({ where: { id: req.params.id } });
  if (!ptw) return res.status(404).json({ error: "Permit to work not found" });
  if (ptw.status !== "PENDING_EXECUTIVE") {
    return res.status(409).json({ error: "This permit is not awaiting an executive decision" });
  }
  if (!(await assertSiteAccess(req, res, ptw.siteId))) return;

  const item = await prisma.permitToWork.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.decision,
      executiveNote: parsed.data.note || undefined,
      executiveDecidedAt: new Date(),
      executiveDecidedById: req.auth!.userId,
    },
    select: ptwSelect,
  });
  res.json(item);
});

router.post("/:id/close", async (req, res) => {
  const ptw = await prisma.permitToWork.findUnique({ where: { id: req.params.id } });
  if (!ptw) return res.status(404).json({ error: "Permit to work not found" });
  if (ptw.status !== "APPROVED") {
    return res.status(409).json({ error: "Only approved permits can be closed" });
  }
  if (!(await assertSiteAccess(req, res, ptw.siteId))) return;

  const item = await prisma.permitToWork.update({
    where: { id: req.params.id },
    data: { status: "CLOSED" },
    select: ptwSelect,
  });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.permitToWork.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Permit to work not found" });
  }
});

export default router;
