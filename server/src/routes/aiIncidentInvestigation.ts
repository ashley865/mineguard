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
  "This is an automated pattern analysis based only on data already in MineGuard. It does not determine fault, " +
  "cause, or liability. A qualified investigator must confirm any finding before it is acted on.";

interface InvestigationResult {
  likelyCauses: { cause: string; detail: string }[];
  followUpQuestions: string[];
  similarPastIncidents: string;
}

function parseResult(raw: string): InvestigationResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);
  const likelyCauses = Array.isArray(parsed.likelyCauses)
    ? parsed.likelyCauses
        .filter((c: any) => c && typeof c.cause === "string" && typeof c.detail === "string")
        .slice(0, 6)
        .map((c: any) => ({ cause: String(c.cause).slice(0, 150), detail: String(c.detail).slice(0, 500) }))
    : [];
  const followUpQuestions = Array.isArray(parsed.followUpQuestions)
    ? parsed.followUpQuestions.filter((q: unknown) => typeof q === "string").slice(0, 6).map((q: string) => q.slice(0, 300))
    : [];
  const similarPastIncidents = typeof parsed.similarPastIncidents === "string" ? parsed.similarPastIncidents.slice(0, 500) : "";
  return { likelyCauses, followUpQuestions, similarPastIncidents };
}

router.post("/:incidentId", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const incident = await prisma.incident.findFirst({
    where: { id: req.params.incidentId, site: { mineId } },
    include: { site: { select: { name: true } }, zone: { select: { name: true } } },
  });
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  if (!isAiConfigured()) {
    return res.json({ configured: false, result: null, disclaimer: DISCLAIMER });
  }

  try {
    const [similarPast, siteHazards] = await Promise.all([
      prisma.incident.findMany({
        where: { site: { mineId }, id: { not: incident.id }, severity: incident.severity },
        select: { title: true, description: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.hazardReport.findMany({
        where: { siteId: incident.siteId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { hazardType: true, location: true, riskLevel: true },
        take: 10,
      }),
    ]);

    const context = {
      incident: {
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        site: incident.site.name,
        zone: incident.zone?.name ?? null,
        reportedAt: incident.createdAt,
      },
      similarPastIncidentsAtThisSite: similarPast.map((i) => ({
        title: i.title,
        description: i.description,
        status: i.status,
        loggedAt: i.createdAt,
      })),
      currentlyOpenHazardsAtThisSite: siteHazards,
    };

    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant, helping an investigator think through a single incident at a South ` +
          `African mine.` +
          GUARDRAIL +
          ` You must NEVER assign fault, blame, or a definitive cause — you only surface plausible contributing ` +
          `factors grounded strictly in the data provided, note whether similar incidents happened before at this ` +
          `site, and suggest follow-up questions an investigator should ask. This is explicitly not a finding of fact.`,
      },
      { role: "system", content: `Incident data (JSON): ${JSON.stringify(context)}` },
      {
        role: "user",
        content:
          `Reply with ONLY a single JSON object, no markdown, no code fences: ` +
          `{"likelyCauses": [{"cause": "short label", "detail": "1-2 sentences grounded in the data, hedged language only"}], ` +
          `"followUpQuestions": ["short items phrased as questions the investigator should ask"], ` +
          `"similarPastIncidents": "1-2 sentences on whether the site has a pattern here, or state there is no clear pattern"}. ` +
          `Include at most 6 likely causes and 6 follow-up questions.`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const result = parseResult(raw);
    res.json({ configured: true, result, disclaimer: DISCLAIMER });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.json({ configured: false, result: null, disclaimer: DISCLAIMER });
    }
    console.error(err);
    res.status(502).json({ error: "The AI provider could not be reached. Please try again shortly." });
  }
});

export default router;
