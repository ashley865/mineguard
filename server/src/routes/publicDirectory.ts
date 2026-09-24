import { Router } from "express";
import { prisma } from "../prisma";
import { publicDirectoryLimiter } from "../middleware/rateLimit";
import { isGlobalIpBlocked } from "../lib/ipBlocklist";

const router = Router();

// Public: powers the /portal hub page's mine+site picker for visitor check-in and
// contractor registration, both of which need a specific siteId to proceed (see
// routes/visitors.ts's checkin flow and routes/contractors.ts's register flow) but a
// first-time visitor arriving at a general link has no way to already know one. Only
// names and locations are exposed — the same information already printed on a site's own
// gate signage or QR code, nothing that isn't already public knowledge to anyone physically
// going there.
router.get("/directory", publicDirectoryLimiter, async (req, res) => {
  // No single mine to scope a block to here — checked against the shared global list,
  // same as buyer login.
  if (await isGlobalIpBlocked(req.ip)) {
    return res.status(403).json({ error: "Access blocked from this network" });
  }
  const mines = await prisma.mine.findMany({
    select: {
      id: true,
      name: true,
      sites: { select: { id: true, name: true, location: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  res.json(mines.filter((m) => m.sites.length > 0));
});

export default router;
