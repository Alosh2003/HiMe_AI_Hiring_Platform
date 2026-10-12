import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Immutable record of privileged actions: admin approvals, rejections,
 * suspensions and deletions, plus company verification requests.
 * actorId is nullable so the trail survives the actor's account deletion.
 */
export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
