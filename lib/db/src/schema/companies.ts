import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Verification workflow:
 * draft    -> the company is still filling in its details
 * pending  -> submitted for review, waiting on an admin
 * verified -> approved, the badge is public
 * rejected -> declined; verificationNote explains why and it can be resubmitted
 */
export const verificationStatusEnum = pgEnum("verification_status", [
  "draft",
  "pending",
  "verified",
  "rejected",
]);
export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];

export const companiesTable = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),
  employeeCount: integer("employee_count"),
  foundedYear: integer("founded_year"),
  verified: boolean("verified").notNull().default(false),
  verificationStatus: verificationStatusEnum("verification_status").notNull().default("draft"),
  verificationNote: text("verification_note"),
  verificationRequestedAt: timestamp("verification_requested_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
