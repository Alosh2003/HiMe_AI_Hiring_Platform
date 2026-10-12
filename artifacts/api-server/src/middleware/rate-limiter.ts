import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  /** Unique namespace so multiple limiters don't share counters */
  name: string;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Cleanup expired entries across all namespaces
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key);
      }
    }
  }
}, 5 * 60 * 1000);

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map<string, RateLimitEntry>();
    stores.set(name, store);
  }
  return store;
}

export function rateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, message, name } = config;
  const store = getStore(name);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || entry.resetTime < now) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      logger.warn({ limiter: name, key, count: entry.count }, "Rate limit exceeded");
      res.status(429).json({
        error: "Too Many Requests",
        message: message || "Too many requests, please try again later",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    next();
  };
}

/** Global limiter applied to all routes */
export const globalRateLimiter = rateLimiter({
  name: "global",
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: "Too many requests, please try again later",
});

/** Stricter limiter for auth endpoints */
export const authRateLimiter = rateLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many authentication attempts, please try again later",
});

/** Stricter limiter for AI endpoints */
export const aiRateLimiter = rateLimiter({
  name: "ai",
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "AI rate limit exceeded, please try again later",
});

/**
 * Limit for the anonymous public CV assessment. Each valid call spends a
 * Gemini request with no user attached, so it stays tight — but invalid
 * requests never reach it, so real users are unlikely to hit it by accident.
 */
export const assessRateLimiter = rateLimiter({
  name: "assess",
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: "Assessment limit reached. Create a free account for unlimited assessments.",
});