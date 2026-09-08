import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { recordSensorReading } from "../lib/sensorReadings";
import { verifySensorApiKey } from "../lib/sensorApiKeys";

const router = Router();

// Deliberately keyed by sensor rather than by IP: a mine's sensors typically sit behind a
// single site gateway, so an IP-keyed limit would have dozens of units sharing one budget
// and the busiest sensor would starve the rest. This is also why index.ts mounts this
// router ahead of the blanket per-IP apiLimiter.
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.params.sensorId || req.ip || "anonymous",
  message: { error: "Reading rate exceeded for this sensor." },
});

const readingSchema = z.object({
  value: z.number().finite(),
});

/**
 * The endpoint a network sensor (or the gateway speaking for it) posts its own readings to:
 *
 *   POST /api/sensor-ingest/:sensorId/readings
 *   X-Sensor-Api-Key: mgs_...
 *   { "value": 1.4 }
 *
 * No user session is involved — the device key issued by IT is the whole credential. A
 * reading accepted here goes through exactly the same path as one entered in the dashboard,
 * so thresholds, alerts and the live feed behave identically regardless of origin.
 */
router.post("/:sensorId/readings", ingestLimiter, async (req, res) => {
  const presentedKey = req.header("X-Sensor-Api-Key");
  if (!presentedKey) return res.status(401).json({ error: "Missing X-Sensor-Api-Key header" });

  const parsed = readingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A numeric \"value\" is required" });

  const sensor = await prisma.sensor.findUnique({
    where: { id: req.params.sensorId },
    include: { zone: { select: { site: { select: { mineId: true } } } } },
  });

  // One undifferentiated 401 for "no such sensor", "no key issued" and "wrong key" — telling
  // an unauthenticated caller which of those it was would confirm valid sensor ids to anyone
  // probing, and the device itself has no use for the distinction.
  const unauthorized = () => res.status(401).json({ error: "Invalid sensor credentials" });
  if (!sensor?.apiKeyHash) return unauthorized();
  if (!(await verifySensorApiKey(presentedKey, sensor.apiKeyHash))) return unauthorized();

  const mineId = sensor.zone.site.mineId;
  if (!mineId) return res.status(409).json({ error: "Sensor is not attached to a mine" });

  const reading = await recordSensorReading(sensor, parsed.data.value, mineId, req.app.get("io"));

  await prisma.sensor.update({
    where: { id: sensor.id },
    data: { apiKeyLastUsedAt: new Date(), lastSeenIp: req.ip ?? null },
  });

  res.status(201).json({ id: reading.id, recordedAt: reading.recordedAt });
});

export default router;
