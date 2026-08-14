import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("EXECUTIVE", "ADMIN"));

async function requireHrAccess(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "HR_MANAGER") {
    res.status(403).json({ error: "This HR tool is currently only available to the HR Manager" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// HR executive report — same "generate this week/month's report" pattern as the
// General Manager's, scoped to HR-only sections.
// ---------------------------------------------------------------------------

const HR_REPORT_SECTION_KEYS = [
  "workforceOverview",
  "leaveAndAttendance",
  "certificatesAndTraining",
  "labourRelations",
  "equityAndSkillsDevelopment",
] as const;

async function buildHrReportData(mineId: string, period: "WEEK" | "MONTH") {
  const periodDays = period === "WEEK" ? 7 : 30;
  const start = new Date(Date.now() - periodDays * 86400000);
  const priorStart = new Date(Date.now() - periodDays * 2 * 86400000);
  const in30Days = new Date(Date.now() + 30 * 86400000);
  const currentYear = new Date().getFullYear();

  const [
    mine,
    workers,
    newHiresThisPeriod,
    approvedLeaveThisPeriod,
    approvedLeavePriorPeriod,
    pendingLeaveRequests,
    expiringCertsWithin30Days,
    expiringTrainingWithin30Days,
    disciplinaryCasesOpened,
    grievancesOpened,
    ccmaCasesOpened,
    disciplinaryOutcomes,
    equityTargets,
    latestSkillsPlan,
    activeLearnerships,
    aiInsights,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.worker.findMany({ where: { site: { mineId } }, select: { category: true, status: true } }),
    prisma.worker.count({ where: { site: { mineId }, createdAt: { gte: start } } }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { gte: start } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { gte: priorStart, lt: start } },
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
    prisma.certificate.count({
      where: { status: "ACTIVE", expiryDate: { not: null, lte: in30Days }, worker: { site: { mineId } } },
    }),
    prisma.trainingRecord.count({ where: { expiryDate: { not: null, lte: in30Days }, worker: { site: { mineId } } } }),
    prisma.disciplinaryCase.count({ where: { createdAt: { gte: start }, worker: { site: { mineId } } } }),
    prisma.grievanceCase.count({ where: { dateRaised: { gte: start }, worker: { site: { mineId } } } }),
    prisma.ccmaCase.count({ where: { createdAt: { gte: start }, worker: { site: { mineId } } } }),
    prisma.disciplinaryCase.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: start }, worker: { site: { mineId } } },
      _count: true,
    }),
    prisma.employmentEquityTarget.findMany({
      where: { mineId, reportingYear: currentYear },
      select: { occupationalLevel: true, designatedGroup: true, targetPercent: true, actualHeadcount: true, totalHeadcountAtLevel: true },
    }),
    prisma.workplaceSkillsPlan.findFirst({
      where: { mineId },
      orderBy: { planYear: "desc" },
      select: { planYear: true, status: true, submittedDate: true, atrSubmittedDate: true },
    }),
    prisma.learnership.count({ where: { status: { in: ["ENROLLED", "IN_PROGRESS"] }, mineId } }),
    prisma.aiRecommendation.findMany({
      where: { mineId, executiveTitle: "HR_MANAGER", status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: [{ severity: "desc" }, { generatedAt: "desc" }],
      take: 15,
      select: { id: true, executiveTitle: true, kind: true, severity: true, title: true, detail: true, topic: true, status: true, generatedAt: true },
    }),
  ]);

  const totalWorkers = workers.length;
  const onShiftWorkers = workers.filter((w) => w.status === "ON_SHIFT").length;
  const byCategoryMap = new Map<string, number>();
  for (const w of workers) byCategoryMap.set(w.category, (byCategoryMap.get(w.category) ?? 0) + 1);

  const outcomeBreakdown: Record<string, number> = {};
  for (const row of disciplinaryOutcomes) outcomeBreakdown[row.outcome] = row._count;

  const equityGaps = equityTargets.filter((t) => {
    const actualPct = t.totalHeadcountAtLevel === 0 ? 0 : (t.actualHeadcount / t.totalHeadcountAtLevel) * 100;
    return actualPct < t.targetPercent;
  }).length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    period: { type: period, start: start.toISOString(), end: new Date().toISOString() },
    workforceOverview: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      byCategory: Object.fromEntries(byCategoryMap),
      newHiresThisPeriod,
    },
    leaveAndAttendance: {
      approvedLeaveThisPeriod,
      approvedLeavePriorPeriod,
      pendingLeaveRequests,
    },
    certificatesAndTraining: {
      certificatesExpiringWithin30Days: expiringCertsWithin30Days,
      trainingExpiringWithin30Days: expiringTrainingWithin30Days,
    },
    labourRelations: {
      disciplinaryCasesOpenedThisPeriod: disciplinaryCasesOpened,
      grievancesOpenedThisPeriod: grievancesOpened,
      ccmaCasesOpenedThisPeriod: ccmaCasesOpened,
      disciplinaryOutcomesThisPeriod: outcomeBreakdown,
    },
    equityAndSkillsDevelopment: {
      employmentEquityTargetsBelowGoal: equityGaps,
      employmentEquityTargetsTracked: equityTargets.length,
      workplaceSkillsPlan: latestSkillsPlan,
      activeLearnerships,
    },
    aiInsights,
  };
}

