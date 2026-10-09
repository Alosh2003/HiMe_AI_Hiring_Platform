import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchResultsTable = pgTable("match_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull(),
  candidateId: uuid("candidate_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  breakdown: jsonb("breakdown").$type<{
    skills: { score: number; matched: string[]; missing: string[] };
    experience: { score: number; relevant: string[] };
    education: { score: number; notes: string };
    culture: { score: number; notes: string };
    location: { score: number; notes: string };
    salary: { score: number; notes: string };
  }>(),
  explanation: text("explanation"),
  modelVersion: text("model_version").notNull().default("v1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMatchResultSchema = createInsertSchema(matchResultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;
export type MatchResult = typeof matchResultsTable.$inferSelect;
