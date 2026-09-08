import { Router, Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { SensorAgent } from "@prisma/client";
import { prisma } from "../prisma";
import { verifySensorApiKey } from "../lib/sensorApiKeys";
import { recordSensorReading } from "../lib/sensorReadings";
import { DEFAULT_POLL_INTERVAL_SECONDS } from "../lib/sensorPolling";

const router = Router();

// Keyed per agent rather than per IP for the same reason the device ingest route is:
// everything from one mine arrives from one gateway address. Generous, because one agent
// legitimately speaks for every sensor assigned to it.
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.header("X-Agent-Api-Key")?.slice(0, 32) || req.ip || "anonymous",
  message: { error: "Agent request rate exceeded." },
});

router.use(agentLimiter);

/**
 * Resolves the calling agent from its key. Agent ids aren't in the URL — the key alone
 * identifies the caller — so a leaked key can't be pointed at a different agent's sensors,
 * and there's no id to enumerate.
 */
async function authenticateAgent(req: Request): Promise<SensorAgent | null> {
  const presented = req.header("X-Agent-Api-Key");
  if (!presented) return null;
  // The hash comparison has to happen per candidate: bcrypt hashes aren't derivable from
  // the plaintext, so there's nothing to look the agent up by. Agents are few (one or a
  // handful per mine), so scanning them is cheap and bounded.
  const agents = await prisma.sensorAgent.findMany();
  for (const agent of agents) {
    if (await verifySensorApiKey(presented, agent.apiKeyHash)) return agent;
  }
  return null;
}

async function touchAgent(agent: SensorAgent, req: Request, version?: string) {
  await prisma.sensorAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: new Date(), lastSeenIp: req.ip ?? null, agentVersion: version ?? agent.agentVersion },
  });
}

/**
 * The agent's work list: every sensor assigned to it that's due for collection, with the
 * protocol details it needs to do the read. Deliberately returns no secrets — the agent
 * pushes results back with its own key, so it never needs per-sensor device keys.
 */
router.get("/targets", async (req, res) => {
  const agent = await authenticateAgent(req);
  if (!agent) return res.status(401).json({ error: "Invalid agent credentials" });

  const sensors = await prisma.sensor.findMany({
    where: { pollAgentId: agent.id, pollEnabled: true, status: { not: "INACTIVE" } },
    select: {
      id: true,
      name: true,
      unit: true,
      pollProtocol: true,
      pollTarget: true,
      pollConfig: true,
      pollIntervalSeconds: true,
    },
  });

  await touchAgent(agent, req, req.header("X-Agent-Version") ?? undefined);

  res.json({
    agent: { id: agent.id, name: agent.name },
    targets: sensors.map((s) => ({
      sensorId: s.id,
      name: s.name,
      unit: s.unit,
      protocol: s.pollProtocol,
      target: s.pollTarget,
      config: s.pollConfig ?? {},
      intervalSeconds: s.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
    })),
  });
});

const readingsSchema = z.object({
  readings: z
    .array(
      z.object({
        sensorId: z.string().min(1),
        value: z.number().finite().optional(),
        error: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(200),
});

/**
 * Results come back in a batch, and each item is either a value or the reason the agent
 * couldn't read that instrument. Reporting failures matters as much as reporting values:
 * without them a dead sensor is indistinguishable from one nobody has polled, which is
 * exactly the gap the provisioning tab's "stale" state is meant to surface.
 */
router.post("/readings", async (req, res) => {
  const agent = await authenticateAgent(req);
  if (!agent) return res.status(401).json({ error: "Invalid agent credentials" });

  const parsed = readingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sensors = await prisma.sensor.findMany({
    where: { id: { in: parsed.data.readings.map((r) => r.sensorId) }, pollAgentId: agent.id },
    include: { zone: { select: { site: { select: { mineId: true } } } } },
  });
  const byId = new Map(sensors.map((s) => [s.id, s]));

  const io = req.app.get("io");
  let accepted = 0;
  const rejected: string[] = [];

  for (const item of parsed.data.readings) {
    const sensor = byId.get(item.sensorId);
    // Silently ignoring a sensor the agent doesn't own would leave a misconfigured agent
    // looking healthy while its readings vanish, so unknown ids are named in the response.
    if (!sensor) {
      rejected.push(item.sensorId);
      continue;
    }
    const mineId = sensor.zone.site.mineId;
    if (typeof item.value === "number" && mineId) {
      await recordSensorReading(sensor, item.value, mineId, io);
      await prisma.sensor.update({
        where: { id: sensor.id },
        data: { lastPollAt: new Date(), lastPollOk: true, lastPollError: null, apiKeyLastUsedAt: new Date() },
      });
      accepted += 1;
    } else {
      await prisma.sensor.update({
        where: { id: sensor.id },
        data: { lastPollAt: new Date(), lastPollOk: false, lastPollError: item.error ?? "Agent reported no value" },
      });
    }
  }

  await touchAgent(agent, req, req.header("X-Agent-Version") ?? undefined);
  res.status(201).json({ accepted, rejected });
});

export default router;
