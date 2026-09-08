import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { generateSensorApiKey } from "../lib/sensorApiKeys";

const router = Router();

// Same reasoning as issuing a sensor device key: an agent key speaks for every sensor
// assigned to that agent, so minting one is an IT function rather than general sensor
// administration.
async function requireItAccess(req: Request, res: Response): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  if (req.auth!.role !== "EXECUTIVE") {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "IT_MANAGER") {
    res.status(403).json({ error: "Only IT can manage sensor agents" });
    return false;
  }
  return true;
}

const agentSchema = z.object({ name: z.string().trim().min(1).max(120) });

const agentSelect = {
  id: true,
  name: true,
  agentVersion: true,
  lastSeenAt: true,
  lastSeenIp: true,
  createdAt: true,
  _count: { select: { sensors: true } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const agents = await prisma.sensorAgent.findMany({ where: { mineId }, select: agentSelect, orderBy: { createdAt: "desc" } });
  res.json(agents.map((a) => ({ ...a, sensorCount: a._count.sensors, _count: undefined })));
});

// Creating an agent and issuing its first key are one step — an agent without a key can't
// do anything, so there's no useful state in between.
router.post("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { key, hash } = await generateSensorApiKey("mga_");
  const agent = await prisma.sensorAgent.create({
    data: { mineId, name: parsed.data.name, apiKeyHash: hash },
    select: agentSelect,
  });
  res.status(201).json({ agent: { ...agent, sensorCount: agent._count.sensors, _count: undefined }, key });
});

router.post("/:id/api-key", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const existing = await prisma.sensorAgent.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agent not found" });

  const { key, hash } = await generateSensorApiKey("mga_");
  await prisma.sensorAgent.update({ where: { id: existing.id }, data: { apiKeyHash: hash } });
  res.status(201).json({ key });
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireItAccess(req, res))) return;
  const existing = await prisma.sensorAgent.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Agent not found" });
  // Sensors assigned to it fall back to null (server-collected) rather than being deleted
  // — see onDelete: SetNull on Sensor.pollAgentId.
  await prisma.sensorAgent.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
