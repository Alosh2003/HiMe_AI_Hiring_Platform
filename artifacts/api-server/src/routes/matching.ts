import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { jobsTable, candidatesTable, jobSkillsTable, candidateSkillsTable, experiencesTable, educationTable, skillsTable, companiesTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { computeMatch, rankCandidates, generateExplanation, type MatchInput } from "../ai";
import { generateMatchExplanation, parseJobAdWithLLM, coachMatchWithLLM, listOllamaModels, rateJobFitWithLLM, isLLMAvailable, type JobFitRating } from "../ai/llm";
import { buildJobMatchInput, buildCandidateMatchInput, computeMatchSnapshot, persistMatchSnapshot } from "../ai/match-snapshot";
import { aiRateLimiter } from "../middleware/rate-limiter";
import { validateUuidParam, validateJobIdBody } from "../middleware/validate-params";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/match", authMiddleware, requireRole("company", "seeker"), validateJobIdBody, aiRateLimiter, async (req: AuthRequest, res) => {
  const jobId = req.body.jobId as string;

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const snapshot = await computeMatchSnapshot(job.id, candidate.id);
  if (!snapshot) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  // Try to generate LLM explanation, fallback to rule-based
  let explanation = snapshot.explanation;
  try {
    explanation = await generateMatchExplanation(
      job.title,
      candidate.headline || candidate.id,
      snapshot.overallScore,
      snapshot.breakdown,
    );
  } catch {
    // Use rule-based explanation as fallback
  }

  await persistMatchSnapshot(job.id, candidate.id, { ...snapshot, explanation });

  res.json({ overallScore: snapshot.overallScore, breakdown: snapshot.breakdown, explanation });
});

router.get("/rank/:jobId", authMiddleware, requireRole("company"), validateUuidParam("jobId"), aiRateLimiter, async (req: AuthRequest, res) => {
  const jobId = req.params.jobId as string;

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, job.companyId),
  });

  if (company?.userId !== req.user!.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const jobSkills = await db.query.jobSkillsTable.findMany({
    where: eq(jobSkillsTable.jobId, job.id),
  });

  const skillIds = jobSkills.map((s) => s.skillId);
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: inArray(skillsTable.id, skillIds),
      })
    : [];

  const allCandidates = await db.query.candidatesTable.findMany();

  const candidatesData = await Promise.all(
    allCandidates.map(async (c) => {
      const [cSkills, experiences, education] = await Promise.all([
        db.query.candidateSkillsTable.findMany({
          where: eq(candidateSkillsTable.candidateId, c.id),
        }),
        db.query.experiencesTable.findMany({
          where: eq(experiencesTable.candidateId, c.id),
        }),
        db.query.educationTable.findMany({
          where: eq(educationTable.candidateId, c.id),
        }),
      ]);

      return buildCandidateMatchInput({ ...c, skills: cSkills, skillRecords, education, experiences });
    }),
  );

  const matchInput: MatchInput = {
    job: buildJobMatchInput(job, jobSkills, skillRecords),
    candidate: candidatesData[0]!,
  };

  const ranked = rankCandidates(candidatesData, matchInput.job);

  res.json(
    ranked.map(({ candidate, result }) => ({
      candidate: {
        id: candidate.id,
        name: candidate.headline || candidate.id,
        headline: candidate.headline,
        location: candidate.location,
      },
      match: result,
    })),
  );
});

// ─── Job-ad drafting ─────────────────────────────────────────────────────

const parseJobAdSchema = z.object({
  adText: z.string().max(20_000).optional(),
  position: z.string().max(200).optional(),
  experienceYears: z.number().int().min(0).max(50).optional(),
}).refine((data) => Boolean(data.adText?.trim() || data.position?.trim()), {
  message: "Provide the pasted ad text or a position title",
});

/**
 * Turns a pasted job ad (or a position title + wanted experience) into a
 * fill-in draft for the company's posting wizard. The company reviews and
 * edits every field before publishing — this endpoint writes nothing.
 */
