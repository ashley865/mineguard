import { NextFunction, Request, Response } from "express";

// Strips HTML/script tags and control characters from every string value in a request
// body, recursively. This is a defense-in-depth measure: React already escapes rendered
// text, but stored values also flow into CSV exports, emails, and printed documents where
// unescaped markup or control characters could cause problems.
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}
