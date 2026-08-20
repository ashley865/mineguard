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
