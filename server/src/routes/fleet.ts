import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

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

// Latest known position per truck, for an at-a-glance fleet overview.
router.get("/latest", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const trucks = await prisma.truck.findMany({
    where: siteId ? { fleetPositions: { some: { siteId } } } : undefined,
    select: {
      id: true,
      registrationNumber: true,
      driverName: true,
      vehicleType: true,
      fleetPositions: {
        where: siteId ? { siteId } : undefined,
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
  const truckId = req.query.truckId as string | undefined;
  const positions = await prisma.fleetPosition.findMany({
    where: { truckId: truckId || undefined },
    select: positionSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(positions);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = positionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const position = await prisma.fleetPosition.create({
    data: { ...parsed.data, recordedById: req.auth!.userId },
    select: positionSelect,
  });
  res.status(201).json(position);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.fleetPosition.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Position record not found" });
  }
});

export default router;
