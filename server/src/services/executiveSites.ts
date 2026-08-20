import { prisma } from "../prisma";

export async function getAssignedSiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.executiveSiteAssignment.findMany({
    where: { userId },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}

/** Reverse of getAssignedSiteIds — which executive users are assigned to a given site. */
export async function getUsersAssignedToSite(siteId: string): Promise<string[]> {
  const rows = await prisma.executiveSiteAssignment.findMany({
    where: { siteId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
