import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Single-use tokens for password resets and email verification.
 * Only the SHA-256 hash of the token is stored, so a database leak does not
 * hand out live reset links.
 */
export const authTokenTypes = ["password-reset", "email-verification"] as const;

export const authTokensTable = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").$type<(typeof authTokenTypes)[number]>().notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthToken = typeof authTokensTable.$inferSelect;
