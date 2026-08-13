import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

router.use(requireAuth);

// Audit history is only ever useful scoped to one record at a time (shown from a "History"
// button on that record's row) — a bare list of every change across the whole mine would be
// noise. Restricted to ADMIN/EXECUTIVE since it can reveal who did what across departments.
router.get("/", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const entityType = req.query.entityType as string | undefined;
  const entityId = req.query.entityId as string | undefined;
  if (!entityType || !entityId) {
    return res.status(400).json({ error: "entityType and entityId are required" });
  }
  const entries = await prisma.auditLog.findMany({
    where: { mineId, entityType, entityId },
    select: {
      id: true,
      action: true,
      changedBy: { select: { id: true, name: true } },
      snapshot: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(entries);
});

export default router;
