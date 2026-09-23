import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requirePlatformAdminAuth } from "../middleware/platformAdminAuth";
import { generatePlatformAdminAccessKey } from "../lib/platformAdminKeys";
import { logAdminAction } from "../lib/platformAdminAudit";
import { sendEmail } from "../lib/email";

const router = Router();
router.use(requirePlatformAdminAuth);

const createAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const adminSelect = { id: true, name: true, email: true, createdAt: true, lastLoginAt: true, accessKeyIssuedAt: true } as const;

router.get("/admins", async (req, res) => {
  const admins = await prisma.platformAdmin.findMany({ select: adminSelect, orderBy: { createdAt: "asc" } });
  res.json(admins);
});

// Unlike /bootstrap (which only ever works once, with nobody yet logged in), this is how
// every admin after the first gets added — by someone already inside the tool, the same
// way an ADMIN invites an EXECUTIVE in the mine-facing app.
router.post("/admins", async (req, res) => {
  const parsed = createAdminSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "An admin with this email already exists" });

  const { key, hash } = await generatePlatformAdminAccessKey();
  const admin = await prisma.platformAdmin.create({
    data: { name: parsed.data.name, email: parsed.data.email, accessKeyHash: hash, accessKeyIssuedAt: new Date() },
    select: adminSelect,
  });

  await logAdminAction(req.platformAdminAuth!.platformAdminId, "ADMIN_CREATED", "PlatformAdmin", admin.id, `Created admin ${admin.name} <${admin.email}>`);

  // Best-effort: the key is also returned below, so a missing/misconfigured SMTP setup
  // never blocks onboarding a new admin — whoever created the account can relay it instead.
  void sendEmail({
    to: admin.email,
    subject: "Your MineGuard Platform Admin access key",
    text: `You've been added as a MineGuard platform admin.\n\nYour access key: ${key}\n\nSign in at the platform admin login page with this key. It's shown only this once — if it's lost, ask another admin to issue you a new one.`,
    html: `<p>You've been added as a MineGuard platform admin.</p><p><strong>Your access key:</strong> <code>${key}</code></p><p>Sign in at the platform admin login page with this key. It's shown only this once — if it's lost, ask another admin to issue you a new one.</p>`,
  });

  res.status(201).json({ admin, accessKey: key });
});

router.delete("/admins/:id", async (req, res) => {
  const existing = await prisma.platformAdmin.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Admin not found" });
  if (existing.id === req.platformAdminAuth!.platformAdminId) {
    return res.status(400).json({ error: "You can't remove your own account" });
  }
  const totalAdmins = await prisma.platformAdmin.count();
  if (totalAdmins <= 1) {
    return res.status(409).json({ error: "At least one platform admin must remain" });
  }
  await prisma.platformAdmin.delete({ where: { id: existing.id } });
  await logAdminAction(req.platformAdminAuth!.platformAdminId, "ADMIN_REMOVED", "PlatformAdmin", existing.id, `Removed admin ${existing.name} <${existing.email}>`);
  res.status(204).send();
});

router.get("/audit-log", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await prisma.platformAdminAuditLog.findMany({
    select: { id: true, action: true, targetType: true, targetId: true, detail: true, createdAt: true, actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(logs);
});

export default router;