router.post("/parse-job-ad", authMiddleware, requireRole("company"), aiRateLimiter, async (req: AuthRequest, res) => {
  const parsed = parseJobAdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  try {
    const draft = await parseJobAdWithLLM(parsed.data);
    res.json(draft);
  } catch (err) {
    logger.error({ err }, "parse-job-ad failed");
    // Honest failure: the company can always fall back to typing the form.
    res.status(502).json({
      error: "AI draft unavailable",
      message: "تعذر الوصول إلى محرك الذكاء الاصطناعي الآن. أكمل الحقول يدوياً أو حاول لاحقاً.",
    });
  }
});

// ─── Match coaching ────────────────────────────────────────────────────────

/**
 * Turns one job recommendation into an actionable plan: how to gain each
 * missing skill and how to showcase the matched ones on the profile/CV.
 * Read-only — profile edits happen through explicit user actions on the
 * client, never from here.
 */
router.post("/match-coach", authMiddleware, requireRole("seeker"), validateJobIdBody, aiRateLimiter, async (req: AuthRequest, res) => {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });
  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, req.body.jobId as string),
  });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  try {
    const [jobSkillRows, candidateSkillRows, experiences, education] = await Promise.all([
      db.query.jobSkillsTable.findMany({ where: eq(jobSkillsTable.jobId, job.id) }),
      db.query.candidateSkillsTable.findMany({ where: eq(candidateSkillsTable.candidateId, candidate.id) }),
      db.query.experiencesTable.findMany({ where: eq(experiencesTable.candidateId, candidate.id) }),
      db.query.educationTable.findMany({ where: eq(educationTable.candidateId, candidate.id) }),
    ]);

    const allSkillIds = [...new Set([...jobSkillRows, ...candidateSkillRows].map((s) => s.skillId))];
    const skillRecords = allSkillIds.length > 0
      ? await db.query.skillsTable.findMany({ where: inArray(skillsTable.id, allSkillIds) })
      : [];
    const jobSkillRecords = skillRecords.filter((s) => jobSkillRows.some((js) => js.skillId === s.id));
    const candidateSkillRecords = skillRecords.filter((s) => candidateSkillRows.some((cs) => cs.skillId === s.id));

    // The exact computation /recommendations used, so the plan matches the
    // score and gap chips the seeker is looking at.
    const match = computeMatch({
      job: buildJobMatchInput(job, jobSkillRows, jobSkillRecords),
      candidate: buildCandidateMatchInput({
        ...candidate,
        skills: candidateSkillRows,
        skillRecords: candidateSkillRecords,
        education,
        experiences,
      }),
    });

    const coach = await coachMatchWithLLM({
      jobTitle: job.title,
      jobDescription: job.description,
      jobSkills: jobSkillRecords.map((s) => s.name),
      candidateHeadline: candidate.headline ?? "",
      candidateSkills: candidateSkillRecords.map((s) => s.name),
      matchedSkills: match.breakdown.skills.matched,
      missingSkills: match.breakdown.skills.missing,
      experienceRoles: experiences.slice(0, 5).map((e) => `${e.role} @ ${e.company}`),
    });

    res.json(coach);
  } catch (err) {
    logger.error({ err }, "match-coach failed");
    // Honest failure — the seeker keeps the score/chips and can retry later.
    res.status(502).json({
      error: "AI coach unavailable",
      message: "تعذر الوصول إلى مساعد التطوير الذكي الآن. حاول مرة أخرى لاحقاً.",
    });
  }
});

/** Loads a seeker's profile and compiles it into the rule-engine input. */
async function loadCandidateMatchInput(userId: string) {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, userId),
  });
  if (!candidate) return null;

  const [candidateSkills, experiences, education] = await Promise.all([
    db.query.candidateSkillsTable.findMany({
      where: eq(candidateSkillsTable.candidateId, candidate.id),
    }),
    db.query.experiencesTable.findMany({
      where: eq(experiencesTable.candidateId, candidate.id),
    }),
    db.query.educationTable.findMany({
      where: eq(educationTable.candidateId, candidate.id),
    }),
  ]);

  const candidateSkillIds = candidateSkills.map((s) => s.skillId);
  const candidateSkillRecords = candidateSkillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: inArray(skillsTable.id, candidateSkillIds),
      })
    : [];

  return {
    candidate,
    candidateInput: buildCandidateMatchInput({
      ...candidate,
      skills: candidateSkills,
      skillRecords: candidateSkillRecords,
      education,
      experiences,
    }),
  };
}

