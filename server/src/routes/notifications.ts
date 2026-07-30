import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const [reviewedAlerts, reviewedIncidents] = await Promise.all([
    prisma.alert.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
    prisma.incident.findMany({
      where: { reviewStatus: { in: ["APPROVED", "REJECTED"] } },
      include: {
        site: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 30,
    }),
  ]);

  const items = [
    ...reviewedAlerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: "alert" as const,
      title: a.message,
      severity: a.severity,
      reviewStatus: a.reviewStatus,
      reviewNote: a.reviewNote,
      reviewedAt: a.reviewedAt,
      reviewedBy: a.reviewedBy,
      site: a.site,
    })),
    ...reviewedIncidents.map((i) => ({
      id: `incident-${i.id}`,
      kind: "incident" as const,
      title: i.title,
      severity: i.severity,
      reviewStatus: i.reviewStatus,
      reviewNote: i.reviewNote,
      reviewedAt: i.reviewedAt,
      reviewedBy: i.reviewedBy,
      site: i.site,
    })),
  ]
    .filter((item) => item.reviewedAt)
    .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
    .slice(0, 30);

  res.json(items);
});

export default router;
