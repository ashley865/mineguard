import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { requireCyberAccess } from "../lib/cyberAccess";
import { aiChatComplete, AiMessage, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

const SYSTEM_PROMPT =
  `You are the Mine Guard AI Security Analyst, advising the IT Manager of a South African mining operation. ` +
  `Base every answer strictly on the JSON data provided — never invent CVEs, hostnames, IP addresses, or figures ` +
  `not present in it. ` +
  GUARDRAIL;

const correlateSchema = z.object({ alertIds: z.array(z.string().min(1)).min(1).max(25) });

router.post("/correlate", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  if (!isAiConfigured()) return res.status(503).json({ error: "AI is not configured for this deployment" });
  const parsed = correlateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const alerts = await prisma.cyberAlert.findMany({
    where: { id: { in: parsed.data.alertIds }, mineId },
    select: { id: true, title: true, description: true, domain: true, severity: true, status: true, affectedAssetName: true, source: true, detectedAt: true },
  });
  if (alerts.length === 0) return res.status(404).json({ error: "No matching alerts found" });

  const messages: AiMessage[] = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT +
        ` You are correlating a set of related security alerts into a single incident case. Reply with ONLY a JSON ` +
        `object with keys: title (short, specific), description (2-4 sentences explaining how these alerts relate ` +
        `and what's likely happening), severity (one of CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL — the highest ` +
        `justified by the evidence), riskScore (integer 0-100), affectedAssets (comma-separated list drawn only from ` +
        `the alerts' affectedAssetName values), recommendedActions (array of 3-5 short, concrete next steps for the ` +
        `IT team), summary (one sentence, plain language, suitable for a non-technical executive). No markdown, no ` +
        `text outside the JSON object.`,
    },
    { role: "user", content: `Alerts to correlate (JSON): ${JSON.stringify(alerts)}` },
  ];

  try {
    const raw = await aiChatComplete(messages);
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsedResponse = JSON.parse(cleaned);
    res.json({
      title: String(parsedResponse.title ?? "").slice(0, 200),
      description: String(parsedResponse.description ?? "").slice(0, 2000),
      severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].includes(parsedResponse.severity) ? parsedResponse.severity : "MEDIUM",
      riskScore: Number.isFinite(Number(parsedResponse.riskScore)) ? Math.max(0, Math.min(100, Math.round(Number(parsedResponse.riskScore)))) : null,
      affectedAssets: String(parsedResponse.affectedAssets ?? "").slice(0, 500),
      recommendedActions: Array.isArray(parsedResponse.recommendedActions) ? parsedResponse.recommendedActions.map((a: unknown) => String(a).slice(0, 300)).slice(0, 5) : [],
      summary: String(parsedResponse.summary ?? "").slice(0, 500),
      alertIds: alerts.map((a) => a.id),
    });
  } catch {
    res.status(502).json({ error: "AI correlation failed — try again shortly" });
  }
});

const explainSchema = z.object({ type: z.enum(["alert", "incident", "vulnerability"]), id: z.string().min(1) });

router.post("/explain", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  if (!(await requireCyberAccess(req, res))) return;
  if (!isAiConfigured()) return res.status(503).json({ error: "AI is not configured for this deployment" });
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let record: unknown = null;
  if (parsed.data.type === "alert") {
    record = await prisma.cyberAlert.findFirst({
      where: { id: parsed.data.id, mineId },
      select: { title: true, description: true, domain: true, severity: true, status: true, source: true, affectedAssetName: true, detectedAt: true },
    });
  } else if (parsed.data.type === "incident") {
    record = await prisma.cyberIncident.findFirst({
      where: { id: parsed.data.id, mineId },
      select: {
        title: true,
        description: true,
        severity: true,
        status: true,
        affectedAssets: true,
        riskScore: true,
        alerts: { select: { title: true, domain: true, severity: true } },
      },
    });
  } else {
    record = await prisma.cyberVulnerability.findFirst({
      where: { id: parsed.data.id, mineId },
      select: { cveId: true, title: true, description: true, cvssScore: true, severity: true, status: true, affectedAssetName: true },
    });
  }
  if (!record) return res.status(404).json({ error: "Record not found" });

  const messages: AiMessage[] = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT +
        ` Explain the given security ${parsed.data.type} in plain language for a busy IT Manager: what it is, why ` +
        `it matters, which assets are affected, and what to do about it. Answer in 4-6 sentences or short bullet ` +
        `points, no markdown headers. Reply with ONLY the explanation text, nothing else.`,
    },
    { role: "user", content: `${parsed.data.type} record (JSON): ${JSON.stringify(record)}` },
  ];

  try {
    const explanation = await aiChatComplete(messages);
    res.json({ explanation: explanation.trim() });
  } catch {
    res.status(502).json({ error: "AI explanation failed — try again shortly" });
  }
});

export default router;
