import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { jobsTable, candidatesTable, jobSkillsTable, candidateSkillsTable, experiencesTable, educationTable, skillsTable, companiesTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { computeMatch, rankCandidates, generateExplanation, type MatchInput } from "../ai";
import { generateMatchExplanation } from "../ai/llm";
import { buildJobMatchInput, buildCandidateMatchInput, computeMatchSnapshot, persistMatchSnapshot } from "../ai/match-snapshot";
import { aiRateLimiter } from "../middleware/rate-limiter";
import { validateUuidParam, validateJobIdBody } from "../middleware/validate-params";

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

router.get("/recommendations", authMiddleware, requireRole("seeker"), aiRateLimiter, async (req: AuthRequest, res) => {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

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

  const candidateInput = buildCandidateMatchInput({
    ...candidate,
    skills: candidateSkills,
    skillRecords: candidateSkillRecords,
    education,
    experiences,
  });

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

export default router;