router.get("/recommendations", authMiddleware, requireRole("seeker"), aiRateLimiter, async (req: AuthRequest, res) => {
  const loaded = await loadCandidateMatchInput(req.user!.userId);
  if (!loaded) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }
  const { candidate, candidateInput } = loaded;

  const activeJobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.status, "active"),
  });

  const companyIds = activeJobs.map((j) => j.companyId);
  const companies = companyIds.length > 0
    ? await db.query.companiesTable.findMany({
        where: inArray(companiesTable.id, companyIds),
      })
    : [];

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const jobsWithSkills = await Promise.all(
    activeJobs.map(async (job) => {
      const skills = await db.query.jobSkillsTable.findMany({
        where: eq(jobSkillsTable.jobId, job.id),
      });

      const sIds = skills.map((s) => s.skillId);
      const sRecords = sIds.length > 0
        ? await db.query.skillsTable.findMany({
            where: inArray(skillsTable.id, sIds),
          })
        : [];

      return { job, jobSkills: skills, skillRecords: sRecords };
    }),
  );

  const matches = jobsWithSkills
    .map(({ job, jobSkills, skillRecords }) => ({
      job: {
        id: job.id,
        title: job.title,
        company: companyMap.get(job.companyId)?.name || "",
        location: job.location,
        match: computeMatch({
          job: buildJobMatchInput(job, jobSkills, skillRecords),
          candidate: candidateInput,
        }),
      },
    }))
    .sort((a, b) => b.job.match.overallScore - a.job.match.overallScore)
    .slice(0, 10);

  res.json(matches);
});

// ─── Jobs-page ranking: sort → rate → order ────────────────────────────────

/**
 * The seeker's jobs page pipeline, built as three explicit stages instead of
 * a single opaque score:
 *
 *   1. Sorting  — the deterministic profile rule engine pre-ranks EVERY
 *      active job from the stored CV/profile (no LLM, instant).
 *   2. Rating   — only the top shortlist goes to the LLM fit raters. Every
 *      model installed on the runtime is asked in parallel and the answers
 *      are averaged, so pulling a second model makes this faster AND more
 *      accurate with zero code changes.
 *   3. Ordering — final placement blends the AI rating with the profile
 *      score so one model's whim can't bury a strong profile match.
 *
 * Jobs that never got an AI rating (past the shortlist, or when rating is
 * unavailable) keep their profile score — nothing is invented.
 */
const RANKING_SHORTLIST = 10;
const RANKING_AI_WEIGHT = 0.6;
const RANKING_PROFILE_WEIGHT = 0.4;

