import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Fixed-window rate-limit counters shared by every API process.
 * In-memory counters reset on restart and are invisible to sibling
 * processes; this table makes the limit a fact instead of a suggestion.
 */
export const rateLimitsTable = pgTable("rate_limits", {
  name: text("name").notNull(),
  key: text("key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.name, table.key, table.windowStart] }),
}));

export type RateLimitRow = typeof rateLimitsTable.$inferSelect;
