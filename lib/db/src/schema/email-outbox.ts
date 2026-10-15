import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Outbound email captured verbatim. There is no SMTP provider configured in
 * development, so every email the platform "sends" lands here (and in the
 * structured log) — real links a human can open, instead of a silent no-op.
 * Swap in a real transport later without touching the call sites.
 */
export const emailOutboxTable = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OutboxEmail = typeof emailOutboxTable.$inferSelect;
