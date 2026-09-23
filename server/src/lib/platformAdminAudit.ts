import { prisma } from "../prisma";

/**
 * Records one action taken through the platform admin tool. Fire-and-forget by design,
 * same reasoning as notify.ts's email/webhook sends — a logging failure must never break
 * the actual mutation that triggered it.
 */
export async function logAdminAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  detail?: string
): Promise<void> {
  try {
    await prisma.platformAdminAuditLog.create({ data: { actorId, action, targetType, targetId, detail } });
  } catch {
    // Best-effort only.
  }
}
