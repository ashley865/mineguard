import { Server } from "socket.io";
import { ExecutiveTitle } from "@prisma/client";
import { prisma } from "../prisma";

// Runs hourly (see index.ts) but only actually does anything on the 25th of the month —
// checking the date on every tick rather than computing a precise "next 25th" delay keeps
// this as simple as the rest of the app's setInterval-based services (no cron dependency),
// and is idempotent: each mine/title combination is checked against ExecutiveRequests
// already created this month before creating another, so re-running within the same day
// (or after a server restart) never sends duplicates.

const PAYROLL_APPROVAL_CATEGORY = "PAYROLL_PAYMENT";
const APPROVAL_TITLES: ExecutiveTitle[] = ["HR_MANAGER", "CFO"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

export async function sendMonthlyPayrollApprovalRequests(io?: Server): Promise<void> {
  const now = new Date();
  if (now.getDate() !== 25) return;

  const monthStart = startOfMonth(now);
  const priorMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  const mines = await prisma.mine.findMany({ select: { id: true, name: true } });

  for (const mine of mines) {
    const [admin, executives] = await Promise.all([
      prisma.user.findFirst({
        where: { mineId: mine.id, role: "ADMIN", isActive: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findMany({
        where: { mineId: mine.id, role: "EXECUTIVE", isActive: true, title: { in: APPROVAL_TITLES } },
        select: { id: true, title: true },
      }),
    ]);
    // No ADMIN to attribute the request to, or nobody holding either title yet — nothing
    // to send for this mine this month.
    if (!admin || executives.length === 0) continue;

    const [workerCount, lastMonthPayroll] = await Promise.all([
      prisma.worker.count({ where: { site: { mineId: mine.id } } }),
      prisma.expense.aggregate({
        where: {
          site: { mineId: mine.id },
          category: "SALARIES_WAGES",
          status: "PAID",
          expenseDate: { gte: priorMonthStart, lt: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const lastMonthTotal = lastMonthPayroll._sum.amount;
    const contextLine = lastMonthTotal
      ? `Last month's paid payroll totalled approximately ZAR ${Math.round(lastMonthTotal).toLocaleString()}.`
      : `No paid payroll expense total is on record for last month yet.`;

    for (const title of APPROVAL_TITLES) {
      const holder = executives.find((e) => e.title === title);
      if (!holder) continue;

      const alreadySent = await prisma.executiveRequest.findFirst({
        where: { mineId: mine.id, toTitle: title, category: PAYROLL_APPROVAL_CATEGORY, createdAt: { gte: monthStart } },
        select: { id: true },
      });
      if (alreadySent) continue;

      const request = await prisma.executiveRequest.create({
        data: {
          mineId: mine.id,
          fromUserId: admin.id,
          toTitle: title,
          category: PAYROLL_APPROVAL_CATEGORY,
          subject: `Monthly Payroll Review — ${monthLabel(now)}`,
          message:
            `It's the 25th — payroll for ${monthLabel(now)} needs to be prepared and approved. ` +
            `${mine.name} currently has ${workerCount} worker${workerCount === 1 ? "" : "s"} on record. ${contextLine} ` +
            `Please review and approve this month's payslips/payroll expenses once ready.`,
        },
        select: {
          id: true,
          toTitle: true,
          category: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
          fromUser: { select: { id: true, name: true, title: true } },
        },
      });

      io?.to(`mine:${mine.id}`).emit("request:new", { ...request, hasAttachment: false });
    }
  }
}
