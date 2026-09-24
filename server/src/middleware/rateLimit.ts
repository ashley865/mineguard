import rateLimit from "express-rate-limit";

/**
 * Applied to credential-guessing surfaces: login, registration, mine registration,
 * and executive invite acceptance. Keyed by IP, so a single caller hammering these
 * endpoints gets locked out well before a meaningful brute-force attempt completes.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

/**
 * Looser than authLimiter since the caller is already authenticated, but still
 * caps how many times a current password can be guessed against an account.
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

/**
 * A generous, blanket ceiling applied to every /api request (see index.ts), on top of
 * the tighter route-specific limiters above. This isn't meant to catch normal usage —
 * a dashboard with several panels can easily fire 20-30 requests on load — it's meant to
 * bound outright abuse (scraping, a runaway client-side polling loop, a credential-stuffing
 * script that rotates through many endpoints) that the narrower auth-specific limiters
 * wouldn't see, consistent with an enterprise API's expectation that *no* endpoint is
 * fully unbounded.
 */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 900,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "anonymous",
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

/**
 * A real visitor checks in for one visit at a time — this is generous enough for a group
 * arriving from behind the same NAT/office gateway, but tight enough that automated
 * flooding of a site's check-in form is caught well before the blanket apiLimiter would
 * ever notice.
 */
export const visitorCheckinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "anonymous",
  message: { error: "Too many check-in attempts. Please try again later." },
});

/**
 * Shared by both marketplace and tender bid submission — a real bidder might place a
 * handful of bids in a sitting, but not dozens.
 */
export const bidLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "anonymous",
  message: { error: "Too many bids submitted. Please try again later." },
});

/**
 * The mine/site directory is small and rarely needs refetching — this is loose enough for
 * the /portal page itself (which fetches it once) but tight enough that scraping the full
 * list of every mine and site on the platform takes real effort, not one script.
 */
export const publicDirectoryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "anonymous",
  message: { error: "Too many requests. Please try again shortly." },
});

/**
 * Every AI request costs real money once a provider key is configured, so this
 * caps spend per person rather than per IP (several executives can share an
 * office network) by keying on the authenticated user id set by requireAuth.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId || req.ip || "anonymous",
  message: { error: "Too many AI requests. Please try again in a few minutes." },
});
