import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const incidentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const incidents = await prisma.incident.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

router.post("/", async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const incident = await prisma.incident.create({
    data: { ...parsed.data, reportedById: req.auth!.userId },
  });
  res.status(201).json(incident);
});

router.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (parsed.data.status === "RESOLVED") data.resolvedAt = new Date();
  try {
    const incident = await prisma.incident.update({ where: { id: req.params.id }, data });
    res.json(incident);
  } catch {
    res.status(404).json({ error: "Incident not found" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.incident.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Incident not found" });
  }
});

router.post("/:id/review", requireRole("EXECUTIVE"), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const incident = await prisma.incident.update({
      where: { id: req.params.id },
      data: {
        reviewStatus: parsed.data.decision,
        reviewNote: parsed.data.note,
        reviewedAt: new Date(),
        reviewedById: req.auth!.userId,
      },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });
    const io = req.app.get("io");
    io?.emit("incident:updated", incident);
    res.json(incident);
  } catch {
    res.status(404).json({ error: "Incident not found" });
  }
});

export default router;