const HR_REPORT_INSTRUCTIONS =
  `Write a formal HR report from the data snapshot below. Every statement you write MUST be directly traceable to a ` +
  `specific value in the snapshot — never state a fact, name, or figure that isn't present in it. If a section's ` +
  `data is empty or shows nothing noteworthy, say so plainly rather than inventing content.\n\n` +
  `Reply with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:\n` +
  `{"executiveSummary": "3-5 sentence overview of the period, most important developments first", ` +
  `"sections": {"workforceOverview": "2-4 sentences", "leaveAndAttendance": "2-4 sentences", ` +
  `"certificatesAndTraining": "2-4 sentences", "labourRelations": "2-4 sentences", ` +
  `"equityAndSkillsDevelopment": "2-4 sentences"}, ` +
  `"recommendedPriorities": ["short actionable priority 1", "..."]}\n` +
  `Include at most 5 recommended priorities, each traceable to a specific figure in the snapshot.`;

interface HrReportNarrative {
  executiveSummary: string;
  sections: Record<(typeof HR_REPORT_SECTION_KEYS)[number], string>;
  recommendedPriorities: string[];
}

function parseHrReportNarrative(raw: string): HrReportNarrative {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed.executiveSummary !== "string" || typeof parsed.sections !== "object" || parsed.sections === null) {
    throw new Error("AI response did not match the expected HR report schema");
  }
  const sections = {} as Record<(typeof HR_REPORT_SECTION_KEYS)[number], string>;
  for (const key of HR_REPORT_SECTION_KEYS) {
    sections[key] = typeof parsed.sections[key] === "string" ? parsed.sections[key] : "No data available for this section.";
  }
  const recommendedPriorities = Array.isArray(parsed.recommendedPriorities)
    ? parsed.recommendedPriorities.filter((p: unknown) => typeof p === "string").slice(0, 5)
    : [];
  return { executiveSummary: parsed.executiveSummary, sections, recommendedPriorities };
}

const hrReportRequestSchema = z.object({ period: z.enum(["WEEK", "MONTH"]) });

