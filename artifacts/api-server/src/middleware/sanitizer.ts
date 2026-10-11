import type { Request, Response, NextFunction } from "express";

// ─── Input sanitization helpers ────────────────────────────────────────────

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .slice(0, 10000); // Max 10KB
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().slice(0, 254);
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ─── Middleware ────────────────────────────────────────────────────────────

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
}

export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        req.query[key] = sanitizeString(value);
      }
    }
  }
  next();
}
