import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { computeComplianceScore } from "../services/complianceScore";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

// Cross-department digest, gated to the same "wants the whole picture" audience as the
// mine-wide executive report (GM/COO/Owner), not the per-title AI_MODULES map in ai.ts.
async function requireBriefingAccess(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title === "GENERAL_MANAGER" || me?.title === "COO") return true;
  res.status(403).json({ error: "Insufficient permissions" });
  return false;
}

function todayUtcMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function buildDailyBriefingContext(mineId: string) {
  const since24h = new Date(Date.now() - 24 * 3600_000);
  const [
    mine,
    productionLast24h,
    newIncidents24h,
    newHazards24h,
    newSecurityIncidents24h,
    pendingExpenses,
    pendingPurchaseOrders,
    { score: complianceScorePct },
    onShiftWorkers,
    totalWorkers,
    openAlerts,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.productionRecord.aggregate({ where: { site: { mineId }, createdAt: { gte: since24h } }, _sum: { tonnesMined: true } }),
    prisma.incident.count({ where: { site: { mineId }, createdAt: { gte: since24h } } }),
    prisma.hazardReport.count({ where: { site: { mineId }, createdAt: { gte: since24h } } }),
    prisma.securityIncident.count({ where: { site: { mineId }, createdAt: { gte: since24h } } }),
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.purchaseOrder.count({ where: { status: "SUBMITTED", site: { mineId } } }),
    computeComplianceScore(mineId),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.alert.count({ where: { status: "OPEN", site: { mineId } } }),
  ]);

  return {
    mine: { name: mine?.name ?? "the mine" },
    last24Hours: {
      tonnesMined: productionLast24h._sum.tonnesMined ?? 0,
      newIncidents: newIncidents24h,
      newHazardReports: newHazards24h,
      newSecurityIncidents: newSecurityIncidents24h,
    },
    pendingApprovals: {
      expenses: { count: pendingExpenses._count, totalAmount: pendingExpenses._sum.amount ?? 0 },
      purchaseOrders: pendingPurchaseOrders,
    },
    complianceScorePct,
    workforce: { onShift: onShiftWorkers, total: totalWorkers },
    openAlerts,
  };
}

interface BriefingSection {
  title: string;
  bullets: string[];
}
interface BriefingResult {
  headline: string;
  topPriority: string | null;
  sections: BriefingSection[];
}

function parseBriefingResult(raw: string): BriefingResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .filter((s: any) => s && typeof s.title === "string" && Array.isArray(s.bullets))
        .slice(0, 8)
        .map((s: any) => ({
          title: String(s.title).slice(0, 80),
          bullets: s.bullets.filter((b: unknown) => typeof b === "string").slice(0, 6).map((b: string) => b.slice(0, 300)),
        }))
    : [];
  return {
    headline: typeof parsed.headline === "string" ? parsed.headline.slice(0, 200) : "Daily briefing",
    topPriority: typeof parsed.topPriority === "string" ? parsed.topPriority.slice(0, 300) : null,
    sections,
  };
}

router.get("/", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireBriefingAccess(req, res))) return;

  const briefingDate = todayUtcMidnight();
  const forceRefresh = req.query.refresh === "true";

  if (!forceRefresh) {
    const existing = await prisma.aiDailyBriefing.findUnique({ where: { mineId_briefingDate: { mineId, briefingDate } } });
    if (existing) return res.json({ configured: true, cached: true, ...existing });
  }

  if (!(await isAiConfigured())) {
    return res.json({ configured: false, cached: false, headline: null, topPriority: null, sections: [] });
  }

  try {
    const context = await buildDailyBriefingContext(mineId);
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, producing a concise cross-department morning briefing for the ` +
          `General Manager / COO / Owner of ${context.mine.name}, a South African mining operation. Base every ` +
          `statement strictly on the JSON snapshot provided — never invent figures. Cover production, safety, ` +
          `security, and finance where the data supports it, and call out anything that needs attention today.` +
          GUARDRAIL,
      },
      { role: "system", content: `Last-24-hours snapshot (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"headline": "one sentence overall state of the mine today", ` +
          `"topPriority": "the single most urgent thing to look at today, or null if nothing stands out", ` +
          `"sections": [{"title": "e.g. Production / Safety / Security / Finance", "bullets": ["short bullet grounded in the data"]}]}. ` +
          `Include at most 5 sections and 4 bullets per section. Omit a section entirely if the data gives it nothing to say.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const result = parseBriefingResult(raw);

    const saved = await prisma.aiDailyBriefing.upsert({
      where: { mineId_briefingDate: { mineId, briefingDate } },
      create: { mineId, briefingDate, ...result },
      update: { ...result, generatedAt: new Date() },
    });
    res.json({ configured: true, cached: false, ...saved });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, cached: false, headline: null, topPriority: null, sections: [] });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