router.post("/report", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireHrAccess(req, res))) return;

  const parsed = hrReportRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid report request — period must be WEEK or MONTH" });
  }

  if (!isAiConfigured()) {
    return res.json({ configured: false, report: null });
  }

  try {
    const data = await buildHrReportData(mineId, parsed.data.period);
    const messages: AiMessage[] = [
      {
        role: "system",
        content: `You are the Mine Guard AI Assistant, compiling an HR report for ${data.mine.name}, a South African mining operation.` + GUARDRAIL,
      },
      { role: "system", content: `HR report data snapshot (JSON): ${JSON.stringify(data)}` },
      { role: "user", content: HR_REPORT_INSTRUCTIONS },
    ];
    const raw = await aiChatComplete(messages);
    const narrative = parseHrReportNarrative(raw);

    res.json({
      configured: true,
      generatedAt: new Date().toISOString(),
      period: data.period,
      mine: data.mine,
      executiveSummary: narrative.executiveSummary,
      sections: HR_REPORT_SECTION_KEYS.map((key) => ({ key, narrative: narrative.sections[key], data: (data as any)[key] })),
      recommendedPriorities: narrative.recommendedPriorities,
      aiInsights: data.aiInsights,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, report: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

// ---------------------------------------------------------------------------
// Labour relations case risk assessor — a narrower, one-off analytical tool distinct
// from the tracked-recommendation pipeline. Strictly procedural/pattern analysis, never
// an outcome recommendation: the guardrail plus an explicit "not legal advice" disclaimer
// (server-appended, not AI-generated, so it's always present) keep this squarely advisory.
// ---------------------------------------------------------------------------

const CASE_RISK_DISCLAIMER =
  "This is an automated pattern analysis based only on data already in MineGuard. It is not legal advice and does " +
  "not recommend any outcome. A qualified labour law practitioner should review the case before any disciplinary, " +
  "dismissal, or CCMA-related decision is finalised.";

const caseRiskRequestSchema = z.object({
  caseType: z.enum(["DISCIPLINARY", "GRIEVANCE", "CCMA"]),
  caseId: z.string().min(1),
});

interface CaseRiskResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskFactors: { factor: string; detail: string }[];
  proceduralConsiderations: string[];
}

function parseCaseRiskResult(raw: string): CaseRiskResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  const validLevels = new Set(["LOW", "MEDIUM", "HIGH"]);
  const riskLevel = validLevels.has(parsed.riskLevel) ? parsed.riskLevel : "MEDIUM";
  const riskFactors = Array.isArray(parsed.riskFactors)
    ? parsed.riskFactors
        .filter((f: any) => f && typeof f.factor === "string" && typeof f.detail === "string")
        .slice(0, 6)
        .map((f: any) => ({ factor: String(f.factor).slice(0, 150), detail: String(f.detail).slice(0, 500) }))
    : [];
  const proceduralConsiderations = Array.isArray(parsed.proceduralConsiderations)
    ? parsed.proceduralConsiderations.filter((p: unknown) => typeof p === "string").slice(0, 6)
    : [];
  return { riskLevel, riskFactors, proceduralConsiderations };
}

router.post("/case-risk", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireHrAccess(req, res))) return;

  const parsed = caseRiskRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request — caseType and caseId are required" });
  }
  const { caseType, caseId } = parsed.data;

  let caseRecord: any;
  let workerId: string | null | undefined;
  if (caseType === "DISCIPLINARY") {
    caseRecord = await prisma.disciplinaryCase.findFirst({
      where: { id: caseId, worker: { site: { mineId } } },
      include: { worker: { select: { id: true, name: true } } },
    });
    workerId = caseRecord?.workerId;
  } else if (caseType === "GRIEVANCE") {
    caseRecord = await prisma.grievanceCase.findFirst({
      where: { id: caseId, worker: { site: { mineId } } },
      include: { worker: { select: { id: true, name: true } } },
    });
    workerId = caseRecord?.workerId;
  } else {
    caseRecord = await prisma.ccmaCase.findFirst({
      where: { id: caseId, worker: { site: { mineId } } },
      include: { worker: { select: { id: true, name: true } } },
    });
    workerId = caseRecord?.workerId;
  }

  if (!caseRecord) {
    return res.status(404).json({ error: "Case not found" });
  }

  if (!isAiConfigured()) {
    return res.json({ configured: false, result: null, disclaimer: CASE_RISK_DISCLAIMER });
  }

  try {
    const [priorDisciplinary, priorGrievances, priorCcma, mineWideDisciplinaryOutcomes, mineWideCcmaStatus] = await Promise.all([
      workerId
        ? prisma.disciplinaryCase.findMany({
            where: { workerId, id: { not: caseType === "DISCIPLINARY" ? caseId : undefined } },
            select: { chargeDescription: true, outcome: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : [],
      workerId
        ? prisma.grievanceCase.count({ where: { workerId, id: { not: caseType === "GRIEVANCE" ? caseId : undefined } } })
        : 0,
      workerId
        ? prisma.ccmaCase.count({ where: { workerId, id: { not: caseType === "CCMA" ? caseId : undefined } } })
        : 0,
      prisma.disciplinaryCase.groupBy({ by: ["outcome"], where: { worker: { site: { mineId } } }, _count: true }),
      prisma.ccmaCase.groupBy({ by: ["status"], where: { worker: { site: { mineId } } }, _count: true }),
    ]);

    const context = {
      caseType,
      caseDetail:
        caseType === "DISCIPLINARY"
          ? { chargeDescription: caseRecord.chargeDescription, outcome: caseRecord.outcome, status: caseRecord.status, hearingDate: caseRecord.hearingDate }
          : caseType === "GRIEVANCE"
          ? { description: caseRecord.description, status: caseRecord.status, dateRaised: caseRecord.dateRaised, raisedAgainst: caseRecord.raisedAgainst }
          : { caseType: caseRecord.caseType, status: caseRecord.status, outcome: caseRecord.outcome, conciliationDate: caseRecord.conciliationDate, arbitrationDate: caseRecord.arbitrationDate },
      worker: caseRecord.worker ? { name: caseRecord.worker.name } : null,
      workerCaseHistory: {
        priorDisciplinaryCases: priorDisciplinary.map((c) => ({ chargeDescription: c.chargeDescription, outcome: c.outcome, status: c.status })),
        priorGrievancesRaisedByWorker: priorGrievances,
        priorCcmaCasesInvolvingWorker: priorCcma,
      },
      mineWideBaseRates: {
        disciplinaryOutcomes: Object.fromEntries(mineWideDisciplinaryOutcomes.map((r) => [r.outcome, r._count])),
        ccmaCaseStatuses: Object.fromEntries(mineWideCcmaStatus.map((r) => [r.status, r._count])),
      },
    };

    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, analysing procedural/consistency risk factors for a South African ` +
          `labour relations case, for the HR Manager.` +
          GUARDRAIL +
          ` You must NEVER recommend a specific outcome (e.g. dismissal, a particular sanction, or whether to settle) ` +
          `— you only flag risk factors and procedural considerations grounded strictly in the data provided (e.g. ` +
          `whether similar past cases at this mine were handled consistently, whether the worker has a pattern of ` +
          `prior cases, whether procedural steps appear complete based on what's recorded). This is explicitly not ` +
          `legal advice.`,
      },
      { role: "system", content: `Case data (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"riskLevel": "LOW" | "MEDIUM" | "HIGH", ` +
          `"riskFactors": [{"factor": "short label", "detail": "1-2 sentences grounded in the case data"}], ` +
          `"proceduralConsiderations": ["short items a human should check, phrased as questions or checks, never as instructions to act"]}. ` +
          `Include at most 6 risk factors and 6 procedural considerations.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const result = parseCaseRiskResult(raw);
    res.json({ configured: true, result, disclaimer: CASE_RISK_DISCLAIMER });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, result: null, disclaimer: CASE_RISK_DISCLAIMER });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
