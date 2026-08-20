import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { MineralType } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireBuyerAuth } from "../middleware/buyerAuth";
import { imageFileFilter } from "../lib/uploadFilters";
import { requireMineId } from "../lib/mineScope";
import { mineralTypeEnum } from "../lib/minerals";
import { isIpBlocked } from "../lib/ipBlocklist";

const router = Router();

// Production is recorded in tonnes (ProductionRecord has no unit field), so we can only
// automatically check a listing against real stock when it's also denominated in tonnes —
// gram/carat/ounce-denominated precious-metal listings fall outside what we can verify here.
const TONNAGE_UNIT_ALIASES = new Set(["t", "ton", "tons", "tonne", "tonnes", "mt", "metric ton", "metric tons"]);
function isTonnageUnit(unit: string): boolean {
  return TONNAGE_UNIT_ALIASES.has(unit.trim().toLowerCase());
}

// A mine can only sell what it has actually produced: available stock is cumulative tonnes
// produced at the site for that mineral, minus tonnes already committed to other listings
// that are still AVAILABLE or already SOLD (WITHDRAWN listings release their tonnage back).
async function getMineralStock(siteId: string, mineralType: MineralType, excludeListingId?: string) {
  const [records, committedAgg] = await Promise.all([
    prisma.productionRecord.findMany({
      where: { siteId, mineralType },
      select: { tonnesMined: true, tonnesProcessed: true },
    }),
    prisma.mineralListing.aggregate({
      where: {
        siteId,
        mineralType,
        status: { in: ["AVAILABLE", "SOLD"] },
        id: excludeListingId ? { not: excludeListingId } : undefined,
      },
      _sum: { quantity: true },
    }),
  ]);
  const producedTonnes = records.reduce((sum, r) => sum + (r.tonnesProcessed ?? r.tonnesMined), 0);
  const committedTonnes = committedAgg._sum.quantity ?? 0;
  return { producedTonnes, committedTonnes, availableTonnes: producedTonnes - committedTonnes };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const listingSchema = z.object({
  siteId: z.string().min(1),
  mineralType: mineralTypeEnum,
  grade: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  pricePerUnit: z.coerce.number().positive().optional().nullable(),
  currency: z.string().optional(),
  description: z.string().optional(),
  packaging: z.string().optional(),
  certifications: z.string().optional(),
  status: z.enum(["AVAILABLE", "SOLD", "WITHDRAWN"]).optional(),
});

const bidSchema = z.object({
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
  packaging: true,
  certifications: true,
  status: true,
  listedBy: { select: { id: true, name: true } },
  images: { select: { id: true, fileName: true, fileMimeType: true, fileSize: true, isPrimary: true } },
  _count: { select: { bids: true } },
  createdAt: true,
} as const;

// _count is a Prisma query-shape detail, not something the client should have to know
// about — flatten it to a plain bidCount alongside every listing response instead.
function withBidCount<T extends { _count: { bids: number } }>(listing: T) {
  const { _count, ...rest } = listing;
  return { ...rest, bidCount: _count.bids };
}

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

const SORT_OPTIONS = {
  newest: { createdAt: "desc" as const },
  price_asc: { pricePerUnit: "asc" as const },
  price_desc: { pricePerUnit: "desc" as const },
  quantity_desc: { quantity: "desc" as const },
};

// Public: anyone can browse listings (this is a marketplace storefront) — intentionally
// not mine-scoped, unlike every authenticated management route below it.
router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const mineralType = req.query.mineralType as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const sortBy = (req.query.sortBy as string | undefined) ?? "newest";
  const orderBy = SORT_OPTIONS[sortBy as keyof typeof SORT_OPTIONS] ?? SORT_OPTIONS.newest;

  const listings = await prisma.mineralListing.findMany({
    where: {
      siteId: siteId || undefined,
      status: (status as any) || undefined,
      mineralType: (mineralType as any) || undefined,
      pricePerUnit: minPrice !== undefined || maxPrice !== undefined ? { gte: minPrice, lte: maxPrice } : undefined,
      OR: search
        ? [
            { description: { contains: search, mode: "insensitive" } },
            { grade: { contains: search, mode: "insensitive" } },
            { certifications: { contains: search, mode: "insensitive" } },
            { site: { name: { contains: search, mode: "insensitive" } } },
          ]
        : undefined,
    },
    select: listingSelect,
    orderBy,
  });
  res.json(listings.map(withBidCount));
});

