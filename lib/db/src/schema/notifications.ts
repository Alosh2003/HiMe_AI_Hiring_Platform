import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * In-app notifications: application decisions for seekers, verification
 * outcomes for companies. Replaces the decorative bell.
 */
export const notificationsTable = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
