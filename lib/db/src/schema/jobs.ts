import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const jobStatusEnum = pgEnum("job_status", ["draft", "active", "paused", "closed"]);
export const contractTypeEnum = pgEnum("contract_type", ["full-time", "part-time", "contract", "internship"]);
export const experienceLevelEnum = pgEnum("experience_level", ["entry", "mid", "senior", "lead"]);

/** One question the company added to its per-job application form. */
export const applicationFormFieldSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().trim().min(1).max(200),
  type: z.enum(["short-text", "long-text", "number", "date", "select"]),
  options: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  required: z.boolean().optional().default(false),
  hint: z.string().max(300).optional(),
});
export type ApplicationFormField = z.infer<typeof applicationFormFieldSchema>;

export const jobsTable = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  contractType: contractTypeEnum("contract_type").notNull().default("full-time"),
  experienceLevel: experienceLevelEnum("experience_level").notNull().default("mid"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  deadline: timestamp("deadline", { withTimezone: true }),
  // Company-built application form: empty means only the quick apply
  // (CV + profile snapshot) is available for this job.
  applicationForm: jsonb("application_form").$type<ApplicationFormField[]>().notNull().default([]),
  status: jobStatusEnum("status").notNull().default("draft"),
  applicantsCount: integer("applicants_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  applicantsCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