router.get("/jobs-ranking", authMiddleware, requireRole("seeker"), aiRateLimiter, async (req: AuthRequest, res) => {
  const loaded = await loadCandidateMatchInput(req.user!.userId);
  if (!loaded) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }
  const { candidate, candidateInput } = loaded;

  const activeJobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.status, "active"),
  });

  // ── Stage 1 — Sorting (rule engine over every active job) ──
  const stage1 = (
    await Promise.all(
      activeJobs.map(async (job) => {
        const skills = await db.query.jobSkillsTable.findMany({
          where: eq(jobSkillsTable.jobId, job.id),
        });
        const sIds = skills.map((s) => s.skillId);
        const sRecords = sIds.length > 0
          ? await db.query.skillsTable.findMany({
              where: inArray(skillsTable.id, sIds),
            })
          : [];
        return { job, jobSkills: skills, skillRecords: sRecords };
      }),
    )
  )
    .map(({ job, jobSkills, skillRecords }) => {
      const jobInput = buildJobMatchInput(job, jobSkills, skillRecords);
      return {
        jobId: job.id,
        job,
        jobInput,
        jobSkills,
        skillRecords,
        profileScore: computeMatch({ job: jobInput, candidate: candidateInput }).overallScore,
      };
    })
    .sort((a, b) => b.profileScore - a.profileScore);

  const shortlist = stage1.slice(0, RANKING_SHORTLIST);

  // ── Stage 2 — Rating (LLM ensemble over the shortlist, all in parallel) ──
  let models: string[] = [];
  let ratingStatus: "complete" | "partial" | "unavailable" = "complete";
  let ratingError: string | undefined;
  if (!isLLMAvailable()) {
    ratingStatus = "unavailable";
  } else {
    try {
      models = await listOllamaModels();
    } catch (err) {
      ratingStatus = "unavailable";
      ratingError = err instanceof Error ? err.message : String(err);
      logger.warn({ err }, "jobs-ranking: model discovery failed");
    }
  }

  const ratingsByJob = new Map<string, { aiScore: number; modelRatings: Map<string, { rating: number; reason: string }> }>();
  if (ratingStatus !== "unavailable" && shortlist.length > 0) {
    type FitOutcome = { jobId: string; model: string; ok: true; result: JobFitRating } | { jobId: string; model: string; ok: false };
    const pairs = shortlist.flatMap((entry) =>
      models.map((model) => ({ entry, model })),
    );
    const ratings: FitOutcome[] = await Promise.all(
      pairs.map(async ({ entry, model }) => {
        try {
          const result = await rateJobFitWithLLM(
            {
              jobTitle: entry.job.title,
              jobSkills: [
                ...entry.jobInput.requiredSkills.map((s) => s.name),
                ...entry.jobInput.preferredSkills.map((s) => s.name),
              ],
              jobSummary: entry.jobInput.description,
              candidateHeadline: candidateInput.headline,
              candidateSummary: candidateInput.summary,
              candidateSkills: candidateInput.skills.map((s) => s.name),
              candidateYears: candidateInput.yearsExperience ?? null,
            },
            model,
          );
          return { jobId: entry.jobId, model, ok: true as const, result };
        } catch (err) {
          logger.warn({ err, model, jobId: entry.jobId }, "jobs-ranking: fit rating failed");
          return { jobId: entry.jobId, model, ok: false as const };
        }
      }),
    );

    for (const entry of shortlist) {
      const ok = ratings.filter((r): r is Extract<FitOutcome, { ok: true }> => r.jobId === entry.jobId && r.ok);
      if (ok.length === 0) continue;
      const modelRatings = new Map(ok.map((r) => [r.model, { rating: r.result.rating, reason: r.result.reason }]));
      const aiScore = Math.round(
        [...modelRatings.values()].reduce((sum, r) => sum + r.rating, 0) / modelRatings.size,
      );
      ratingsByJob.set(entry.jobId, { aiScore, modelRatings });
    }

    if (ratingsByJob.size === 0) {
      ratingStatus = "unavailable";
      ratingError = "every fit-rating call failed";
    } else if (ratingsByJob.size < shortlist.length) {
      ratingStatus = "partial";
    }
  }

  // ── Stage 3 — Ordering (AI rating leads, profile score anchors) ──
  const jobs = stage1
    .map((entry) => {
      const rating = ratingsByJob.get(entry.jobId) ?? null;
      const aiScore = rating ? rating.aiScore : null;
      const finalScore = aiScore === null
        ? entry.profileScore
        : Math.round(RANKING_AI_WEIGHT * aiScore + RANKING_PROFILE_WEIGHT * entry.profileScore);
      return {
        jobId: entry.jobId,
        profileScore: entry.profileScore,
        aiScore,
        finalScore,
        modelRatings: rating ? Object.fromEntries(rating.modelRatings) : null,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  res.json({
    stages: {
      sorting: { engine: "profile-rule-engine", evaluated: stage1.length },
      rating: {
        status: ratingStatus,
        models,
        requested: shortlist.length,
        rated: ratingsByJob.size,
        ...(ratingError ? { error: ratingError } : {}),
      },
      ordering: {
        basis: `${Math.round(RANKING_AI_WEIGHT * 100)}% AI rating + ${Math.round(RANKING_PROFILE_WEIGHT * 100)}% profile score`,
      },
    },
    jobs,
  });
});

export default router;
