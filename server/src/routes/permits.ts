import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.permit.findMany({
    where: siteId ? { siteId } : undefined,
    include: { site: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = permitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.permit.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = permitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.permit.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Permit not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.permit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Permit not found" });
  }
});

export default router;
