import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireCyberAccess } from "../lib/cyberAccess";
import { prisma } from "../prisma";
import {
  clearSystemSetting,
  isKnownSystemSetting,
  listSystemSettings,
  setSystemSetting,
} from "../lib/systemSettings";

const router = Router();

// Global, not mine-scoped — these settings drive shared infrastructure (the AI assistant,
// the metals price feed) used by every mine on this deployment, same reasoning as the
// buyer-threats/global-blocklist routes in cyberAccessControl.ts. Any Owner or IT Manager
// on any mine can view and change them.
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

export default router;
