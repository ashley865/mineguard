import { Router } from "express";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

// Same finance-mandate audience as budgetPlans.ts's approval routing.
const FINANCE_AUDIENCE: ExecutiveTitle[] = ["CFO", "GENERAL_MANAGER", "COO"];

async function requireBudgetInsightAccess(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title && FINANCE_AUDIENCE.includes(me.title)) return true;
  res.status(403).json({ error: "Insufficient permissions" });
  return false;
}

async function buildBudgetContext(mineId: string) {
  const plans = await prisma.budgetPlan.findMany({
    where: { mineId },
    select: { category: true, siteId: true, site: { select: { name: true } }, periodStart: true, periodEnd: true, budgetedAmount: true, status: true },
  });
  if (plans.length === 0) return { hasBudgets: false, plans: [] };

  const categories = [...new Set(plans.map((p) => p.category))];
  const minStart = new Date(Math.min(...plans.map((p) => p.periodStart.getTime())));
  const maxEnd = new Date(Math.max(...plans.map((p) => p.periodEnd.getTime())));
  const expenses = await prisma.expense.findMany({
    where: { category: { in: categories }, expenseDate: { gte: minStart, lte: maxEnd }, site: { mineId } },
    select: { category: true, amount: true, expenseDate: true, siteId: true },
  });

  const withActuals = plans.map((p) => {
    const actualAmount = expenses
      .filter((e) => e.category === p.category && e.expenseDate >= p.periodStart && e.expenseDate <= p.periodEnd && (!p.siteId || e.siteId === p.siteId))
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      category: p.category,
      site: p.site?.name ?? "Mine-wide",
      status: p.status,
      periodStart: p.periodStart.toISOString().slice(0, 10),
      periodEnd: p.periodEnd.toISOString().slice(0, 10),
      budgetedAmount: p.budgetedAmount,
      actualAmount: Math.round(actualAmount * 100) / 100,
      utilizationPct: p.budgetedAmount > 0 ? Math.round((actualAmount / p.budgetedAmount) * 1000) / 10 : 0,
    };
  });

  return { hasBudgets: true, plans: withActuals };
}

interface BudgetInsightResult {
  summary: string;
  riskFlags: { category: string; detail: string }[];
  recommendations: string[];
}

function parseInsightResult(raw: string): BudgetInsightResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  const riskFlags = Array.isArray(parsed.riskFlags)
    ? parsed.riskFlags
        .filter((r: any) => r && typeof r.category === "string" && typeof r.detail === "string")
        .slice(0, 8)
        .map((r: any) => ({ category: String(r.category).slice(0, 80), detail: String(r.detail).slice(0, 300) }))
    : [];
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.filter((r: unknown) => typeof r === "string").slice(0, 6).map((r: string) => r.slice(0, 300))
    : [];
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "No summary available.",
    riskFlags,
    recommendations,
  };
}

// Feature 3: AI-generated read of the mine's overall budget position — same
// configured/cached/refresh conventions as aiDailyBriefing.ts, cached one row per mine
// (see AiBudgetInsight in schema.prisma) rather than per day, since a budget snapshot has
// no natural daily boundary.
router.get("/", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireBudgetInsightAccess(req, res))) return;

  const forceRefresh = req.query.refresh === "true";

  if (!forceRefresh) {
    const existing = await prisma.aiBudgetInsight.findUnique({ where: { mineId } });
    if (existing) return res.json({ configured: true, cached: true, ...existing });
  }

  if (!(await isAiConfigured())) {
    return res.json({ configured: false, cached: false, summary: null, riskFlags: [], recommendations: [] });
  }

  const context = await buildBudgetContext(mineId);
  if (!context.hasBudgets) {
    return res.json({
      configured: true,
      cached: false,
      summary: "No budget plans exist yet — add one to get an AI read on spending trends and risks.",
      riskFlags: [],
      recommendations: [],
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, analyzing budget-vs-actual spending for a South African mining ` +
          `operation's finance team (CFO / GM / COO / Owner). Base every statement strictly on the JSON snapshot ` +
          `provided — never invent figures. Focus on overspend risk, categories trending badly, and concrete, ` +
          `actionable recommendations.` + GUARDRAIL,
      },
      { role: "system", content: `Budget plans with computed actuals (JSON): ${JSON.stringify(context.plans)}` },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"summary": "one or two sentence overall read of the budget position", ` +
          `"riskFlags": [{"category": "the budget category or site at risk", "detail": "short reason grounded in the data"}], ` +
          `"recommendations": ["short, concrete action"]}. ` +
          `Include at most 5 risk flags and 5 recommendations. Prioritize categories where utilizationPct is high or over 100.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const result = parseInsightResult(raw);

    const saved = await prisma.aiBudgetInsight.upsert({
      where: { mineId },
      create: { mineId, ...result },
      update: { ...result, generatedAt: new Date() },
    });
    res.json({ configured: true, cached: false, ...saved });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, cached: false, summary: null, riskFlags: [], recommendations: [] });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
