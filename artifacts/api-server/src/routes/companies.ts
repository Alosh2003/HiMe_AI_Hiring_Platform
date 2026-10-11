import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { companiesTable, jobsTable, jobSkillsTable, skillsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";

const router: IRouter = Router();

/**
 * Expands a list of job rows into the shape the frontend expects, with
 * requiredSkills / preferredSkills resolved from the join table.
 */
async function attachSkills<T extends { id: string }>(jobs: T[]) {
  if (jobs.length === 0) return [];

  const links = await db.query.jobSkillsTable.findMany({
    where: inArray(jobSkillsTable.jobId, jobs.map((j) => j.id)),
  });

  const skillIds = [...new Set(links.map((l) => l.skillId))];
  const skillRows = skillIds.length > 0
    ? await db.query.skillsTable.findMany({ where: inArray(skillsTable.id, skillIds) })
    : [];
  const skillMap = new Map(skillRows.map((s) => [s.id, s]));

  const byJob = new Map<string, typeof links>();
  for (const link of links) {
    const list = byJob.get(link.jobId) ?? [];
    list.push(link);
    byJob.set(link.jobId, list);
  }

  return jobs.map((job) => {
    const rows = byJob.get(job.id) ?? [];
    const toSkill = (row: (typeof links)[number]) => ({
      id: row.skillId,
      name: skillMap.get(row.skillId)?.name ?? "",
      category: skillMap.get(row.skillId)?.category ?? "professional",
    });
    return {
      ...job,
      requiredSkills: rows.filter((r) => r.isRequired).map(toSkill),
      preferredSkills: rows.filter((r) => !r.isRequired).map(toSkill),
    };
  });
}

router.get("/", async (_req, res) => {
  const companies = await db.query.companiesTable.findMany({
    orderBy: desc(companiesTable.createdAt),
    limit: 100,
  });

  res.json(companies);
});

router.get("/:id", validateUuidParam("id"), async (req, res) => {
  const companyId = req.params.id as string;

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const jobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.companyId, company.id),
    orderBy: desc(jobsTable.createdAt),
  });

  res.json({ ...company, jobs });
});

router.get("/me/jobs", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(404).json({ error: "Company profile not found" });
    return;
  }

  res.json(await attachSkills(
    await db.query.jobsTable.findMany({
      where: eq(jobsTable.companyId, company.id),
      orderBy: desc(jobsTable.createdAt),
    }),
  ));
});

router.get("/:id/jobs", validateUuidParam("id"), async (req, res) => {
  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, req.params.id as string),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const jobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.companyId, company.id),
    orderBy: desc(jobsTable.createdAt),
  });

  res.json(await attachSkills(jobs));
});

router.get("/me/profile", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(404).json({ error: "Company profile not found" });
    return;
  }

  res.json(company);
});

router.post("/profile", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(200),
    industry: z.string().min(1),
    location: z.string().min(1),
    website: z.string().url().optional(),
    description: z.string().max(2000).optional(),
    employeeCount: z.number().int().positive().optional(),
    foundedYear: z.number().int().min(1800).max(2030).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const existing = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (existing) {
    const updated = await db.update(companiesTable)
      .set(parsed.data)
      .where(eq(companiesTable.id, existing.id))
      .returning();
    res.json(updated[0]);
  } else {
    const created = await db.insert(companiesTable).values({
      userId: req.user!.userId,
      ...parsed.data,
    }).returning();
    res.status(201).json(created[0]);
  }
});

router.patch("/profile", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(200).optional(),
    industry: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    website: z.string().url().optional(),
    description: z.string().max(2000).optional(),
    employeeCount: z.number().int().positive().optional(),
    foundedYear: z.number().int().min(1800).max(2030).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(404).json({ error: "Company profile not found" });
    return;
  }

  const updated = await db.update(companiesTable)
    .set(parsed.data)
    .where(eq(companiesTable.id, company.id))
    .returning();

  res.json(updated[0]);
});

export default router;
