import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { notifyExecutives } from "../lib/notify";

const router = Router();

const accessRequestSchema = z.object({
  subjectName: z.string().min(1),
  systemName: z.string().min(1),
  accessLevel: z.string().optional(),
  requestType: z.enum(["GRANT", "MODIFY", "REVOKE"]).optional(),
  status: z.enum(["REQUESTED", "APPROVED", "PROVISIONED", "DENIED", "REVOKED"]).optional(),
  requestedDate: z.coerce.date().optional(),
  actionedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
});

const accessRequestSelect = {
  id: true,
  subjectName: true,
  systemName: true,
  accessLevel: true,
  requestType: true,
  status: true,
  requestedDate: true,
  actionedDate: true,
  approvedBy: { select: { id: true, name: true } },
  notes: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const TERMINAL_STATUSES = ["PROVISIONED", "DENIED", "REVOKED"];

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const requests = await prisma.iTAccessRequest.findMany({
    where: { mineId },
    select: accessRequestSelect,
    orderBy: { requestedDate: "desc" },
  });
  res.json(requests);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = accessRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const request = await prisma.iTAccessRequest.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: accessRequestSelect,
  });

  if (request.status === "REQUESTED") {
    await notifyExecutives(req.app.get("io"), {
      mineId,
      titles: ["IT_MANAGER"],
      type: "IT_ACCESS_REQUEST",
      title: `IT access request — ${request.subjectName}`,
      body: `${request.requestType ?? "GRANT"} access to ${request.systemName}`,
      link: "/it-operations",
    });
  }

  res.status(201).json(request);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = accessRequestSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTAccessRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Access request not found" });
  const data = {
    ...parsed.data,
    actionedDate: parsed.data.status && TERMINAL_STATUSES.includes(parsed.data.status) && !existing.actionedDate ? new Date() : parsed.data.actionedDate,
    approvedById: parsed.data.status === "APPROVED" ? req.auth!.userId : undefined,
  };
  const request = await prisma.iTAccessRequest.update({ where: { id: existing.id }, data, select: accessRequestSelect });
  res.json(request);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTAccessRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Access request not found" });
  await prisma.iTAccessRequest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
