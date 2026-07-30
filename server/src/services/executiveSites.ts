import { prisma } from "../prisma";

export async function getAssignedSiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.executiveSiteAssignment.findMany({
    where: { userId },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}
