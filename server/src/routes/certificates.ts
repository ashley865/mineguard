import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const certificateSchema = z.object({
  workerId: z.string().min(1),
  type: z.enum([
    "MINE_MANAGER",
    "MINE_OVERSEER",
    "SHIFT_SUPERVISOR",
    "BLASTING",
    "ROCK_BREAKER",
    "WINDING_ENGINE_DRIVER",
    "ELECTRICAL",
    "MECHANICAL",
    "OTHER",
  ]),
  certificateNumber: z.string().min(1),
  issuingBody: z.string().min(1),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "WITHDRAWN"]).optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const workerId = req.query.workerId as string | undefined;
  const items = await prisma.certificate.findMany({
    where: workerId ? { workerId } : undefined,
    include: { worker: { select: { id: true, name: true, employeeId: true, siteId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = certificateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.certificate.create({ data: parsed.data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = certificateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await prisma.certificate.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Certificate not found" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.certificate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Certificate not found" });
  }
});

export default router;