// Public, free, no API key — same source and caching convention as liveData.ts's
// fetchUsdToZarRate, generalized to a small fixed currency set so a buyer can view any
// listing's price converted into the currency they think in, regardless of what currency
// the mine listed it in.
const FX_CURRENCIES = ["USD", "ZAR", "EUR", "GBP"];
const FX_TTL_MS = 60 * 60 * 1000;
let fxRatesCache: { data: Record<string, number>; expiresAt: number } | null = null;

router.get("/fx-rates", async (_req, res) => {
  if (fxRatesCache && fxRatesCache.expiresAt > Date.now()) {
    return res.json({ base: "USD", rates: fxRatesCache.data });
  }
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) return res.json({ base: "USD", rates: fxRatesCache?.data ?? null });
    const data: any = await response.json();
    const rates: Record<string, number> = {};
    for (const currency of FX_CURRENCIES) {
      const rate = data?.rates?.[currency];
      if (typeof rate === "number") rates[currency] = rate;
    }
    fxRatesCache = { data: rates, expiresAt: Date.now() + FX_TTL_MS };
    res.json({ base: "USD", rates });
  } catch {
    res.json({ base: "USD", rates: fxRatesCache?.data ?? null });
  }
});

// Public: listing photos are shown in the storefront, so serving them needs no auth.
router.get("/:id/images/:imageId", async (req, res) => {
  const image = await prisma.mineralListingImage.findUnique({ where: { id: req.params.imageId } });
  if (!image || image.listingId !== req.params.id) return res.status(404).json({ error: "Image not found" });
  res.setHeader("Content-Type", image.fileMimeType);
  res.send(Buffer.from(image.fileData));
});

// Requires a logged-in, APPROVED buyer — the buyer's identity comes from their auth
// token (requireBuyerAuth), never from a client-supplied email, so one buyer can no
// longer submit a bid "as" another registered buyer just by typing their address.
router.post("/:id/bids", requireBuyerAuth, async (req, res) => {
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const listing = await prisma.mineralListing.findUnique({
    where: { id: req.params.id },
    include: { site: { select: { mineId: true } } },
  });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.status !== "AVAILABLE") return res.status(409).json({ error: "This listing is no longer available" });

  // Buyers aren't staff and never hit requireAuth, so this is the one place a mine's own
  // IP blocklist (Cyber Command Center > Identity & Access) can actually apply to them —
  // enforced against the listing's own mine, since a buyer isn't tied to any single mine.
  if (await isIpBlocked(listing.site.mineId, req.ip)) {
    return res.status(403).json({ error: "Access blocked from this network" });
  }

  if (req.buyerAuth!.status !== "APPROVED") {
    return res.status(403).json({ error: "Your buyer registration must be approved before you can bid" });
  }

  const bid = await prisma.mineralBid.create({
    data: {
      listingId: listing.id,
      buyerId: req.buyerAuth!.buyerId,
      quantity: parsed.data.quantity,
      offerPrice: parsed.data.offerPrice,
      notes: parsed.data.notes,
    },
    select: bidSelect,
  });
  res.status(201).json(bid);
});

// A buyer's watchlist — plain listing-id membership, resolved client-side against the
// already-fetched public listings rather than the server re-embedding favorite state into
// every anonymous GET / response (which has no buyer identity to check against anyway).
router.get("/favorites", requireBuyerAuth, async (req, res) => {
  const favorites = await prisma.buyerFavorite.findMany({
    where: { buyerId: req.buyerAuth!.buyerId },
    select: { listingId: true },
  });
  res.json(favorites.map((f) => f.listingId));
});

router.post("/:id/favorite", requireBuyerAuth, async (req, res) => {
  const listing = await prisma.mineralListing.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  await prisma.buyerFavorite.upsert({
    where: { buyerId_listingId: { buyerId: req.buyerAuth!.buyerId, listingId: listing.id } },
    create: { buyerId: req.buyerAuth!.buyerId, listingId: listing.id },
    update: {},
  });
  res.status(204).send();
});

router.delete("/:id/favorite", requireBuyerAuth, async (req, res) => {
  await prisma.buyerFavorite.deleteMany({ where: { buyerId: req.buyerAuth!.buyerId, listingId: req.params.id } });
  res.status(204).send();
});

router.use(requireAuth);

