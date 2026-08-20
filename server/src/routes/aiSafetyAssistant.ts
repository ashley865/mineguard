import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimit";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, AiNotConfiguredError, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();

// First AI surface open to Supervisors — everything else in the AI system is
// Executive/Admin-only. Scoped strictly to safety procedure / hazard-reporting help,
// never finance, security, or personnel data, since Supervisors don't get that access
// anywhere else in the app either.
router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"));

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

async function buildSafetyContext(mineId: string) {
  const [openHazardsByType, upcomingInspections, pendingPermitsToWork, activePermits] = await Promise.all([
    prisma.hazardReport.groupBy({ by: ["hazardType"], where: { site: { mineId }, status: { in: ["OPEN", "IN_PROGRESS"] } }, _count: true }),
    prisma.safetyInspection.count({ where: { site: { mineId }, status: "SCHEDULED" } }),
    prisma.permitToWork.count({ where: { site: { mineId }, status: "PENDING_SUPERVISOR" } }),
    prisma.permit.count({ where: { site: { mineId }, status: "ACTIVE" } }),
  ]);

  return {
    openHazardReportsByType: Object.fromEntries(openHazardsByType.map((r) => [r.hazardType, r._count])),
    upcomingSafetyInspections: upcomingInspections,
    permitsToWorkAwaitingSupervisorSignOff: pendingPermitsToWork,
    activePermits,
  };
}

router.post("/", aiLimiter, async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid chat payload" });
  if (parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user" });
  }

  if (!(await isAiConfigured())) {
    return res.json({ configured: false, reply: null });
  }

  try {
    const context = await buildSafetyContext(mineId);
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard Site Safety Assistant, helping a Supervisor at a South African mine with safety ` +
          `procedures, hazard-reporting guidance, and general site-safety questions (e.g. how to report a hazard, ` +
          `what a permit-to-work needs, PPE requirements, emergency procedures). ` +
          `Base any figures you cite strictly on the JSON snapshot provided. ` +
          `You must politely decline anything outside safety/procedure scope — financial data, security-sensitive ` +
          `information, disciplinary/personnel matters, or anything requiring executive-level access — and suggest ` +
          `the Supervisor raise it with the relevant department instead.` +
          GUARDRAIL,
      },
      { role: "system", content: `Current site safety snapshot (JSON): ${JSON.stringify(context)}` },
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
