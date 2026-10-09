import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { jobsTable, candidatesTable, jobSkillsTable, candidateSkillsTable, experiencesTable, educationTable, matchResultsTable, skillsTable, companiesTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { computeMatch, rankCandidates, type MatchInput } from "../ai";

const router: IRouter = Router();

function buildJobMatchInput(
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

function buildCandidateMatchInput(candidate: {
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

router.post("/match", authMiddleware, requireRole("company", "seeker"), async (req: AuthRequest, res) => {
  const jobId = req.body.jobId as string;

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const jobSkills = await db.query.jobSkillsTable.findMany({
    where: eq(jobSkillsTable.jobId, job.id),
  });

  const skillIds = jobSkills.map((s) => s.skillId);
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: sql`${skillsTable.id} IN ${sql.raw(`(${skillIds.map(() => "?").join(",")})`)}`,
      })
    : [];

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

  const candidateInput = buildCandidateMatchInput({
    ...candidate,
    skills: candidateSkills,
    skillRecords,
    education,
    experiences,
  });

  const matchInput: MatchInput = {
    job: buildJobMatchInput(job, jobSkills, skillRecords),
    candidate: { ...candidateInput, id: candidate.id },
  };

  const result = computeMatch(matchInput);

  await db.insert(matchResultsTable).values({
    jobId: job.id,
    candidateId: candidate.id,
    overallScore: result.overallScore,
    breakdown: result.breakdown,
    explanation: result.explanation,
  });

  res.json(result);
});

router.get("/rank/:jobId", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
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
        where: sql`${skillsTable.id} IN ${sql.raw(`(${skillIds.map(() => "?").join(",")})`)}`,
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

router.get("/recommendations", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
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
        where: sql`${skillsTable.id} IN ${sql.raw(`(${candidateSkillIds.map(() => "?").join(",")})`)}`,
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
        where: sql`${companiesTable.id} IN ${sql.raw(`(${companyIds.map(() => "?").join(",")})`)}`,
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
            where: sql`${skillsTable.id} IN ${sql.raw(`(${sIds.map(() => "?").join(",")})`)}`,
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
