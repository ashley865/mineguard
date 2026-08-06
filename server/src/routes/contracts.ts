import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

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

// Maps the marketplace's contract categories onto the finance team's expense categories
// for the auto-generated Expense created when a bid is awarded — there's no 1:1 overlap,
// so this picks the closest fit rather than dumping everything into OTHER.
const CONTRACT_CATEGORY_TO_EXPENSE_CATEGORY: Record<string, string> = {
  TRUCKING_HAULAGE: "TRANSPORT_LOGISTICS",
  GEOLOGICAL_SERVICES: "PROFESSIONAL_SERVICES",
  DRILLING_BLASTING: "OPERATIONS",
  EARTHMOVING_EXCAVATION: "OPERATIONS",
  PLANT_EQUIPMENT_MAINTENANCE: "MAINTENANCE",
  ELECTRICAL_INSTRUMENTATION: "EQUIPMENT_SUPPLIES",
  CIVIL_CONSTRUCTION: "OPERATIONS",
  ENVIRONMENTAL_REHABILITATION: "OTHER",
  SECURITY_SERVICES: "PROFESSIONAL_SERVICES",
  CATERING_ACCOMMODATION: "OTHER",
  TRANSPORT_LOGISTICS: "TRANSPORT_LOGISTICS",
  CONSULTING_PROFESSIONAL: "PROFESSIONAL_SERVICES",
  SUPPLY_EQUIPMENT_MATERIALS: "EQUIPMENT_SUPPLIES",
  IT_TELECOMMUNICATIONS: "OTHER",
  OTHER: "OTHER",
};

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

// Public: anyone can browse advertised contract opportunities — intentionally not
// mine-scoped, unlike every authenticated management route below it.
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
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = opportunitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const site = await prisma.site.findFirst({ where: { id: parsed.data.siteId, mineId } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  const opportunity = await prisma.contractOpportunity.create({
    data: { ...parsed.data, postedById: req.auth!.userId },
    select: opportunitySelect,
  });
  res.status(201).json(opportunity);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = opportunitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.contractOpportunity.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Opportunity not found" });
  const opportunity = await prisma.contractOpportunity.update({ where: { id: existing.id }, data: parsed.data, select: opportunitySelect });
  res.json(opportunity);
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.contractOpportunity.findFirst({ where: { id: req.params.id, site: { mineId } } });
  if (!existing) return res.status(404).json({ error: "Opportunity not found" });
  await prisma.contractOpportunity.delete({ where: { id: existing.id } });
  res.status(204).send();
});

router.get("/bids/list", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const opportunityId = req.query.opportunityId as string | undefined;
  const bids = await prisma.contractBid.findMany({
    where: { opportunity: { site: { mineId } }, opportunityId: opportunityId || undefined },
    select: bidSelect,
    orderBy: { bidAmount: "asc" },
  });
  res.json(bids);
});

router.post("/bids/:id/review", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = bidReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.contractBid.findFirst({
    where: { id: req.params.id, opportunity: { site: { mineId } } },
    include: { opportunity: { select: { siteId: true, title: true, category: true } } },
  });
  if (!existing) return res.status(404).json({ error: "Bid not found" });
  const bid = await prisma.contractBid.update({ where: { id: existing.id }, data: { status: parsed.data.decision }, select: bidSelect });
  if (parsed.data.decision === "AWARDED") {
    await prisma.contractOpportunity.update({ where: { id: bid.opportunityId }, data: { status: "AWARDED" } });

    // Awarding a bid commits the mine to paying an external contractor, so — like every
    // other cost source — it's routed through the same CFO-gated expense review pipeline.
    if (existing.status !== "AWARDED") {
      const payee = await prisma.payee.create({
        data: {
          mineId,
          payeeType: "CONTRACTOR",
          name: existing.companyName,
          contactName: existing.contactName,
          contactEmail: existing.contactEmail,
          contactPhone: existing.contactPhone,
          contractBidId: existing.id,
        },
      });
      await prisma.expense.create({
        data: {
          siteId: existing.opportunity.siteId,
          payeeId: payee.id,
          expenseNumber: `CB-${existing.id.slice(-8).toUpperCase()}`,
          category: (CONTRACT_CATEGORY_TO_EXPENSE_CATEGORY[existing.opportunity.category] ?? "OTHER") as any,
          description: `Contract awarded — ${existing.opportunity.title} (${existing.companyName})`,
          amount: existing.bidAmount,
          createdById: req.auth!.userId,
          contractBidId: existing.id,
        },
      });
    }
  }
  res.json(bid);
});

export default router;
