import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

const positionSchema = z.object({
  truckId: z.string().min(1),
  siteId: z.string().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  speedKmh: z.coerce.number().optional().nullable(),
  heading: z.coerce.number().optional().nullable(),
});

const positionSelect = {
  id: true,
  truckId: true,
  truck: { select: { id: true, registrationNumber: true, driverName: true, vehicleType: true } },
  siteId: true,
  site: { select: { id: true, name: true } },
  latitude: true,
  longitude: true,
  speedKmh: true,
  heading: true,
  recordedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

// Latest known position per truck, for an at-a-glance fleet overview. Trucks are a shared
// registry across mines (a haulier's fleet can serve more than one site), so scoping happens
// on the position records — which site they were tracked at — not the truck itself.
router.get("/latest", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const siteId = req.query.siteId as string | undefined;
  const trucks = await prisma.truck.findMany({
    where: { fleetPositions: { some: { site: { mineId }, siteId: siteId || undefined } } },
    select: {
      id: true,
      registrationNumber: true,
      driverName: true,
      vehicleType: true,
      fleetPositions: {
        where: { site: { mineId }, siteId: siteId || undefined },
        select: positionSelect,
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const latest = trucks
    .filter((t) => t.fleetPositions.length > 0)
    .map((t) => t.fleetPositions[0]);
  res.json(latest);
});

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const truckId = req.query.truckId as string | undefined;
  const positions = await prisma.fleetPosition.findMany({
    where: { site: { mineId }, truckId: truckId || undefined },
    select: positionSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(positions);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = positionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const position = await prisma.fleetPosition.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: positionSelect,
  });
  res.status(201).json(position);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.fleetPosition.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Position record not found" });
  await prisma.fleetPosition.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
