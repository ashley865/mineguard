import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const listingSchema = z.object({
  siteId: z.string().min(1),
  mineralType: z.string().min(1),
  grade: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  pricePerUnit: z.coerce.number().positive().optional().nullable(),
  currency: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["AVAILABLE", "SOLD", "WITHDRAWN"]).optional(),
});

const bidSchema = z.object({
  buyerEmail: z.string().email(),
  quantity: z.coerce.number().positive(),
  offerPrice: z.coerce.number().positive(),
  notes: z.string().optional(),
});

const bidReviewSchema = z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]) });

const listingSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  mineralType: true,
  grade: true,
  quantity: true,
  unit: true,
  pricePerUnit: true,
  currency: true,
  description: true,
  status: true,
  listedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const bidSelect = {
  id: true,
  listingId: true,
  listing: { select: { id: true, mineralType: true, unit: true, site: { select: { id: true, name: true } } } },
  buyerId: true,
  buyer: { select: { id: true, legalName: true, contactEmail: true, status: true } },
  quantity: true,
  offerPrice: true,
  notes: true,
  status: true,
  createdAt: true,
} as const;

// Public: anyone can browse listings (this is a marketplace storefront).
router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const listings = await prisma.mineralListing.findMany({
    where: { siteId: siteId || undefined, status: (status as any) || undefined },
    select: listingSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(listings);
});

// Public: submit a bid, but only an APPROVED registered buyer may do so.
router.post("/:id/bids", async (req, res) => {
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const listing = await prisma.mineralListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.status !== "AVAILABLE") return res.status(409).json({ error: "This listing is no longer available" });

  const buyer = await prisma.buyer.findUnique({ where: { contactEmail: parsed.data.buyerEmail } });
  if (!buyer) return res.status(404).json({ error: "No registered buyer found for this email. Please register first." });
  if (buyer.status !== "APPROVED") {
    return res.status(403).json({ error: "Your buyer registration must be approved before you can bid" });
  }

  const bid = await prisma.mineralBid.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      quantity: parsed.data.quantity,
      offerPrice: parsed.data.offerPrice,
      notes: parsed.data.notes,
    },
    select: bidSelect,
  });
  res.status(201).json(bid);
});

router.use(requireAuth);

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const listing = await prisma.mineralListing.create({
    data: { ...parsed.data, listedById: req.auth!.userId },
    select: listingSelect,
  });
  res.status(201).json(listing);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = listingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const listing = await prisma.mineralListing.update({ where: { id: req.params.id }, data: parsed.data, select: listingSelect });
    res.json(listing);
  } catch {
    res.status(404).json({ error: "Listing not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.mineralListing.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Listing not found" });
  }
});

router.get("/bids/list", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const listingId = req.query.listingId as string | undefined;
  const bids = await prisma.mineralBid.findMany({
    where: { listingId: listingId || undefined },
    select: bidSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(bids);
});

router.post("/bids/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = bidReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const bid = await prisma.mineralBid.update({ where: { id: req.params.id }, data: { status: parsed.data.decision }, select: bidSelect });
    if (parsed.data.decision === "ACCEPTED") {
      await prisma.mineralListing.update({ where: { id: bid.listingId }, data: { status: "SOLD" } });
    }
    res.json(bid);
  } catch {
    res.status(404).json({ error: "Bid not found" });
  }
});

export default router;
