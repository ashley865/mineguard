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
import { sendTestEmail } from "../lib/email";
import { sendTestWhatsApp } from "../lib/whatsapp";
import {
  createCustomApiKey,
  deleteCustomApiKey,
  executeCustomApiKey,
  listCustomApiKeys,
  updateCustomApiKey,
  validateCustomKeyName,
} from "../lib/customApiKeys";

const router = Router();

// Global, not mine-scoped — these settings drive shared infrastructure (the AI assistant,
// the metals price feed, the security webhook, maintenance mode, brute-force policy, and
// any custom keys an admin adds) used by every mine on this deployment, same reasoning as
// the buyer-threats/global-blocklist routes in cyberAccessControl.ts. Any Owner or IT
// Manager on any mine can view and change them.
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
    const provider = (await resolveSetting("METALS_API_PROVIDER")) || "twelvedata";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url =
        provider === "metals-api"
          ? `https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=XAU`
          : `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${apiKey}`;
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const data: any = await response.json().catch(() => null);
      if (provider === "metals-api") {
        if (response.ok && data?.success) return res.json({ success: true, message: "Metals API responded successfully" });
        return res.json({ success: false, message: data?.error?.info || `Metals API responded with ${response.status}` });
      }
      if (response.ok && data?.price && !data?.code) return res.json({ success: true, message: "Twelve Data responded successfully" });
      return res.json({ success: false, message: data?.message || `Twelve Data responded with ${response.status}` });
    } catch (err) {
      return res.json({ success: false, message: err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Could not reach the metals API" });
    }
  }

  if (key === "SECURITY_ALERT_WEBHOOK_URL") {
    const url = await resolveSetting("SECURITY_ALERT_WEBHOOK_URL");
    if (!url) return res.json({ success: false, message: "No webhook URL is configured" });
    return res.json(await sendTestWebhook(url));
  }

  if (key === "SMTP_HOST") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { email: true } });
    if (!me?.email) return res.json({ success: false, message: "Could not determine your account email" });
    return res.json(await sendTestEmail(me.email));
  }

  if (key === "WHATSAPP_API_KEY") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { phone: true } });
    if (!me?.phone) return res.json({ success: false, message: "Add a phone number to your profile first" });
    return res.json(await sendTestWhatsApp(me.phone));
  }

  return res.status(400).json({ error: "This setting cannot be tested" });
});

// Custom API keys — "add a new API key" beyond the fixed, code-wired list above. Values
// are write-only from the client's perspective: list/create/update responses never echo
// the key back (see lib/customApiKeys.ts's listSelect), only execute() reads it internally.
const authStyleSchema = z.enum(["BEARER", "HEADER", "QUERY"]);

const createCustomKeySchema = z.object({
  name: z.string().trim().toUpperCase(),
  value: z.string().trim().min(1).max(2000),
  testUrl: z.string().trim().url().optional().nullable(),
  authStyle: authStyleSchema.optional(),
  headerName: z.string().trim().max(200).optional().nullable(),
  queryParam: z.string().trim().max(200).optional().nullable(),
});

router.get("/custom", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  res.json(await listCustomApiKeys());
});

router.post("/custom", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = createCustomKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const nameError = validateCustomKeyName(parsed.data.name);
  if (nameError) return res.status(400).json({ error: nameError });
  if (isKnownSystemSetting(parsed.data.name)) return res.status(409).json({ error: "This name is already used by a built-in setting" });
  if (parsed.data.authStyle === "HEADER" && !parsed.data.headerName) return res.status(400).json({ error: "A header name is required for this auth style" });
  if (parsed.data.authStyle === "QUERY" && !parsed.data.queryParam) return res.status(400).json({ error: "A query parameter name is required for this auth style" });

  const existing = await prisma.customApiKey.findUnique({ where: { name: parsed.data.name } });
  if (existing) return res.status(409).json({ error: "A key with this name already exists" });

  const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { name: true } });
  try {
    const created = await createCustomApiKey({ ...parsed.data, createdByName: me?.name ?? null });
    res.status(201).json(created);
  } catch {
    res.status(409).json({ error: "A key with this name already exists" });
  }
});

const updateCustomKeySchema = z.object({
  value: z.string().trim().min(1).max(2000).optional(),
  testUrl: z.string().trim().url().optional().nullable(),
  authStyle: authStyleSchema.optional(),
  headerName: z.string().trim().max(200).optional().nullable(),
  queryParam: z.string().trim().max(200).optional().nullable(),
});

router.put("/custom/:id", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const parsed = updateCustomKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.customApiKey.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Key not found" });
  const updated = await updateCustomApiKey(existing.id, parsed.data);
  res.json(updated);
});

router.delete("/custom/:id", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.customApiKey.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Key not found" });
  await deleteCustomApiKey(existing.id);
  res.status(204).send();
});

// "Execute" — actually calls testUrl with this key attached, through the SSRF guard.
router.post("/custom/:id/execute", async (req, res) => {
  if (!(await requireCyberAccess(req, res))) return;
  const existing = await prisma.customApiKey.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: "Key not found" });
  res.json(await executeCustomApiKey(existing.id));
});

export default router;
