import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { companiesTable, jobsTable, usersTable, applicationsTable, candidatesTable } from "@workspace/db/schema";
import { authMiddleware, requireRole } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";

const router: IRouter = Router();

router.get("/stats", authMiddleware, requireRole("admin"), async (_req, res) => {
  const [candidatesCount, companiesCount, jobsCount, applicationsCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(companiesTable),
    db.select({ count: sql<number>`count(*)` }).from(jobsTable),
    db.select({ count: sql<number>`count(*)` }).from(applicationsTable),
  ]);

  res.json({
    candidates: Number(candidatesCount[0]?.count || 0),
    companies: Number(companiesCount[0]?.count || 0),
    jobs: Number(jobsCount[0]?.count || 0),
    applications: Number(applicationsCount[0]?.count || 0),
  });
});

router.post("/companies/:id/verify", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req, res) => {
  const companyId = req.params.id as string;

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({ verified: true, updatedAt: new Date() })
    .where(eq(companiesTable.id, company.id))
    .returning();

  res.json(updated[0]);
});

router.post("/companies/:id/suspend", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req, res) => {
  const companyId = req.params.id as string;

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({ verified: false, updatedAt: new Date() })
    .where(eq(companiesTable.id, company.id))
    .returning();

  res.json(updated[0]);
});

router.delete("/jobs/:id", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req, res) => {
  const jobId = req.params.id as string;

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  await db.delete(jobsTable).where(eq(jobsTable.id, job.id));
  res.status(204).send();
});

router.get("/applications", authMiddleware, requireRole("admin"), async (_req, res) => {
  const applications = await db.query.applicationsTable.findMany({
    orderBy: desc(applicationsTable.appliedAt),
    limit: 100,
  });

  const jobIds = applications.map((a) => a.jobId);
  const candidateIds = applications.map((a) => a.candidateId);

  const jobs = jobIds.length > 0
    ? await db.query.jobsTable.findMany({ where: inArray(jobsTable.id, jobIds) })
    : [];
  const companyIds = jobs.map((j) => j.companyId);
  const companies = companyIds.length > 0
    ? await db.query.companiesTable.findMany({ where: inArray(companiesTable.id, companyIds) })
    : [];
  const candidates = candidateIds.length > 0
    ? await db.query.candidatesTable.findMany({ where: inArray(candidatesTable.id, candidateIds) })
    : [];
  const userIds = candidates.map((c) => c.userId);
  const users = userIds.length > 0
    ? await db.query.usersTable.findMany({ where: inArray(usersTable.id, userIds) })
    : [];

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(applications.map((app) => {
    const job = jobMap.get(app.jobId);
    const candidate = candidateMap.get(app.candidateId);
    return {
      ...app,
      job: job ? { ...job, company: companyMap.get(job.companyId) || null } : null,
      candidate: candidate ? { ...candidate, user: userMap.get(candidate.userId) || null } : null,
    };
  }));
});

export default router;
