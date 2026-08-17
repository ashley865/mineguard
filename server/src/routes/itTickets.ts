import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const ticketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  reportedByName: z.string().optional(),
  resolutionNote: z.string().optional(),
});

const ticketSelect = {
  id: true,
  subject: true,
  description: true,
  status: true,
  priority: true,
  reportedByName: true,
  resolutionNote: true,
  resolvedAt: true,
  createdBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const tickets = await prisma.iTTicket.findMany({
    where: { mineId },
    select: ticketSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ticket = await prisma.iTTicket.create({
    data: { ...parsed.data, mineId, createdById: req.auth!.userId },
    select: ticketSelect,
  });
  res.status(201).json(ticket);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = ticketSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.iTTicket.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Ticket not found" });
  const data = { ...parsed.data, resolvedAt: parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED" ? new Date() : undefined };
  const ticket = await prisma.iTTicket.update({ where: { id: existing.id }, data, select: ticketSelect });
  res.json(ticket);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.iTTicket.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Ticket not found" });
  await prisma.iTTicket.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
