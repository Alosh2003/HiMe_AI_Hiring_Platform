import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  headline: text("headline"),
  summary: text("summary"),
  location: text("location"),
  yearsExperience: integer("years_experience"),
  cvUrl: text("cv_url"),
  cvParsedData: jsonb("cv_parsed_data"),
  preferences: jsonb("preferences").$type<{
    industries: string[];
    contractTypes: string[];
    remote: boolean;
    salaryMin?: number;
  }>(),
  completion: integer("completion").notNull().default(0),
  // Privacy + alerts the seeker controls from the profile page. Both default
  // on so existing candidates keep their current visibility/notifications.
  visibleToCompanies: boolean("visible_to_companies").notNull().default(true),
  jobAlerts: boolean("job_alerts").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const experiencesTable = pgTable("experiences", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  role: text("role").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  description: text("description"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  current: boolean("current").notNull().default(false),
});

export const educationTable = pgTable("education", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  degree: text("degree").notNull(),
  field: text("field"),
  institution: text("institution"),
  year: integer("year"),
});

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url"),
});

export const certificationsTable = pgTable("certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id").notNull(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  year: integer("year"),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
