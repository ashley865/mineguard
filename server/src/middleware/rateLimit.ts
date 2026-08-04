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
