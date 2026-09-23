import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requirePlatformAdminAuth } from "../middleware/platformAdminAuth";
import { generateLicenseKey } from "../lib/licensing";

const router = Router();
router.use(requirePlatformAdminAuth);

const customerSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
});

const licenseSchema = z.object({
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
  seats: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const licenseUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]).optional(),
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).optional(),
  seats: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const licenseSelect = {
  id: true,
  key: true,
  plan: true,
  seats: true,
  status: true,
  issuedAt: true,
  activatedAt: true,
  expiresAt: true,
  revokedAt: true,
  notes: true,
  issuedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const customerSelect = {
  id: true,
  companyName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  address: true,
  notes: true,
  status: true,
  mineId: true,
  mine: { select: { id: true, name: true, location: true } },
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  licenses: { select: licenseSelect, orderBy: { issuedAt: "desc" as const } },
} as const;

/** The license a customer would actually be checked against right now — see lib/licensing.ts. */
function currentLicense<T extends { status: string; issuedAt: Date }>(licenses: T[]): T | null {
  return licenses.filter((l) => l.status !== "REVOKED").sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))[0] ?? null;
}

router.get("/customers", async (req, res) => {
  const customers = await prisma.customer.findMany({ select: customerSelect, orderBy: { createdAt: "desc" } });
  res.json(customers.map((c) => ({ ...c, currentLicense: currentLicense(c.licenses) })));
});

router.post("/customers", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const customer = await prisma.customer.create({
    data: { ...parsed.data, createdById: req.platformAdminAuth!.platformAdminId },
    select: customerSelect,
  });
  res.status(201).json({ ...customer, currentLicense: null });
});

router.get("/customers/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id }, select: customerSelect });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json({ ...customer, currentLicense: currentLicense(customer.licenses) });
});

router.put("/customers/:id", async (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  const customer = await prisma.customer.update({ where: { id: existing.id }, data: parsed.data, select: customerSelect });
  res.json({ ...customer, currentLicense: currentLicense(customer.licenses) });
});

// Deleting a customer cascades to their license history (schema.prisma), so this is only
// allowed while there's nothing real to lose: no mine linked yet and no license ever issued.
// A LEAD entered by mistake can be removed cleanly; an actual account is retired instead by
// revoking its license and setting status to INACTIVE, keeping its history intact.
router.delete("/customers/:id", async (req, res) => {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id }, include: { licenses: { select: { id: true } } } });
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  if (existing.mineId || existing.licenses.length > 0) {
    return res.status(409).json({ error: "This customer has a linked mine or license history and can't be deleted. Set status to INACTIVE instead." });
  }
  await prisma.customer.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// The mine picker for linking: every mine tenant, flagged with whichever customer (if any)
// already claims it, so a mine can't silently be attached to two customer records.
router.get("/mines", async (req, res) => {
  const mines = await prisma.mine.findMany({
    select: { id: true, name: true, location: true, createdAt: true, customer: { select: { id: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(mines);
});

router.post("/customers/:id/link-mine", async (req, res) => {
  const parsed = z.object({ mineId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const mine = await prisma.mine.findUnique({ where: { id: parsed.data.mineId }, select: { id: true, customer: { select: { id: true } } } });
  if (!mine) return res.status(404).json({ error: "Mine not found" });
  if (mine.customer && mine.customer.id !== customer.id) {
    return res.status(409).json({ error: "This mine is already linked to a different customer" });
  }
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { mineId: mine.id, status: customer.status === "LEAD" ? "ACTIVE" : customer.status },
    select: customerSelect,
  });
  res.json({ ...updated, currentLicense: currentLicense(updated.licenses) });
});

router.post("/customers/:id/unlink-mine", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const updated = await prisma.customer.update({ where: { id: customer.id }, data: { mineId: null }, select: customerSelect });
  res.json({ ...updated, currentLicense: currentLicense(updated.licenses) });
});

// Issuing a license never edits a previous one — see the LicenseKey model comment in
// schema.prisma — so a renewal or an upgrade is just a new row, and the customer's history
// of what they were licensed for and when stays intact.
router.post("/customers/:id/licenses", async (req, res) => {
  const parsed = licenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const license = await prisma.licenseKey.create({
    data: {
      ...parsed.data,
      key: generateLicenseKey(),
      customerId: customer.id,
      issuedById: req.platformAdminAuth!.platformAdminId,
    },
    select: licenseSelect,
  });
  res.status(201).json(license);
});

router.put("/licenses/:id", async (req, res) => {
  const parsed = licenseUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.licenseKey.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "License not found" });
  const revokedAt = parsed.data.status === "REVOKED" && existing.status !== "REVOKED" ? new Date() : undefined;
  const license = await prisma.licenseKey.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(revokedAt ? { revokedAt } : {}) },
    select: licenseSelect,
  });
  res.json(license);
});

router.get("/dashboard/summary", async (req, res) => {
  const [customers, mineCount, linkedMineCount] = await Promise.all([
    prisma.customer.findMany({ select: { status: true, licenses: { select: { status: true, expiresAt: true, issuedAt: true } } } }),
    prisma.mine.count(),
    prisma.customer.count({ where: { mineId: { not: null } } }),
  ]);

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  let activeLicenses = 0;
  let expiringSoon = 0;
  let expiredOrSuspended = 0;

  for (const c of customers) {
    const current = currentLicense(c.licenses);
    if (!current) continue;
    if (current.status === "SUSPENDED") {
      expiredOrSuspended++;
    } else if (current.expiresAt && current.expiresAt.getTime() < now) {
      expiredOrSuspended++;
    } else {
      activeLicenses++;
      if (current.expiresAt && current.expiresAt.getTime() - now < THIRTY_DAYS) expiringSoon++;
    }
  }

  res.json({
    totalCustomers: customers.length,
    leads: customers.filter((c) => c.status === "LEAD").length,
    activeCustomers: customers.filter((c) => c.status === "ACTIVE").length,
    inactiveCustomers: customers.filter((c) => c.status === "INACTIVE").length,
    activeLicenses,
    expiringSoon,
    expiredOrSuspended,
    unlinkedMines: mineCount - linkedMineCount,
  });
});

export default router;
