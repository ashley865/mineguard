import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

const DISCLAIMER =
  "This is an automated pattern analysis based only on maintenance and downtime records already in MineGuard. " +
  "It does not replace a qualified technician's inspection or manufacturer guidance.";

interface EquipmentAnalysisResult {
  patterns: { pattern: string; detail: string }[];
  whatToMonitor: string[];
}

function parseResult(raw: string): EquipmentAnalysisResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  const patterns = Array.isArray(parsed.patterns)
    ? parsed.patterns
        .filter((p: any) => p && typeof p.pattern === "string" && typeof p.detail === "string")
        .slice(0, 6)
        .map((p: any) => ({ pattern: String(p.pattern).slice(0, 150), detail: String(p.detail).slice(0, 500) }))
    : [];
  const whatToMonitor = Array.isArray(parsed.whatToMonitor)
    ? parsed.whatToMonitor.filter((m: unknown) => typeof m === "string").slice(0, 6).map((m: string) => m.slice(0, 300))
    : [];
  return { patterns, whatToMonitor };
}

router.post("/:equipmentId", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const equipment = await prisma.equipment.findFirst({
    where: { id: req.params.equipmentId, site: { mineId } },
    include: { site: { select: { name: true } }, zone: { select: { name: true } } },
  });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });

  if (!isAiConfigured()) {
    return res.json({ configured: false, result: null, disclaimer: DISCLAIMER });
  }

  try {
    const maintenanceHistory = await prisma.maintenanceSchedule.findMany({
      where: { equipmentId: equipment.id },
      select: {
        maintenanceType: true,
        scheduledDate: true,
        completedDate: true,
        status: true,
        downtimeMinutes: true,
        downtimeReason: true,
        findings: true,
      },
      orderBy: { scheduledDate: "desc" },
      take: 25,
    });

    if (maintenanceHistory.length === 0) {
      return res.json({
        configured: true,
        result: { patterns: [], whatToMonitor: [] },
        disclaimer: DISCLAIMER,
        noHistory: true,
      });
    }

    const context = {
      equipment: { name: equipment.name, type: equipment.type, status: equipment.status, site: equipment.site.name, zone: equipment.zone?.name ?? null },
      maintenanceHistory,
    };

    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, analysing one piece of mining equipment's maintenance and downtime ` +
          `history at a South African mine, for whoever manages equipment/maintenance.` +
          GUARDRAIL +
          ` You must NEVER diagnose a specific fault or tell the user to take a specific repair action — you only ` +
          `surface recurring patterns grounded strictly in the data (e.g. a downtime reason or maintenance type that ` +
          `keeps recurring, a shortening interval between repairs) and suggest what to keep monitoring.`,
      },
      { role: "system", content: `Equipment maintenance data (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"patterns": [{"pattern": "short label", "detail": "1-2 sentences grounded in the data, hedged language only"}], ` +
          `"whatToMonitor": ["short, specific things to keep an eye on going forward"]}. ` +
          `Include at most 6 patterns and 6 monitoring items. If the history is too short or inconsistent to find a ` +
          `real pattern, say so in a single "patterns" entry rather than inventing one.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const result = parseResult(raw);
    res.json({ configured: true, result, disclaimer: DISCLAIMER, noHistory: false });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, result: null, disclaimer: DISCLAIMER });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
