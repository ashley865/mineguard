import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const copSchema = z.object({
  title: z.string().min(1),
  category: z.enum([
    "ROCK_ENGINEERING",
    "VENTILATION",
    "EXPLOSIVES",
    "FALL_OF_GROUND",
    "TRACKLESS_MOBILE_MACHINERY",
    "WINDING_PLANT",
    "ELECTRICAL",
    "OCCUPATIONAL_HEALTH",
    "EMERGENCY_PREPAREDNESS",
    "OTHER",
  ]),
  version: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "UNDER_REVIEW", "EXPIRED", "WITHDRAWN"]).optional(),
  effectiveDate: z.coerce.date(),
  reviewDate: z.coerce.date(),
  approvedBy: z.string().optional(),
  description: z.string().optional(),
  siteId: z.string().min(1),
  zoneId: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.codeOfPractice.findMany({
    where: siteId ? { siteId } : undefined,
    include: {
      site: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
    },
    orderBy: { reviewDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = copSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.codeOfPractice.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = copSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.codeOfPractice.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Code of Practice not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.codeOfPractice.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Code of Practice not found" });
  }
});

export default router;
