import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireCyberAccess } from "../lib/cyberAccess";
import { prisma } from "../prisma";
import {
  clearSystemSetting,
  isKnownSystemSetting,
  listSystemSettings,
  resolveSetting,
  setSystemSetting,
  validateSettingValue,
} from "../lib/systemSettings";
import { aiChatComplete, AiNotConfiguredError } from "../lib/ai";
import { sendTestWebhook } from "../lib/securityWebhook";

const router = Router();

// Global, not mine-scoped — these settings drive shared infrastructure (the AI assistant,
// the metals price feed, the security webhook, maintenance mode, brute-force policy) used
// by every mine on this deployment, same reasoning as the buyer-threats/global-blocklist
// routes in cyberAccessControl.ts. Any Owner or IT Manager on any mine can view and change
// them.
router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  res.json(await listSystemSettings());
});

const updateSchema = z.object({ value: z.string().trim().min(1).max(2000) });

router.put("/:key", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const { key } = req.params;
  if (!isKnownSystemSetting(key)) return res.status(404).json({ error: "Unknown setting" });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A non-empty value is required" });
  const validationError = validateSettingValue(key, parsed.data.value);
  if (validationError) return res.status(400).json({ error: validationError });

  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true } });
  await setSystemSetting(key, parsed.data.value, me?.name ?? null);
  res.json((await listSystemSettings()).find((s) => s.key === key));
});

router.delete("/:key", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const { key } = req.params;
  if (!isKnownSystemSetting(key)) return res.status(404).json({ error: "Unknown setting" });
  await clearSystemSetting(key);
  res.json((await listSystemSettings()).find((s) => s.key === key));
});

// Actually exercises the currently-saved configuration against the real provider, rather
// than just confirming a value was stored — "Save" can succeed with a typo'd key that only
// a live call would catch.
router.post("/:key/test", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const { key } = req.params;

  if (key === "AI_API_KEY") {
    try {
      await aiChatComplete([{ role: "user", content: "Reply with just the word OK." }]);
      return res.json({ success: true, message: "AI provider responded successfully" });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) return res.json({ success: false, message: "No AI API key is configured" });
      return res.json({ success: false, message: err instanceof Error ? err.message : "AI provider request failed" });
    }
  }

  if (key === "METALS_API_KEY") {
    const apiKey = await resolveSetting("METALS_API_KEY");
    if (!apiKey) return res.json({ success: false, message: "No metals API key is configured" });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response;
      try {
        response = await fetch(`https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=XAU`, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data: any = await response.json().catch(() => null);
      if (response.ok && data?.success) return res.json({ success: true, message: "Metals API responded successfully" });
      return res.json({ success: false, message: data?.error?.info || `Metals API responded with ${response.status}` });
    } catch (err) {
      return res.json({ success: false, message: err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Could not reach the metals API" });
    }
  }

  if (key === "SECURITY_ALERT_WEBHOOK_URL") {
    const url = await resolveSetting("SECURITY_ALERT_WEBHOOK_URL");
    if (!url) return res.json({ success: false, message: "No webhook URL is configured" });
    return res.json(await sendTestWebhook(url));
  }

  return res.status(400).json({ error: "This setting cannot be tested" });
});

export default router;
