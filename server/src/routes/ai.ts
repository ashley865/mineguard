import { Router } from "express";
import { z } from "zod";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { computeComplianceScore } from "../services/complianceScore";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";

const router = Router();

router.use(requireAuth, requireRole("EXECUTIVE", "ADMIN"));

interface AiModule {
  buildContext: (mineId: string) => Promise<Record<string, unknown>>;
  systemPrompt: (context: any) => string;
}

async function buildGeneralManagerContext(mineId: string) {
  const [
    mine,
    sitesByStatus,
    totalWorkers,
    onShiftWorkers,
    totalEquipment,
    operationalEquipment,
    openIncidents,
    investigatingIncidents,
    openAlertsBySeverity,
    { score: complianceScore },
    overdueLegalItems,
    openHazards,
    openAuditFindings,
    pendingExpenses,
    permitsExpiringSoon,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true, location: true } }),
    prisma.site.groupBy({ by: ["status"], _count: true, where: { mineId } }),
    prisma.worker.count({ where: { site: { mineId } } }),
    prisma.worker.count({ where: { status: "ON_SHIFT", site: { mineId } } }),
    prisma.equipment.count({ where: { site: { mineId } } }),
    prisma.equipment.count({ where: { status: "OPERATIONAL", site: { mineId } } }),
    prisma.incident.count({ where: { status: "OPEN", site: { mineId } } }),
    prisma.incident.count({ where: { status: "INVESTIGATING", site: { mineId } } }),
    prisma.alert.groupBy({ by: ["severity"], where: { status: "OPEN", site: { mineId } }, _count: true }),
    computeComplianceScore(mineId),
    prisma.legalComplianceItem.count({ where: { status: "OVERDUE", site: { mineId } } }),
    prisma.hazardReport.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.auditFinding.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, site: { mineId } } }),
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.permit.count({
      where: { status: "ACTIVE", site: { mineId }, expiryDate: { lte: new Date(Date.now() + 90 * 86400000) } },
    }),
  ]);

  const alertSeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const row of openAlertsBySeverity) alertSeverity[row.severity] = row._count;

  const siteStatus = { OPERATIONAL: 0, RESTRICTED: 0, SHUT_DOWN: 0 } as Record<string, number>;
  for (const row of sitesByStatus) siteStatus[row.status] = row._count;

  return {
    mine: { name: mine?.name ?? "the mine", location: mine?.location ?? null },
    sites: siteStatus,
    workforce: { total: totalWorkers, onShift: onShiftWorkers },
    equipment: {
      total: totalEquipment,
      operational: operationalEquipment,
      uptimePct: totalEquipment === 0 ? 100 : Math.round((operationalEquipment / totalEquipment) * 1000) / 10,
    },
    incidents: { open: openIncidents, investigating: investigatingIncidents },
    openAlertsBySeverity: alertSeverity,
    complianceScorePct: complianceScore,
    overdueLegalComplianceItems: overdueLegalItems,
    openHazardReports: openHazards,
    openAuditFindings,
    pendingExpenses: { count: pendingExpenses._count, totalAmount: pendingExpenses._sum.amount ?? 0 },
    permitsExpiringWithin90Days: permitsExpiringSoon,
  };
}

