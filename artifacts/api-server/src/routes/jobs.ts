import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { jobsTable, companiesTable, jobSkillsTable, skillsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, verifyToken, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";
import { writeAudit } from "../lib/audit";
import { analyzeJobDescription } from "../ai/llm";
import { alertHighMatchCandidates } from "../ai/match-snapshot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** A date-only deadline ("YYYY-MM-DD") closes applications at the end of that day. */
function deadlineDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T23:59:59.999` : value);
}

const createJobSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  industry: z.string().min(1),
  location: z.string().min(1),
  contractType: z.enum(["full-time", "part-time", "contract", "internship"]).default("full-time"),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]).default("mid"),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  // HTML date inputs send "YYYY-MM-DD"; also accept full ISO datetimes.
  deadline: z.union([z.iso.date(), z.string().datetime()]).optional(),
  requiredSkills: z.array(z.object({ name: z.string(), category: z.string() })).default([]),
  preferredSkills: z.array(z.object({ name: z.string(), category: z.string() })).default([]),
});

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

router.get("/", async (req, res) => {
  const { search, industry, contract, status, page, limit } = req.query;

  // Validate enum + pagination values instead of letting Postgres throw
  const statusSchema = z.enum(["draft", "active", "paused", "closed"]).catch("active");
  const contractSchema = z.enum(["full-time", "part-time", "contract", "internship"]).optional();
  const pageSchema = z.coerce.number().int().min(1).catch(1);
  const limitSchema = z.coerce.number().int().min(1).max(MAX_LIMIT).catch(DEFAULT_LIMIT);

  const statusResult = statusSchema.safeParse(status);
  const parsedStatus: "draft" | "active" | "paused" | "closed" = statusResult.success
    ? statusResult.data
    : "active";
  const contractResult = contractSchema.safeParse(contract);
  const parsedContract = contractResult.success ? contractResult.data : undefined;

  const conditions: SQL[] = [eq(jobsTable.status, parsedStatus)];

  if (search) {
    const searchStr = String(search).slice(0, 200);
    conditions.push(
      sql`(${ilike(jobsTable.title, `%${searchStr}%`)} OR ${ilike(jobsTable.description, `%${searchStr}%`)})`,
    );
  }
  if (industry) {
    conditions.push(eq(jobsTable.industry, String(industry).slice(0, 100)));
  }
  if (parsedContract) {
    conditions.push(eq(jobsTable.contractType, parsedContract));
  }

  // Pagination (parsed before use so the empty-board shortcut below can
  // echo the requested page back).
  const pageResult = pageSchema.safeParse(page);
  const limitResult = limitSchema.safeParse(limit);
  const parsedPage = pageResult.success ? pageResult.data : 1;
  const parsedLimit = limitResult.success ? limitResult.data : DEFAULT_LIMIT;
  const offset = (parsedPage - 1) * parsedLimit;

  // The public board only shows jobs from verified companies. An unverified
  // posting is invisible here no matter its status — otherwise verification
  // would be a badge without a meaning.
  const verifiedCompanies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.verificationStatus, "verified"),
    columns: { id: true },
  });
  const verifiedIds = verifiedCompanies.map((c) => c.id);
  if (verifiedIds.length === 0) {
    res.json({
      jobs: [],
      pagination: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 0, hasNext: false },
    });
    return;
  }
  conditions.push(inArray(jobsTable.companyId, verifiedIds));

  const jobs = await db.query.jobsTable.findMany({
    where: and(...conditions),
    orderBy: desc(jobsTable.createdAt),
    limit: parsedLimit,
    offset,
  });

  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(...conditions));
  const total = Number(totalResult?.count || 0);

  const companyIds = jobs.map((j) => j.companyId);
  const companies = companyIds.length > 0
    ? await db.query.companiesTable.findMany({
        where: inArray(companiesTable.id, companyIds),
      })
    : [];

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const jobsWithSkills = await Promise.all(
    jobs.map(async (job) => {
      const skills = await db.query.jobSkillsTable.findMany({
        where: eq(jobSkillsTable.jobId, job.id),
      });

      const skillIds = skills.map((s) => s.skillId);
      const skillRecords = skillIds.length > 0
        ? await db.query.skillsTable.findMany({
            where: inArray(skillsTable.id, skillIds),
          })
        : [];

      const skillMap = new Map(skillRecords.map((s) => [s.id, s]));

      return {
        ...job,
        company: companyMap.get(job.companyId) || null,
        requiredSkills: skills.filter((s) => s.isRequired).map((s) => {
          const skill = skillMap.get(s.skillId);
          return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
        }),
        preferredSkills: skills.filter((s) => !s.isRequired).map((s) => {
          const skill = skillMap.get(s.skillId);
          return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
        }),
      };
    }),
  );

  res.json({
    jobs: jobsWithSkills,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      hasNext: offset + jobsWithSkills.length < total,
    },
  });
});

router.get("/:id", validateUuidParam("id"), async (req, res) => {
  const jobId = req.params.id as string;

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

  // Unverified postings are invisible on the public board, and that includes
  // direct links — except for the owning company and admins, who need to
  // preview what they wrote. Optional auth: no header means public visitor.
  if (company && company.verificationStatus !== "verified") {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const payload = token ? verifyToken(token) : null;

    const isOwner = payload?.role === "company" && company.userId === payload.userId;
    const isAdmin = payload?.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
  }

  const skills = await db.query.jobSkillsTable.findMany({
    where: eq(jobSkillsTable.jobId, job.id),
  });

  const skillIds = skills.map((s) => s.skillId);
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: inArray(skillsTable.id, skillIds),
      })
    : [];

  const skillMap = new Map(skillRecords.map((s) => [s.id, s]));

  res.json({
    ...job,
    company,
    requiredSkills: skills.filter((s) => s.isRequired).map((s) => {
      const skill = skillMap.get(s.skillId);
      return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
    }),
    preferredSkills: skills.filter((s) => !s.isRequired).map((s) => {
      const skill = skillMap.get(s.skillId);
      return { id: s.skillId, name: skill?.name || "", category: skill?.category || "professional" };
    }),
  });
});

router.post("/", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(400).json({ error: "Company profile not found" });
    return;
  }

  // Only verified companies may publish. This is what gives the admin review
  // queue its meaning — without it, verification would be decorative.
  if (company.verificationStatus !== "verified") {
    res.status(403).json({
      error: "Company verification required",
      message: "Complete your company profile and get verified before posting jobs.",
      verificationStatus: company.verificationStatus,
    });
    return;
  }

  const data = parsed.data;

  const newJob = await db.insert(jobsTable).values({
    companyId: company.id,
    title: data.title,
    description: data.description,
    industry: data.industry,
    location: data.location,
    contractType: data.contractType,
    experienceLevel: data.experienceLevel,
    salaryMin: data.salaryMin,
    salaryMax: data.salaryMax,
    deadline: data.deadline ? deadlineDate(data.deadline) : null,
    status: "active",
  }).returning();

  const allSkills = [
    ...data.requiredSkills.map((s) => ({ ...s, isRequired: true })),
    ...data.preferredSkills.map((s) => ({ ...s, isRequired: false })),
  ];

  for (const skill of allSkills) {
    let skillRecord = await db.query.skillsTable.findFirst({
      where: eq(skillsTable.name, skill.name),
    });

    if (!skillRecord) {
      const inserted = await db.insert(skillsTable).values({
        name: skill.name,
        category: skill.category as "professional" | "technical" | "soft" | "language",
      }).returning();
      skillRecord = inserted[0];
    }

    await db.insert(jobSkillsTable).values({
      jobId: newJob[0].id,
      skillId: skillRecord.id,
      isRequired: skill.isRequired,
    });
  }

  res.status(201).json(newJob[0]);

  await writeAudit({
    actorId: req.user!.userId,
    action: "job.create",
    targetType: "job",
    targetId: newJob[0].id,
    meta: { companyId: company.id, title: data.title },
  });

  // AI enrichment runs after the response: extracting skills from the
  // description takes tens of seconds on a local model, and the poster
  // should not wait for it. Until it lands, the job carries whatever skills
  // were submitted — the matcher degrades gracefully, then gets the rest.
  void mergeAiSkills(
    newJob[0].id,
    data.description,
    new Set(allSkills.map((s) => s.name.toLowerCase())),
  ).catch((err) => logger.error({ err, jobId: newJob[0].id }, "AI skill enrichment failed"));

  // Job alerts: notify opted-in seekers whose profile matches this publish
  // strongly (the "تنبيهات الفرص المطابقة" toggle). Also after the response —
  // up to 50 engine matches, still not something the poster waits for.
  void alertHighMatchCandidates(newJob[0].id);
});

/**
 * Asks the LLM which skills the description implies and links any it finds
 * that the poster did not list. Deduplicates case-insensitively against the
 * skills already attached to the job.
 */
async function mergeAiSkills(
  jobId: string,
  description: string,
  alreadyPresent: Set<string>,
): Promise<void> {
  const analysis = await analyzeJobDescription(description);

  const addSkill = async (rawName: string, isRequired: boolean): Promise<void> => {
    const name = rawName.trim().slice(0, 100);
    if (!name || alreadyPresent.has(name.toLowerCase())) return;

    let record = await db.query.skillsTable.findFirst({ where: eq(skillsTable.name, name) });
    if (!record) {
      const inserted = await db.insert(skillsTable).values({ name, category: "professional" }).returning();
      record = inserted[0];
    }
    await db.insert(jobSkillsTable).values({ jobId, skillId: record.id, isRequired });
    alreadyPresent.add(name.toLowerCase());
  };

  for (const name of (analysis.requiredSkills ?? []).slice(0, 10)) {
    await addSkill(name, true);
  }
  for (const name of (analysis.preferredSkills ?? []).slice(0, 10)) {
    await addSkill(name, false);
  }
}

router.patch("/:id", authMiddleware, requireRole("company"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const jobId = req.params.id as string;

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

  if (company?.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const updateSchema = createJobSchema.partial().safeParse(req.body);
  if (!updateSchema.success) {
    res.status(400).json({ error: "Invalid input", details: updateSchema.error.issues });
    return;
  }

  const { deadline, ...rest } = updateSchema.data;

  const updated = await db.update(jobsTable)
    .set({
      ...rest,
      ...(deadline !== undefined ? { deadline: deadlineDate(deadline) } : {}),
    })
    .where(eq(jobsTable.id, job.id))
    .returning();

  res.json(updated[0]);

  // Re-activating (or editing) a live job re-runs the alert sweep so opted-in
  // seekers hear about it — same fire-and-forget rules as the create path.
  if (updated[0]?.status === "active") {
    void alertHighMatchCandidates(job.id);
  }
});

router.delete("/:id", authMiddleware, requireRole("company", "admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const jobId = req.params.id as string;

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

  if (company?.userId !== req.user!.userId && req.user!.role !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  await db.delete(jobsTable).where(eq(jobsTable.id, job.id));
  res.status(204).send();
});

export default router;
