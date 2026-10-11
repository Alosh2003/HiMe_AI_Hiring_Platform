import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { companiesTable, jobsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";

const router: IRouter = Router();

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
