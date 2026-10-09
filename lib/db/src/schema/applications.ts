import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "reviewing",
  "shortlisted",
  "interview",
  "rejected",
  "accepted",
]);

export const applicationsTable = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull(),
  candidateId: uuid("candidate_id").notNull(),
  status: applicationStatusEnum("status").notNull().default("applied"),
  matchScore: integer("match_score"),
  matchBreakdown: jsonb("match_breakdown").$type<{
    skills: number;
    experience: number;
    education: number;
    culture: number;
    location: number;
    salary: number;
  }>(),
  aiExplanation: text("ai_explanation"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobCandidateUnique: uniqueIndex("applications_job_candidate_unique").on(table.jobId, table.candidateId),
}));

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  appliedAt: true,
  updatedAt: true,
});
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
