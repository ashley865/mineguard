import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const titleEnum = z.enum([
  "GENERAL_MANAGER",
  "CFO",
  "COO",
  "HR_MANAGER",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
  "OTHER",
]);

const categoryEnum = z.enum([
  "PAYROLL_PAYMENT",
  "INVOICE_APPROVAL",
  "PURCHASE_APPROVAL",
  "BUDGET_APPROVAL",
  "DOCUMENT_REVIEW",
  "GENERAL",
]);

const createSchema = z.object({
  toTitle: titleEnum,
  category: categoryEnum,
  subject: z.string().min(1),
  message: z.string().min(1),
});

const respondSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
  responseNote: z.string().optional(),
});

const requestSelect = {
  id: true,
  toTitle: true,
  category: true,
  subject: true,
  message: true,
  status: true,
  responseNote: true,
  respondedAt: true,
  fromUser: { select: { id: true, name: true, title: true } },
  respondedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const role = req.auth!.role;
  const userId = req.auth!.userId;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { title: true } });

  const where =
    role === "ADMIN"
      ? { mineId }
      : { mineId, OR: [{ fromUserId: userId }, ...(me?.title ? [{ toTitle: me.title }] : [])] };

  const requests = await prisma.executiveRequest.findMany({
    where,
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(requests);
});

router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const request = await prisma.executiveRequest.create({
    data: { ...parsed.data, mineId, fromUserId: req.auth!.userId },
    select: requestSelect,
  });
  res.status(201).json(request);
});

router.put("/:id/respond", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.executiveRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (existing.status === "REJECTED" || existing.status === "COMPLETED") {
    return res.status(409).json({ error: "This request has already been closed out" });
  }

  if (req.auth!.role !== "ADMIN") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    if (me?.title !== existing.toTitle) return res.status(403).json({ error: "Insufficient permissions" });
  }

  const request = await prisma.executiveRequest.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      responseNote: parsed.data.responseNote,
      respondedById: req.auth!.userId,
      respondedAt: new Date(),
    },
    select: requestSelect,
  });
  res.json(request);
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.executiveRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (req.auth!.role !== "ADMIN" && existing.fromUserId !== req.auth!.userId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  await prisma.executiveRequest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
