import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  candidateSkillsTable,
  candidatesTable,
  educationTable,
  experiencesTable,
  jobSkillsTable,
  jobsTable,
  matchResultsTable,
  skillsTable,
} from "@workspace/db/schema";
import type { MatchInput } from "./types";
import { computeMatch } from "./engine";

// ─── Match input builders (shared by the matching routes) ───────────────────

export function buildJobMatchInput(
  job: typeof jobsTable.$inferSelect,
  jobSkills: { isRequired: boolean; skillId: number }[],
  skillRecords: { id: number; name: string; category: string }[],
) {
  const skillMap = new Map(skillRecords.map((s) => [s.id, s]));
  return {
    title: job.title,
    description: job.description,
    requiredSkills: jobSkills.filter((s) => s.isRequired).map((s) => {
      const skill = skillMap.get(s.skillId);
      return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
    }),
    preferredSkills: jobSkills.filter((s) => !s.isRequired).map((s) => {
      const skill = skillMap.get(s.skillId);
      return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
    }),
    experienceLevel: job.experienceLevel,
    location: job.location,
    industry: job.industry,
    salaryMin: job.salaryMin || undefined,
    salaryMax: job.salaryMax || undefined,
  };
}

export function buildCandidateMatchInput(candidate: {
  id: string;
  headline: string | null;
  summary: string | null;
  yearsExperience: number | null;
  location: string | null;
  preferences: unknown;
  skills: { proficiency: number; yearsExperience: number | null; skillId: number }[];
  skillRecords: { id: number; name: string; category: string }[];
  education: { degree: string; field: string | null; year: number | null }[];
  experiences: { role: string; company: string; description: string | null; startDate: string | null; endDate: string | null; current: boolean }[];
}) {
  const prefs = (candidate.preferences || {}) as Record<string, unknown>;
  const skillMap = new Map(candidate.skillRecords.map((s) => [s.id, s]));
  const result: MatchInput["candidate"] = {
    id: candidate.id,
    headline: candidate.headline || "",
    summary: candidate.summary || "",
    skills: candidate.skills.map((s) => {
      const skill = skillMap.get(s.skillId);
      return {
        id: s.skillId,
        name: skill?.name || "",
        proficiency: s.proficiency,
        yearsExperience: s.yearsExperience || undefined,
      };
    }),
    yearsExperience: candidate.yearsExperience || 0,
    location: candidate.location || "",
    preferences: {
      industries: (prefs["industries"] as string[]) || [],
      contractTypes: (prefs["contractTypes"] as string[]) || [],
      remote: (prefs["remote"] as boolean) || false,
      salaryMin: prefs["salaryMin"] as number | undefined,
    },
    education: candidate.education.map((e) => ({
      degree: e.degree,
      field: e.field || "",
      year: e.year || 0,
    })),
    experiences: candidate.experiences.map((e) => ({
      role: e.role,
      company: e.company,
      description: e.description || "",
      startDate: e.startDate || "",
      endDate: e.endDate || undefined,
      current: e.current,
    })),
  };
  result.id = candidate.id;
  return result;
}

// ─── Match snapshots ────────────────────────────────────────────────────────
// The matching engine is a pure algorithm, so any surface that shows a score
// (application list, candidate list, seeker submissions) can compute one
// synchronously and persist it — no LLM call ever gates an application.

type StoredBreakdown = NonNullable<typeof matchResultsTable.$inferSelect.breakdown>;

export interface MatchSnapshot {
  overallScore: number;
  breakdown: StoredBreakdown;
  explanation: string;
  /** Flat per-category scores for the applications.match_breakdown column. */
  flatBreakdown: {
    skills: number;
    experience: number;
    education: number;
    culture: number;
    location: number;
    salary: number;
  };
}

/** Computes the engine match for one (job, candidate) pair. Null if either side is gone. */
export async function computeMatchSnapshot(jobId: string, candidateId: string): Promise<MatchSnapshot | null> {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, jobId) });
  if (!job) return null;

  const candidate = await db.query.candidatesTable.findFirst({ where: eq(candidatesTable.id, candidateId) });
  if (!candidate) return null;

  const [jobSkills, candidateSkills, experiences, education] = await Promise.all([
    db.query.jobSkillsTable.findMany({ where: eq(jobSkillsTable.jobId, job.id) }),
    db.query.candidateSkillsTable.findMany({ where: eq(candidateSkillsTable.candidateId, candidate.id) }),
    db.query.experiencesTable.findMany({ where: eq(experiencesTable.candidateId, candidate.id) }),
    db.query.educationTable.findMany({ where: eq(educationTable.candidateId, candidate.id) }),
  ]);

  const skillIds = [...new Set([
    ...jobSkills.map((s) => s.skillId),
    ...candidateSkills.map((s) => s.skillId),
  ])];
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({ where: inArray(skillsTable.id, skillIds) })
    : [];

  const matchInput: MatchInput = {
    job: buildJobMatchInput(job, jobSkills, skillRecords),
    candidate: {
      ...buildCandidateMatchInput({
        ...candidate,
        skills: candidateSkills,
        skillRecords,
        education,
        experiences,
      }),
      id: candidate.id,
    },
  };

  const result = computeMatch(matchInput);
  const breakdown = result.breakdown;

  return {
    overallScore: result.overallScore,
    breakdown,
    explanation: result.explanation,
    flatBreakdown: {
      skills: breakdown.skills.score,
      experience: breakdown.experience.score,
      education: breakdown.education.score,
      culture: breakdown.culture.score,
      location: breakdown.location.score,
      salary: breakdown.salary.score,
    },
  };
}

/** Upserts the snapshot so repeated matches update instead of duplicating. */
export async function persistMatchSnapshot(jobId: string, candidateId: string, snapshot: MatchSnapshot): Promise<void> {
  await db
    .insert(matchResultsTable)
    .values({
      jobId,
      candidateId,
      overallScore: snapshot.overallScore,
      breakdown: snapshot.breakdown,
      explanation: snapshot.explanation,
    })
    .onConflictDoUpdate({
      target: [matchResultsTable.jobId, matchResultsTable.candidateId],
      set: {
        overallScore: snapshot.overallScore,
        breakdown: snapshot.breakdown,
        explanation: snapshot.explanation,
      },
    });
}
