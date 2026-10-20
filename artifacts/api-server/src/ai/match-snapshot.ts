import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  applicationsTable,
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
import { calculateProfileCompletion } from "./llm";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";

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

// ─── Candidate reassessment ────────────────────────────────────────────────

export interface ReassessmentResult {
  /** The recomputed profile-completion percentage. */
  completion: number;
  /** How many stored match scores were refreshed. */
  reassessedMatches: number;
  /** Scores that actually moved, so the UI can say what changed. */
  changedMatches: number;
}

/**
 * Re-runs the whole assessment for one candidate after their profile changes.
 *
 * Two things go stale the moment a seeker edits their profile:
 *  1. `candidates.completion` — previously only recomputed on CV upload.
 *  2. Every stored match score (applications.match_score + the shared
 *     match_results table) — previously frozen at application time, so a
 *     company reading the candidate list saw yesterday's number.
 *
 * Both are recomputed here from the current profile. Pure algorithm — no LLM
 * call — so this is cheap enough to run inline on every profile mutation.
 * The stored LLM explanation is kept when the score did not move; when it
 * did, the engine's fresh rule-based explanation replaces it (honest beats
 * stale-prose).
 */
export async function reassessCandidate(candidateId: string): Promise<ReassessmentResult> {
  const completion = await calculateProfileCompletion(candidateId);
  await db
    .update(candidatesTable)
    .set({ completion, updatedAt: new Date() })
    .where(eq(candidatesTable.id, candidateId));

  const applications = await db.query.applicationsTable.findMany({
    where: eq(applicationsTable.candidateId, candidateId),
    orderBy: desc(applicationsTable.appliedAt),
  });

  let changed = 0;
  for (const app of applications) {
    const snapshot = await computeMatchSnapshot(app.jobId, candidateId);
    if (!snapshot) continue; // job was deleted — nothing to score against

    await persistMatchSnapshot(app.jobId, candidateId, snapshot);
    await db
      .update(applicationsTable)
      .set({
        matchScore: snapshot.overallScore,
        matchBreakdown: snapshot.flatBreakdown,
        // Keep a previous LLM explanation only while it still describes the
        // stored score; a moved score must not carry the old prose.
        aiExplanation:
          app.matchScore === snapshot.overallScore && app.aiExplanation
            ? app.aiExplanation
            : snapshot.explanation,
        updatedAt: new Date(),
      })
      .where(eq(applicationsTable.id, app.id));

    if (app.matchScore !== snapshot.overallScore) changed += 1;
  }

  return { completion, reassessedMatches: applications.length, changedMatches: changed };
}

// ─── Job alerts ────────────────────────────────────────────────────────────

/**
 * Notifies seekers whose profile matches a newly active job at or above the
 * threshold — the engine behind the profile's "job alerts" toggle. Pure
 * engine (no LLM), bounded to the most recent opted-in candidates so a
 * publish never becomes a full-table scan, and never throws: a failed alert
 * sweep must not fail the request that published the job.
 */
export async function alertHighMatchCandidates(jobId: string, threshold = 80, limit = 50): Promise<number> {
  try {
    const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, jobId) });
    if (!job || job.status !== "active") return 0;

    const candidates = await db.query.candidatesTable.findMany({
      where: eq(candidatesTable.jobAlerts, true),
      orderBy: desc(candidatesTable.createdAt),
      limit,
    });

    let notified = 0;
    for (const candidate of candidates) {
      const snapshot = await computeMatchSnapshot(jobId, candidate.id);
      if (!snapshot || snapshot.overallScore < threshold) continue;
      await notify({
        userId: candidate.userId,
        type: "job-alert",
        title: `وظيفة جديدة تطابق ملفك ${snapshot.overallScore}%`,
        body: job.title,
        link: `/jobs/${job.id}`,
      });
      notified += 1;
    }
    return notified;
  } catch (err) {
    logger.error({ err, jobId }, "Job alert sweep failed");
    return 0;
  }
}
