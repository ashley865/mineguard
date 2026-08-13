import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { computeComplianceScore } from "../services/complianceScore";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";

const router = Router();

router.use(requireAuth, requireRole("EXECUTIVE", "ADMIN"));

// Titles are re-checked per module as each executive's AI assistant is built out —
// the General Manager is the first (broadest cross-module visibility).
async function requireGeneralManager(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title !== "GENERAL_MANAGER") {
    res.status(403).json({ error: "The AI assistant is currently only available to the General Manager" });
    return false;
  }
  return true;
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

const SYSTEM_PROMPT = (mineName: string) =>
  `You are the Mine Guard AI Assistant, advising the General Manager of ${mineName}, a South African mining operation. ` +
  `Base every answer strictly on the JSON data snapshot provided in this conversation — never invent figures. ` +
  `If the data doesn't cover something asked, say so plainly. Keep answers concise and written for a busy executive: ` +
  `short paragraphs or bullet points, leading with the most urgent or actionable item.`;

router.get("/summary", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireGeneralManager(req, res))) return;

  if (!isAiConfigured()) {
    return res.json({ configured: false, summary: null, generatedAt: null });
  }

  try {
    const context = await buildGeneralManagerContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: SYSTEM_PROMPT(context.mine.name) },
      { role: "system", content: `Current data snapshot (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          "Give me a concise executive summary of the 3-5 most important things I should know right now, " +
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
  if (!(await requireGeneralManager(req, res))) return;

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
    const context = await buildGeneralManagerContext(mineId);
    const messages: AiMessage[] = [
      { role: "system", content: SYSTEM_PROMPT(context.mine.name) },
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
