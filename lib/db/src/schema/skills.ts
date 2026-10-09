import { pgTable, uuid, text, serial, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillCategoryEnum = pgEnum("skill_category", [
  "professional",
  "technical",
  "soft",
  "language",
]);

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: skillCategoryEnum("category").notNull().default("professional"),
});

export const jobSkillsTable = pgTable("job_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull(),
  skillId: integer("skill_id").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
});

export const candidateSkillsTable = pgTable("candidate_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  skillId: integer("skill_id").notNull(),
  proficiency: integer("proficiency").notNull().default(3),
  yearsExperience: integer("years_experience"),
});

export const insertSkillSchema = createInsertSchema(skillsTable).omit({ id: true });
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skillsTable.$inferSelect;

export const insertJobSkillSchema = createInsertSchema(jobSkillsTable).omit({ id: true });
export type InsertJobSkill = z.infer<typeof insertJobSkillSchema>;
export type JobSkill = typeof jobSkillsTable.$inferSelect;

export const insertCandidateSkillSchema = createInsertSchema(candidateSkillsTable).omit({ id: true });
export type InsertCandidateSkill = z.infer<typeof insertCandidateSkillSchema>;
export type CandidateSkill = typeof candidateSkillsTable.$inferSelect;
