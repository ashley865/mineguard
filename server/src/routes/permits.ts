import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const permitSchema = z.object({
  permitNumber: z.string().min(1),
  type: z.enum([
    "MINING_RIGHT",
    "MINING_PERMIT",
    "PROSPECTING_RIGHT",
    "WATER_USE_LICENSE",
    "ENVIRONMENTAL_AUTHORISATION",
    "SOCIAL_LABOUR_PLAN",
    "EXPLOSIVES_LICENSE",
    "MINE_WORKS_PROGRAMME",
    "OTHER",
  ]),
  issuingAuthority: z.string().min(1),
  holderName: z.string().min(1),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "PENDING_RENEWAL", "EXPIRED", "SUSPENDED", "WITHDRAWN"]).optional(),
  conditions: z.string().optional(),
  siteId: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.permit.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = permitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const item = await prisma.permit.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = permitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.permit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Permit not found" });
  const item = await prisma.permit.update({ where: { id: existing.id }, data: parsed.data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.permit.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Permit not found" });
  await prisma.permit.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
