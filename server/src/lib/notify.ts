import { ExecutiveTitle, NotificationType } from "@prisma/client";
import { Server as SocketServer } from "socket.io";
import { prisma } from "../prisma";

export interface NotifyExecutivesInput {
  mineId: string;
  /** Executive titles who should receive this — e.g. ["CFO", "GENERAL_MANAGER"]. */
  titles?: ExecutiveTitle[];
  /** Every EXECUTIVE regardless of title — for workflows (like visitor approval) any executive can action. Takes precedence over `titles`. */
  allExecutives?: boolean;
  /** The mine owner (ADMIN) is included by default, since they can act on anything. */
  includeAdmin?: boolean;
  /** A specific user to notify directly, in addition to (or instead of) title/role matching — e.g. the supervisor who submitted a permit, once it's decided. */
  userIds?: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Fans out one persisted Notification row per matching recipient, then pushes a
 * lightweight real-time ping to the mine's socket room so an open NotificationBell
 * refreshes immediately — mirroring the existing "request:new" pattern in
 * executiveRequests.ts, except the underlying data survives a refresh or being offline,
 * unlike a bare socket event. Recipients are resolved fresh at send time (not retroactively
 * applied to past notifications), same as an email — someone promoted to IT Manager
 * tomorrow won't see today's IT access request notifications.
 */
export async function notifyExecutives(io: SocketServer | undefined, input: NotifyExecutivesInput): Promise<void> {
  const { mineId, titles, allExecutives, includeAdmin = true, userIds = [], type, title, body, link } = input;

  const orConditions: Record<string, unknown>[] = [];
  if (includeAdmin) orConditions.push({ role: "ADMIN" });
  if (allExecutives) orConditions.push({ role: "EXECUTIVE" });
  else if (titles?.length) orConditions.push({ role: "EXECUTIVE", title: { in: titles } });
  if (userIds.length) orConditions.push({ id: { in: userIds } });
  if (orConditions.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: { mineId, isActive: true, OR: orConditions },
    select: { id: true },
  });
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({ mineId, recipientId: r.id, type, title, body, link })),
  });

  io?.to(`mine:${mineId}`).emit("notification:new", { type });
}
