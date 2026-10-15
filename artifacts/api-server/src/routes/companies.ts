import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { companiesTable, jobsTable, jobSkillsTable, skillsTable, applicationsTable, usersTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";
import { writeAudit } from "../lib/audit";

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

router.post("/verification/request", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(400).json({ error: "Complete your company profile before requesting verification" });
    return;
  }

  // Company verification must rest on a proven address: an unverified email
  // cannot vouch for a company. This is what makes O2 mean something.
  const owner = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, company.userId),
    columns: { emailVerified: true },
  });
  if (!owner?.emailVerified) {
    res.status(403).json({
      error: "Email verification required",
      message: "Confirm your email address first — check your inbox for the verification link.",
    });
    return;
  }

  // Must actually have the required details filled in.
  const missing: string[] = [];
  if (!company.name?.trim()) missing.push("name");
  if (!company.industry?.trim()) missing.push("industry");
  if (!company.location?.trim()) missing.push("location");
  if (!company.description?.trim() || company.description.trim().length < 20) missing.push("description");

  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}`, missing });
    return;
  }

  if (company.verificationStatus === "pending") {
    res.status(409).json({ error: "Verification already under review" });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({
      verificationStatus: "pending",
      verificationNote: null,
      verificationRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id))
    .returning();

  await writeAudit({
    actorId: req.user!.userId,
    action: "company.verification.request",
    targetType: "company",
    targetId: company.id,
    meta: { name: company.name },
  });

  res.json(updated[0]);
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
    // Editing after a rejection puts the company back in draft so they can
    // fix the problem and resubmit; a pending review is left untouched.
    const reopen = existing.verificationStatus === "rejected"
      ? { verificationStatus: "draft" as const, verificationNote: null }
      : {};

    const updated = await db.update(companiesTable)
      .set({ ...parsed.data, ...reopen, updatedAt: new Date() })
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
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(companiesTable.id, company.id))
    .returning();

  res.json(updated[0]);
});

/**
 * The hiring funnel, computed from real applications. The dashboard used to
 * render fixed numbers ("86 طلباً، متوسط التطابق 88%") that no query ever
 * produced; this endpoint is where those figures come from now.
 */
router.get("/me/funnel", authMiddleware, requireRole("company"), async (req: AuthRequest, res) => {
  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.userId, req.user!.userId),
  });

  if (!company) {
    res.status(404).json({ error: "Company profile not found" });
    return;
  }

  const jobs = await db.query.jobsTable.findMany({
    where: eq(jobsTable.companyId, company.id),
    columns: { id: true, title: true, status: true },
  });

  const jobIds = jobs.map((j) => j.id);
  const applications = jobIds.length > 0
    ? await db.query.applicationsTable.findMany({
        where: inArray(applicationsTable.jobId, jobIds),
        columns: { jobId: true, status: true, matchScore: true },
      })
    : [];

  const statuses = ["applied", "reviewing", "shortlisted", "interview", "rejected", "accepted"] as const;
  const average = (scores: Array<number | null>): number | null => {
    const real = scores.filter((s): s is number => typeof s === "number");
    if (real.length === 0) return null;
    return Math.round(real.reduce((sum, s) => sum + s, 0) / real.length);
  };

  const summarize = (rows: typeof applications) => {
    const counts = Object.fromEntries(statuses.map((s) => [s, rows.filter((r) => r.status === s).length]));
    return { total: rows.length, ...counts, avgMatch: average(rows.map((r) => r.matchScore)) };
  };

  res.json({
    jobs: jobs.map((job) => ({
      jobId: job.id,
      title: job.title,
      status: job.status,
      ...summarize(applications.filter((a) => a.jobId === job.id)),
    })),
    totals: summarize(applications),
  });
});

export default router;
