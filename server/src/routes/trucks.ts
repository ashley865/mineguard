import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const truckSchema = z.object({
  registrationNumber: z.string().min(1),
  vehicleType: z.string().optional(),
  driverName: z.string().min(1),
  driverLicense: z.string().optional(),
  driverPhone: z.string().optional(),
  haulierCompany: z.string().optional(),
});

const deliverySchema = z.object({
  truckId: z.string().min(1),
  siteId: z.string().min(1),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  cargoType: z.string().min(1),
  quantity: z.coerce.number().optional().nullable(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const truckSelect = {
  id: true,
  registrationNumber: true,
  vehicleType: true,
  driverName: true,
  driverLicense: true,
  driverPhone: true,
  haulierCompany: true,
  createdAt: true,
} as const;

const deliverySelect = {
  id: true,
  truckId: true,
  siteId: true,
  direction: true,
  cargoType: true,
  quantity: true,
  unit: true,
  notes: true,
  status: true,
  checkInAt: true,
  checkOutAt: true,
  createdAt: true,
  truck: { select: truckSelect },
  site: { select: { id: true, name: true } },
  loggedBy: { select: { id: true, name: true } },
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const trucks = await prisma.truck.findMany({
    where: q
      ? {
          OR: [
            { registrationNumber: { contains: q, mode: "insensitive" } },
            { driverName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: truckSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(trucks);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = truckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const truck = await prisma.truck.create({ data: parsed.data, select: truckSelect });
    res.status(201).json(truck);
  } catch {
    res.status(409).json({ error: "A truck with this registration number already exists" });
  }
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = truckSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const truck = await prisma.truck.update({ where: { id: req.params.id }, data: parsed.data, select: truckSelect });
    res.json(truck);
  } catch {
    res.status(404).json({ error: "Truck not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.truck.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Truck not found" });
  }
});

router.get("/deliveries/list", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const deliveries = await prisma.delivery.findMany({
    where: {
      siteId: siteId || undefined,
      status: status === "CHECKED_IN" || status === "CHECKED_OUT" ? status : undefined,
    },
    select: deliverySelect,
    orderBy: { checkInAt: "desc" },
  });
  res.json(deliveries);
});

router.post("/deliveries", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = deliverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const delivery = await prisma.delivery.create({
    data: { ...parsed.data, loggedById: req.auth!.userId },
    select: deliverySelect,
  });
  res.status(201).json(delivery);
});

router.post("/deliveries/:id/checkout", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });
  if (delivery.status === "CHECKED_OUT") return res.status(409).json({ error: "Already checked out" });
  const updated = await prisma.delivery.update({
    where: { id: req.params.id },
    data: { status: "CHECKED_OUT", checkOutAt: new Date() },
    select: deliverySelect,
  });
  res.json(updated);
});

router.delete("/deliveries/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.delivery.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Delivery not found" });
  }
});

export default router;
