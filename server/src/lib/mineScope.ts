import { Request, Response } from "express";

/**
 * Every operational resource in the app is ultimately reachable through a chain
 * back to Site -> Mine. `req.auth.mineId` is set by requireAuth from a fresh DB
 * read (see middleware/auth.ts), never from client input, so it is safe to use
 * directly as an authorization boundary: every list query should filter by it,
 * and every single-record lookup should include it in the `where` clause so a
 * record belonging to another mine returns 404, not 200 with someone else's data.
 *
 * Writes a 403 and returns null if the caller isn't currently a member of a mine
 * (e.g. a user record that was orphaned after their mine assignment was cleared).
 */
export function requireMineId(req: Request, res: Response): string | null {
  const mineId = req.auth?.mineId;
  if (!mineId) {
    res.status(403).json({ error: "You are not a member of a mine" });
    return null;
  }
  return mineId;
}
