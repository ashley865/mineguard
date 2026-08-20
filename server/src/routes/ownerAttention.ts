import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";

const router = Router();

// Owner-only ("Needs Your Attention") summary — a broader, cross-department counterpart to
// the CFO's Approvals Inbox, surfacing anything across the whole mine that's waiting on a
// decision only the mine owner (or whoever they delegate to) can make.
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const [
    pendingExpenses,
    submittedOrders,
    pendingExecutiveRequests,
    criticalItIncidents,
    pendingExecutiveInvites,
    pendingPermitsToWork,
    pendingItAccessRequests,
    pendingLeaveRequests,
  ] = await Promise.all([
    prisma.expense.aggregate({ where: { status: "PENDING", site: { mineId } }, _count: true, _sum: { amount: true } }),
    prisma.purchaseOrder.aggregate({ where: { status: "SUBMITTED", site: { mineId } }, _count: true, _sum: { totalAmount: true } }),
    prisma.executiveRequest.count({ where: { mineId, status: "PENDING" } }),
    prisma.iTSecurityIncident.count({ where: { mineId, severity: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.executiveInvite.count({ where: { mineId, status: "PENDING" } }),
    prisma.permitToWork.count({ where: { status: "PENDING_EXECUTIVE", site: { mineId } } }),
    prisma.iTAccessRequest.count({ where: { mineId, status: "REQUESTED" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", worker: { site: { mineId } } } }),
  ]);

  res.json({
    pendingExpenses: { count: pendingExpenses._count, total: pendingExpenses._sum.amount ?? 0 },
    pendingPurchaseOrders: { count: submittedOrders._count, total: submittedOrders._sum.totalAmount ?? 0 },
    pendingExecutiveRequests: { count: pendingExecutiveRequests },
    criticalItIncidents: { count: criticalItIncidents },
    pendingExecutiveInvites: { count: pendingExecutiveInvites },
    pendingPermitsToWork: { count: pendingPermitsToWork },
    pendingItAccessRequests: { count: pendingItAccessRequests },
    pendingLeaveRequests: { count: pendingLeaveRequests },
  });
});

export default router;
