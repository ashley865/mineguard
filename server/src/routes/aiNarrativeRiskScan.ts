import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

async function requireScanAccess(req: any, res: any): Promise<boolean> {
  if (req.auth!.role === "ADMIN") return true;
  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
  if (me?.title === "SAFETY_MANAGER" || me?.title === "COMPLIANCE_OFFICER" || me?.title === "GENERAL_MANAGER") return true;
  res.status(403).json({ error: "Insufficient permissions" });
  return false;
}

const DISCLAIMER =
  "This is an automated reading of report narratives against the severity the reporter selected. It flags " +
  "possible mismatches for a human to review — it never changes a report's recorded severity itself.";

interface ScanItem {
  idx: number;
  id: string;
  type: "HAZARD_REPORT" | "INCIDENT";
  site: string;
  reportedSeverity: string;
  description: string;
  createdAt: Date;
}

interface FlaggedItem extends Omit<ScanItem, "idx"> {
  suggestedSeverity: string;
  reasoning: string;
}

function parseFlags(raw: string, items: ScanItem[]): FlaggedItem[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.flags)) return [];
  const byIdx = new Map(items.map((i) => [i.idx, i]));
  const validSeverities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  return parsed.flags
    .filter((f: any) => f && typeof f.idx === "number" && byIdx.has(f.idx) && typeof f.reasoning === "string")
    .slice(0, 30)
    .map((f: any) => {
      const item = byIdx.get(f.idx)!;
      const { idx, ...rest } = item;
      return {
        ...rest,
        suggestedSeverity: validSeverities.has(f.suggestedSeverity) ? f.suggestedSeverity : item.reportedSeverity,
        reasoning: String(f.reasoning).slice(0, 400),
      };
    });
}

router.get("/", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireScanAccess(req, res))) return;

  if (!isAiConfigured()) {
    return res.json({ configured: false, flagged: [], scannedCount: 0, disclaimer: DISCLAIMER });
  }

  const since = new Date(Date.now() - 30 * 86400000);
  const [hazards, incidents] = await Promise.all([
    prisma.hazardReport.findMany({
      where: { site: { mineId }, createdAt: { gte: since } },
      select: { id: true, riskLevel: true, description: true, site: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.incident.findMany({
      where: { site: { mineId }, createdAt: { gte: since } },
      select: { id: true, severity: true, description: true, site: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const items: ScanItem[] = [
    ...hazards.map((h, i) => ({
      idx: i,
      id: h.id,
      type: "HAZARD_REPORT" as const,
      site: h.site.name,
      reportedSeverity: h.riskLevel,
      description: h.description,
      createdAt: h.createdAt,
    })),
    ...incidents.map((inc, i) => ({
      idx: hazards.length + i,
      id: inc.id,
      type: "INCIDENT" as const,
      site: inc.site.name,
      reportedSeverity: inc.severity,
      description: inc.description,
      createdAt: inc.createdAt,
    })),
  ];

  if (items.length === 0) {
    return res.json({ configured: true, flagged: [], scannedCount: 0, disclaimer: DISCLAIMER });
  }

  try {
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, reading the free-text narratives of recent hazard reports and ` +
          `incidents at a South African mine to check whether the written description sounds more or less severe ` +
          `than the severity level the reporter selected.` +
          GUARDRAIL +
          ` You never change or override a recorded severity — you only flag items worth a second look, with your ` +
          `reasoning grounded strictly in the wording of the description.`,
      },
      {
        role: "system",
        content: `Items to review (JSON array, "idx" is how you must reference an item): ${JSON.stringify(
          items.map(({ idx, reportedSeverity, description, type }) => ({ idx, type, reportedSeverity, description }))
        )}`,
      },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"flags": [{"idx": <number>, "suggestedSeverity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "reasoning": "1-2 sentences, hedged language only"}]}. ` +
          `Only include an item if its description clearly reads as notably more or less severe than its reportedSeverity — do not flag borderline or reasonable calls. Return an empty "flags" array if nothing stands out.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const flagged = parseFlags(raw, items);
    res.json({ configured: true, flagged, scannedCount: items.length, disclaimer: DISCLAIMER });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, flagged: [], scannedCount: 0, disclaimer: DISCLAIMER });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
