import type { Request, Response, NextFunction } from "express";
import { lt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { rateLimitsTable } from "@workspace/db/schema";
import { getConfig } from "../config/env";
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

// ─── In-memory store (fallback and RATE_LIMIT_STORE=memory) ──────────────

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

function memoryHit(
  store: Map<string, RateLimitEntry>,
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; count: number; resetTime: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, count: 1, resetTime: now + windowMs };
  }

  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    count: entry.count,
    resetTime: entry.resetTime,
  };
}

// ─── Postgres store (shared across processes, survives restarts) ─────────

let pgAvailable = true;
let cleanupScheduled = false;

function usesPostgres(): boolean {
  if (!pgAvailable) return false;
  try {
    return getConfig().RATE_LIMIT_STORE === "postgres";
  } catch {
    return false;
  }
}

async function pgHit(
  name: string,
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean; count: number; resetTime: number }> {
  // Fixed window aligned to the limiter's own cadence, so every process
  // computes the same window for the same instant.
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const resetTime = windowStartMs + windowMs;

  const rows = await db.insert(rateLimitsTable).values({
    name,
    key,
    windowStart: new Date(windowStartMs),
    count: 1,
  }).onConflictDoUpdate({
    target: [rateLimitsTable.name, rateLimitsTable.key, rateLimitsTable.windowStart],
    set: { count: sql`${rateLimitsTable.count} + 1` },
  }).returning({ count: rateLimitsTable.count });

  if (!cleanupScheduled) {
    cleanupScheduled = true;
    // Opportunistic sweep: drop windows older than a day. Runs on the first
    // request after boot rather than on a timer so idle processes stay quiet.
    void db.delete(rateLimitsTable)
      .where(lt(rateLimitsTable.windowStart, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .catch((err) => logger.warn({ err }, "rate_limits cleanup failed"));
  }

  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= maxRequests, count, resetTime };
}

// ─── Middleware ───────────────────────────────────────────────────────────

export function rateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, message, name } = config;
  const store = getStore(name);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";

    const finish = (result: { allowed: boolean; count: number; resetTime: number }): void => {
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000));

      if (!result.allowed) {
        logger.warn({ limiter: name, key, count: result.count }, "Rate limit exceeded");
        res.status(429).json({
          error: "Too Many Requests",
          message: message || "Too many requests, please try again later",
          retryAfter: Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)),
        });
        return;
      }

      next();
    };

    if (usesPostgres()) {
      pgHit(name, key, windowMs, maxRequests)
        .then(finish)
        .catch((err) => {
          // The database is the shared source of truth; if it is unreachable
          // we still enforce the limit in memory rather than fail open — but
          // mark postgres unavailable so we stop hammering a dead DB.
          logger.error({ err, limiter: name }, "Postgres rate-limit store failed; falling back to memory");
          pgAvailable = false;
          finish(memoryHit(store, key, windowMs, maxRequests));
        });
      return;
    }

    finish(memoryHit(store, key, windowMs, maxRequests));
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