// Lets the listing form show real-time available stock for a site + mineral before submitting.
router.get("/stock/:siteId/:mineralType", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const site = await prisma.site.findFirst({ where: { id: req.params.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const mineralType = mineralTypeEnum.safeParse(req.params.mineralType);
  if (!mineralType.success) return res.status(400).json({ error: "Invalid mineral type" });
  const stock = await getMineralStock(req.params.siteId, mineralType.data);
  res.json(stock);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  if (isTonnageUnit(parsed.data.unit)) {
    const stock = await getMineralStock(parsed.data.siteId, parsed.data.mineralType);
    if (parsed.data.quantity > stock.availableTonnes) {
      return res.status(409).json({
        error: `Only ${stock.availableTonnes.toFixed(2)} t of this mineral is available to list at this site (${stock.committedTonnes.toFixed(2)} t already listed/sold out of ${stock.producedTonnes.toFixed(2)} t produced).`,
      });
    }
  }
  const listing = await prisma.mineralListing.create({
    data: { ...parsed.data, listedById: req.auth!.userId },
    select: listingSelect,
  });
  res.status(201).json(withBidCount(listing));
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = listingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.mineralListing.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Listing not found" });
  const effectiveSiteId = parsed.data.siteId ?? existing.siteId;
  const effectiveMineralType = parsed.data.mineralType ?? existing.mineralType;
  const effectiveQuantity = parsed.data.quantity ?? existing.quantity;
  const effectiveUnit = parsed.data.unit ?? existing.unit;
  if (isTonnageUnit(effectiveUnit)) {
    const stock = await getMineralStock(effectiveSiteId, effectiveMineralType, existing.id);
    if (effectiveQuantity > stock.availableTonnes) {
      return res.status(409).json({
        error: `Only ${stock.availableTonnes.toFixed(2)} t of this mineral is available to list at this site (${stock.committedTonnes.toFixed(2)} t already listed/sold out of ${stock.producedTonnes.toFixed(2)} t produced).`,
      });
    }
  }
  const listing = await prisma.mineralListing.update({ where: { id: existing.id }, data: parsed.data, select: listingSelect });
  res.json(withBidCount(listing));
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.mineralListing.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Listing not found" });
  await prisma.mineralListing.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.post("/:id/images", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), upload.array("images", 6), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const listing = await prisma.mineralListing.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "At least one image is required" });
  const existingImageCount = await prisma.mineralListingImage.count({ where: { listingId: listing.id } });
  await prisma.mineralListingImage.createMany({
    data: files.map((f, i) => ({
      listingId: listing.id,
      fileName: f.originalname,
      fileMimeType: f.mimetype,
      fileSize: f.size,
      fileData: Uint8Array.from(f.buffer),
      // The very first image ever uploaded for a listing becomes its cover photo
      // automatically, so a listing is never left without one just because staff didn't
      // think to click "set as primary" on a single-photo listing.
      isPrimary: existingImageCount === 0 && i === 0,
    })),
  });
  const updated = await prisma.mineralListing.findUnique({ where: { id: listing.id }, select: listingSelect });
  res.status(201).json(updated ? withBidCount(updated) : updated);
});

router.delete("/:id/images/:imageId", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const image = await prisma.mineralListingImage.findFirst({
    where: { id: req.params.imageId, listingId: req.params.id, listing: { site: { mineId } } },
  });
  if (!image) return res.status(404).json({ error: "Image not found" });
  await prisma.mineralListingImage.delete({ where: { id: image.id } });
  // If the cover photo was just deleted, promote whichever image is left (if any) so the
  // listing doesn't silently end up with zero primary images.
  if (image.isPrimary) {
    const next = await prisma.mineralListingImage.findFirst({ where: { listingId: req.params.id }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.mineralListingImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  res.status(204).send();
});

router.post("/:id/images/:imageId/primary", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const image = await prisma.mineralListingImage.findFirst({
    where: { id: req.params.imageId, listingId: req.params.id, listing: { site: { mineId } } },
  });
  if (!image) return res.status(404).json({ error: "Image not found" });
  await prisma.$transaction([
    prisma.mineralListingImage.updateMany({ where: { listingId: req.params.id }, data: { isPrimary: false } }),
    prisma.mineralListingImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
  ]);
  res.status(204).send();
});

router.get("/bids/list", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const listingId = req.query.listingId as string | undefined;
  const bids = await prisma.mineralBid.findMany({
    where: { listing: { site: { mineId } }, listingId: listingId || undefined },
    select: bidSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(bids);
});

router.post("/bids/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = bidReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.mineralBid.findFirst({ where: { id: req.params.id, listing: { site: { mineId } } } });
  if (!existing) return res.status(404).json({ error: "Bid not found" });
  const bid = await prisma.mineralBid.update({ where: { id: existing.id }, data: { status: parsed.data.decision }, select: bidSelect });
  if (parsed.data.decision === "ACCEPTED") {
    await prisma.mineralListing.update({ where: { id: bid.listingId }, data: { status: "SOLD" } });
  }
  res.json(bid);
});

export default router;
