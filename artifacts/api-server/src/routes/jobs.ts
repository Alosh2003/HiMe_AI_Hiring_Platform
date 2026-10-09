import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { jobsTable, companiesTable, jobSkillsTable, skillsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

const createJobSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  industry: z.string().min(1),
  location: z.string().min(1),
  contractType: z.enum(["full-time", "part-time", "contract", "internship"]).default("full-time"),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]).default("mid"),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
  requiredSkills: z.array(z.object({ name: z.string(), category: z.string() })).default([]),
  preferredSkills: z.array(z.object({ name: z.string(), category: z.string() })).default([]),
});

router.get("/", async (req, res) => {
  const { search, industry, contract, status = "active" } = req.query;

  const conditions: SQL[] = [eq(jobsTable.status, status as "active")];

  if (search) {
    const searchStr = String(search);
    conditions.push(
      sql`(${ilike(jobsTable.title, `%${searchStr}%`)} OR ${ilike(jobsTable.description, `%${searchStr}%`)})`,
    );
  }
  if (industry) {
    conditions.push(eq(jobsTable.industry, String(industry)));
  }
  if (contract) {
    conditions.push(eq(jobsTable.contractType, contract as "full-time"));
  }

  const jobs = await db.query.jobsTable.findMany({
    where: and(...conditions),
    orderBy: desc(jobsTable.createdAt),
    limit: 100,
  });

  const companyIds = jobs.map((j) => j.companyId);
  const companies = companyIds.length > 0
    ? await db.query.companiesTable.findMany({
        where: sql`${companiesTable.id} IN ${sql.raw(`(${companyIds.map(() => "?").join(",")})`)}`,
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
            where: sql`${skillsTable.id} IN ${sql.raw(`(${skillIds.map(() => "?").join(",")})`)}`,
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

  res.json(jobsWithSkills);
});

router.get("/:id", async (req, res) => {
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

  const skills = await db.query.jobSkillsTable.findMany({
    where: eq(jobSkillsTable.jobId, job.id),
  });

  const skillIds = skills.map((s) => s.skillId);
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: sql`${skillsTable.id} IN ${sql.raw(`(${skillIds.map(() => "?").join(",")})`)}`,
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
    deadline: data.deadline ? new Date(data.deadline) : null,
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
});

router.patch("/:id", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
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
      ...(deadline !== undefined ? { deadline: new Date(deadline) } : {}),
    })
    .where(eq(jobsTable.id, job.id))
    .returning();

  res.json(updated[0]);
});

router.delete("/:id", authMiddleware, requireRole("company", "admin"), async (req: AuthRequest, res) => {
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
