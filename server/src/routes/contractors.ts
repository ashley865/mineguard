import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const contractorSchema = z.object({
  companyName: z.string().min(1),
  registrationNumber: z.string().optional(),
  scopeOfWork: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contractStartDate: z.coerce.date(),
  contractEndDate: z.coerce.date(),
  goodStandingExpiry: z.coerce.date().optional().nullable(),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"]).optional(),
  siteId: z.string().min(1),
});

const publicRegisterSchema = contractorSchema.omit({ status: true, siteId: true });

// Public: lets a contractor self-register via a link or QR code shared for a specific site.
router.get("/site/:siteId/info", async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.siteId },
    select: { id: true, name: true, location: true },
  });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});

router.post("/register/:siteId", async (req, res) => {
  const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
  if (!site) return res.status(404).json({ error: "Site not found" });

  const parsed = publicRegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await prisma.contractor.create({
    data: { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined, siteId: site.id },
  });
  res.status(201).json(item);
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const items = await prisma.contractor.findMany({
    where: { site: { mineId }, siteId: siteId || undefined },
    include: { site: { select: { id: true, name: true } } },
    orderBy: { contractEndDate: "asc" },
  });
  res.json(items);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.create({ data });
  res.status(201).json(item);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = contractorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  const data = { ...parsed.data, contactEmail: parsed.data.contactEmail || undefined };
  const item = await prisma.contractor.update({ where: { id: existing.id }, data });
  res.json(item);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.contractor.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Contractor not found" });
  await prisma.contractor.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
