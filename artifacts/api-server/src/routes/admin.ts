import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { companiesTable, jobsTable, usersTable, applicationsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole } from "../middleware/auth";

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

router.post("/companies/:id/verify", authMiddleware, requireRole("admin"), async (req, res) => {
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

router.post("/companies/:id/suspend", authMiddleware, requireRole("admin"), async (req, res) => {
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

router.delete("/jobs/:id", authMiddleware, requireRole("admin"), async (req, res) => {
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
    with: {
      job: { with: { company: true } },
      candidate: { with: { user: true } },
    },
    orderBy: desc(applicationsTable.appliedAt),
    limit: 100,
  });

  res.json(applications);
});

export default router;
