import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const contractCategoryEnum = z.enum([
  "TRUCKING_HAULAGE",
  "GEOLOGICAL_SERVICES",
  "DRILLING_BLASTING",
  "EARTHMOVING_EXCAVATION",
  "PLANT_EQUIPMENT_MAINTENANCE",
  "ELECTRICAL_INSTRUMENTATION",
  "CIVIL_CONSTRUCTION",
  "ENVIRONMENTAL_REHABILITATION",
  "SECURITY_SERVICES",
  "CATERING_ACCOMMODATION",
  "TRANSPORT_LOGISTICS",
  "CONSULTING_PROFESSIONAL",
  "SUPPLY_EQUIPMENT_MATERIALS",
  "IT_TELECOMMUNICATIONS",
  "OTHER",
]);

const opportunitySchema = z.object({
  siteId: z.string().min(1),
  category: contractCategoryEnum.optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  scopeOfWork: z.string().min(1),
  budgetRange: z.string().optional(),
  submissionDeadline: z.coerce.date(),
  status: z.enum(["OPEN", "CLOSED", "AWARDED", "CANCELLED"]).optional(),
});

const bidSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email(),
  bidAmount: z.coerce.number().positive(),
  proposalNotes: z.string().optional(),
});

const bidReviewSchema = z.object({ decision: z.enum(["SHORTLISTED", "AWARDED", "REJECTED"]) });

const opportunitySelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  category: true,
  title: true,
  description: true,
  scopeOfWork: true,
  budgetRange: true,
  submissionDeadline: true,
  status: true,
  postedBy: { select: { id: true, name: true } },
  createdAt: true,
} as const;

const bidSelect = {
  id: true,
  opportunityId: true,
  opportunity: { select: { id: true, title: true } },
  companyName: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  bidAmount: true,
  proposalNotes: true,
  status: true,
  createdAt: true,
} as const;

// Public: anyone can browse advertised contract opportunities.
router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const category = req.query.category as string | undefined;
  const opportunities = await prisma.contractOpportunity.findMany({
    where: { siteId: siteId || undefined, status: (status as any) || undefined, category: (category as any) || undefined },
    select: opportunitySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(opportunities);
});

// Public: any contractor can submit a bid on an open opportunity, no prior registration
// required — vetting happens if/when the mine decides to award the contract.
router.post("/:id/bids", async (req, res) => {
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const opportunity = await prisma.contractOpportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
  if (opportunity.status !== "OPEN") return res.status(409).json({ error: "This opportunity is no longer open for bids" });
  if (new Date() > opportunity.submissionDeadline) {
    return res.status(409).json({ error: "The submission deadline for this opportunity has passed" });
  }

  const bid = await prisma.contractBid.create({
    data: { opportunityId: opportunity.id, ...parsed.data },
    select: bidSelect,
  });
  res.status(201).json(bid);
});

router.use(requireAuth);

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = opportunitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const opportunity = await prisma.contractOpportunity.create({
    data: { ...parsed.data, postedById: req.auth!.userId },
    select: opportunitySelect,
  });
  res.status(201).json(opportunity);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = opportunitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const opportunity = await prisma.contractOpportunity.update({ where: { id: req.params.id }, data: parsed.data, select: opportunitySelect });
    res.json(opportunity);
  } catch {
    res.status(404).json({ error: "Opportunity not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.contractOpportunity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Opportunity not found" });
  }
});

router.get("/bids/list", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const opportunityId = req.query.opportunityId as string | undefined;
  const bids = await prisma.contractBid.findMany({
    where: { opportunityId: opportunityId || undefined },
    select: bidSelect,
    orderBy: { bidAmount: "asc" },
  });
  res.json(bids);
});

router.post("/bids/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = bidReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const bid = await prisma.contractBid.update({ where: { id: req.params.id }, data: { status: parsed.data.decision }, select: bidSelect });
    if (parsed.data.decision === "AWARDED") {
      await prisma.contractOpportunity.update({ where: { id: bid.opportunityId }, data: { status: "AWARDED" } });
    }
    res.json(bid);
  } catch {
    res.status(404).json({ error: "Bid not found" });
  }
});

export default router;