function daysFromNow(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

async function buildHrManagerContext(mineId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    mine,
    workers,
    pendingLeaveRequests,
    onLeaveToday,
    newHires,
    expiringCerts,
    expiringTraining,
    openDisciplinaryCases,
    openGrievances,
    activeCcmaCases,
    activeLearnerships,
  ] = await Promise.all([
    prisma.mine.findUnique({ where: { id: mineId }, select: { name: true } }),
    prisma.worker.findMany({ where: { site: { mineId } }, select: { category: true, status: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
    prisma.leaveRequest.count({
      where: { status: "APPROVED", worker: { site: { mineId } }, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
    }),
    prisma.worker.findMany({
      where: { site: { mineId }, createdAt: { gte: thirtyDaysAgo } },
      select: { name: true, role: true, category: true, createdAt: true, site: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.certificate.findMany({
      where: { status: "ACTIVE", expiryDate: { not: null }, worker: { site: { mineId } } },
      select: { type: true, expiryDate: true, worker: { select: { name: true } } },
    }),
    prisma.trainingRecord.findMany({
      where: { expiryDate: { not: null }, worker: { site: { mineId } } },
      select: { courseName: true, expiryDate: true, worker: { select: { name: true } } },
    }),
    prisma.disciplinaryCase.count({ where: { status: { in: ["OPEN", "SCHEDULED"] }, worker: { site: { mineId } } } }),
    prisma.grievanceCase.count({ where: { status: { in: ["OPEN", "UNDER_INVESTIGATION"] }, worker: { site: { mineId } } } }),
    prisma.ccmaCase.count({ where: { status: { in: ["REFERRED", "CONCILIATION", "ARBITRATION"] }, worker: { site: { mineId } } } }),
    prisma.learnership.count({ where: { status: { in: ["ENROLLED", "IN_PROGRESS"] }, mineId } }),
  ]);

  const byCategoryMap = new Map<string, { total: number; onShift: number }>();
  for (const w of workers) {
    const entry = byCategoryMap.get(w.category) ?? { total: 0, onShift: 0 };
    entry.total += 1;
    if (w.status === "ON_SHIFT") entry.onShift += 1;
    byCategoryMap.set(w.category, entry);
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([category, { total, onShift }]) => ({ category, total, onShift }))
    .sort((a, b) => b.total - a.total);

  const warnings = [
    ...expiringCerts
      .filter((c) => c.expiryDate && daysFromNow(c.expiryDate) <= 30)
      .map((c) => {
        const days = daysFromNow(c.expiryDate!);
        return {
          worker: c.worker.name,
          message: `${c.type.replace(/_/g, " ")} certificate ${days < 0 ? `overdue by ${Math.abs(days)}d` : `expires in ${days}d`}`,
          daysUntil: days,
        };
      }),
    ...expiringTraining
      .filter((tr) => tr.expiryDate && daysFromNow(tr.expiryDate) <= 30)
      .map((tr) => {
        const days = daysFromNow(tr.expiryDate!);
        return {
          worker: tr.worker.name,
          message: `${tr.courseName} training ${days < 0 ? `overdue by ${Math.abs(days)}d` : `due in ${days}d`}`,
          daysUntil: days,
        };
      }),
  ]
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 12);

  const totalWorkers = workers.length;
  const onShiftWorkers = workers.filter((w) => w.status === "ON_SHIFT").length;

  return {
    mine: { name: mine?.name ?? "the mine" },
    workforce: {
      total: totalWorkers,
      onShift: onShiftWorkers,
      onShiftPct: totalWorkers === 0 ? 0 : Math.round((onShiftWorkers / totalWorkers) * 1000) / 10,
      byCategory,
    },
    leave: { pendingRequests: pendingLeaveRequests, onLeaveToday },
    newHiresLast30Days: newHires.map((w) => ({
      name: w.name,
      role: w.role,
      category: w.category,
      site: w.site?.name ?? null,
      hiredDaysAgo: Math.floor((Date.now() - w.createdAt.getTime()) / 86400000),
    })),
    certificateAndTrainingWarnings: warnings,
    labourRelations: {
      openDisciplinaryCases,
      openGrievances,
      activeCcmaCases,
    },
    skillsDevelopment: { activeLearnerships },
  };
}

const BASE_SYSTEM_PROMPT = (mineName: string, roleTitle: string) =>
  `You are the Mine Guard AI Assistant, advising the ${roleTitle} of ${mineName}, a South African mining operation. ` +
  `Base every answer strictly on the JSON data snapshot provided in this conversation — never invent figures or names. ` +
  `If the data doesn't cover something asked, say so plainly. Keep answers concise and written for a busy executive: ` +
  `short paragraphs or bullet points, leading with the most urgent or actionable item.`;

const AI_MODULES: Record<string, AiModule> = {
  GENERAL_MANAGER: {
    buildContext: buildGeneralManagerContext,
    systemPrompt: (ctx) => BASE_SYSTEM_PROMPT(ctx.mine.name, "General Manager"),
  },
  HR_MANAGER: {
    buildContext: buildHrManagerContext,
    systemPrompt: (ctx) =>
      BASE_SYSTEM_PROMPT(ctx.mine.name, "HR Manager") +
      ` Focus on workforce composition, leave, new hires, certificate/training expiries, and labour relations case load ` +
      `(disciplinary cases, grievances, CCMA referrals) — this is an HR-specific assistant, not a general operations one.`,
  },
};

/** Extend this list as each executive's AI module is built out (see AI_MODULES above). */
const AI_ENABLED_TITLES = Object.keys(AI_MODULES) as ExecutiveTitle[];

async function resolveAiModule(req: any, res: any): Promise<{ title: ExecutiveTitle; module: AiModule } | null> {
  let title: ExecutiveTitle | null = null;
  if (req.auth!.role === "ADMIN") {
    title = "GENERAL_MANAGER";
  } else {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    if (me?.title && AI_ENABLED_TITLES.includes(me.title)) title = me.title;
  }
  if (!title) {
    res.status(403).json({ error: "The AI assistant isn't available for your role yet" });
    return null;
  }
  return { title, module: AI_MODULES[title] };
}

router.get("/summary", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  if (!isAiConfigured()) {
    return res.json({ configured: false, summary: null, generatedAt: null });
  }

  try {
    const context = await resolved.module.buildContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: resolved.module.systemPrompt(context) },
      { role: "system", content: `Current data snapshot (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          "Give me a concise summary of the 3-5 most important things I should know right now, " +
          "ordered by urgency. Plain text, one short bullet per line, no headings.",
      },
    ];
    const summary = await aiChatComplete(messages);
    res.json({ configured: true, summary, generatedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, summary: null, generatedAt: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

router.post("/chat", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const resolved = await resolveAiModule(req, res);
  if (!resolved) return;

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chat payload" });
  }
  if (parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user" });
  }

  if (!isAiConfigured()) {
    return res.json({ configured: false, reply: null });
  }

  try {
    const context = await resolved.module.buildContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: resolved.module.systemPrompt(context) },
      { role: "system", content: `Current data snapshot (JSON): ${JSON.stringify(context)}` },
      ...parsed.data.messages,
    ];
    const reply = await aiChatComplete(messages);
    res.json({ configured: true, reply });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, reply: null });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
