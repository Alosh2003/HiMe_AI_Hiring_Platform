import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { companiesTable, jobsTable, usersTable, applicationsTable, candidatesTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";
import { writeAudit } from "../lib/audit";
import { notify } from "../lib/notify";
import { sendEmail } from "../lib/email";
import { getConfig } from "../config/env";

const router: IRouter = Router();

/**
 * Delivers a verification outcome both ways: an in-app notification (which
 * the bell renders) and an email in the outbox. Both are best-effort.
 */
async function notifyAndEmailCompany(
  companyUserId: string,
  note: { type: string; title: string; body: string; link: string },
  email: { subject: string; body: string },
): Promise<void> {
  await notify({ userId: companyUserId, ...note });
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, companyUserId),
    columns: { email: true },
  });
  if (user) {
    await sendEmail({ to: user.email, kind: note.type, subject: email.subject, body: email.body });
  }
}

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

router.get("/companies", authMiddleware, requireRole("admin"), async (req, res) => {
  const { status } = req.query;

  const conditions = status
    ? [eq(companiesTable.verificationStatus, z.enum(["draft", "pending", "verified", "rejected"]).catch("pending").parse(status))]
    : [];

  // Offset pagination with real metadata — the previous hard caps (200
  // rows, no totals) made the queue unusable past a few hundred companies.
  const page = z.coerce.number().int().min(1).catch(1).parse(req.query.page);
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [companies, totalRows] = await Promise.all([
    db.query.companiesTable.findMany({
      where,
      orderBy: desc(companiesTable.createdAt),
      limit,
      offset: (page - 1) * limit,
    }),
    db.select({ value: count() }).from(companiesTable).where(where),
  ]);

  const userIds = companies.map((c) => c.userId);
  const users = userIds.length > 0
    ? await db.query.usersTable.findMany({ where: inArray(usersTable.id, userIds) })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const total = Number(totalRows[0]?.value || 0);
  res.json({
    items: companies.map((c) => ({
      ...c,
      contact: userMap.get(c.userId) ? { name: userMap.get(c.userId)!.name, email: userMap.get(c.userId)!.email } : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post("/companies/:id/verify", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const companyId = req.params.id as string;

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (company.verificationStatus !== "pending") {
    res.status(409).json({ error: `Cannot verify a company that is "${company.verificationStatus}"` });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({
      verified: true,
      verificationStatus: "verified",
      verificationNote: null,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id))
    .returning();

  await writeAudit({
    actorId: req.user!.userId,
    action: "company.verify",
    targetType: "company",
    targetId: company.id,
    meta: { name: company.name },
  });

  await notifyAndEmailCompany(company.userId, {
    type: "company_verified",
    title: "تم التحقق من شركتك",
    body: "يمكنك الآن نشر الوظائف واستقبال طلبات التقديم.",
    link: "/company/jobs/new",
  }, {
    subject: "HiMe AI — تم التحقق من شركتك",
    body: `مرحباً،\n\nتم اعتماد بيانات "${company.name}" من قبل إدارة المنصة. يمكنك الآن نشر الوظائف.\n\n${getConfig().FRONTEND_URL}/company/dashboard`,
  });

  res.json(updated[0]);
});

router.post("/companies/:id/reject", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const companyId = req.params.id as string;

  const parsed = z.object({ reason: z.string().min(5).max(1000) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A rejection reason (5-1000 chars) is required" });
    return;
  }

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (company.verificationStatus !== "pending") {
    res.status(409).json({ error: `Cannot reject a company that is "${company.verificationStatus}"` });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({
      verified: false,
      verificationStatus: "rejected",
      verificationNote: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id))
    .returning();

  await writeAudit({
    actorId: req.user!.userId,
    action: "company.reject",
    targetType: "company",
    targetId: company.id,
    meta: { name: company.name, reason: parsed.data.reason },
  });

  await notifyAndEmailCompany(company.userId, {
    type: "company_rejected",
    title: "تم رفض طلب التحقق",
    body: parsed.data.reason,
    link: "/company/profile",
  }, {
    subject: "HiMe AI — نتيجة طلب التحقق",
    body: `مرحباً،\n\nللأسف لم يتم اعتماد "${company.name}".\nالسبب: ${parsed.data.reason}\n\nيمكنك تعديل البيانات وإعادة الطلب:\n${getConfig().FRONTEND_URL}/company/profile`,
  });

  res.json(updated[0]);
});

router.post("/companies/:id/suspend", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const companyId = req.params.id as string;

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, companyId),
  });

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const updated = await db.update(companiesTable)
    .set({
      verified: false,
      verificationStatus: "rejected",
      verificationNote: "تم إيقاف الشركة من قبل إدارة المنصة.",
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id))
    .returning();

  await writeAudit({
    actorId: req.user!.userId,
    action: "company.suspend",
    targetType: "company",
    targetId: company.id,
    meta: { name: company.name },
  });

  await notifyAndEmailCompany(company.userId, {
    type: "company_suspended",
    title: "تم إيقاف الشركة",
    body: "تم إيقاف الشركة من قبل إدارة المنصة. تواصل مع الإدارة للمزيد.",
    link: "/company/profile",
  }, {
    subject: "HiMe AI — إيقاف الشركة",
    body: `مرحباً،\n\nتم إيقاف "${company.name}" من قبل إدارة المنصة. تواصل مع الإدارة للمزيد.\n\n${getConfig().FRONTEND_URL}/company/profile`,
  });

  res.json(updated[0]);
});

router.delete("/jobs/:id", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const jobId = req.params.id as string;

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  await db.delete(jobsTable).where(eq(jobsTable.id, job.id));

  await writeAudit({
    actorId: req.user!.userId,
    action: "job.delete",
    targetType: "job",
    targetId: job.id,
    meta: { title: job.title, companyId: job.companyId },
  });

  res.status(204).send();
});

router.get("/applications", authMiddleware, requireRole("admin"), async (req, res) => {
  const page = z.coerce.number().int().min(1).catch(1).parse(req.query.page);
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);

  const [applications, totalRows] = await Promise.all([
    db.query.applicationsTable.findMany({
      orderBy: desc(applicationsTable.appliedAt),
      limit,
      offset: (page - 1) * limit,
    }),
    db.select({ value: count() }).from(applicationsTable),
  ]);

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

  const total = Number(totalRows[0]?.value || 0);
  res.json({
    items: applications.map((app) => {
      const job = jobMap.get(app.jobId);
      const candidate = candidateMap.get(app.candidateId);
      return {
        ...app,
        job: job ? { ...job, company: companyMap.get(job.companyId) || null } : null,
        candidate: candidate ? { ...candidate, user: userMap.get(candidate.userId) || null } : null,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * Admin-initiated password reset — the auditable fallback for O7 when no
 * mail flow applies (e.g. a locked-out founder). The new password is shown
 * once to the admin and emailed to the user through the outbox.
 */
router.post("/users/:id/password", authMiddleware, requireRole("admin"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const userId = req.params.id as string;

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const parsed = z.object({ password: z.string().min(8).max(100) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A new password (8-100 chars) is required" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await writeAudit({
    actorId: req.user!.userId,
    action: "user.password.reset",
    targetType: "user",
    targetId: user.id,
    meta: { email: user.email },
  });

  await notifyAndEmail(user.id, {
    type: "password_reset",
    title: "تمت إعادة تعيين كلمة المرور",
    body: "أعادت إدارة المنصة تعيين كلمة المرور. استخدم كلمة المرور الجديدة لتسجيل الدخول.",
  }, {
    subject: "HiMe AI — إعادة تعيين كلمة المرور",
    body: `مرحباً ${user.name}،\n\nأعادت إدارة المنصة تعيين كلمة المرور لحسابك. يمكنك تسجيل الدخول بكلمة المرور الجديدة التي استلمتها من الإدارة.\n\nإذا لم تطلب هذا، فتواصل مع الإدارة فوراً.`,
  });

  res.json({ ok: true });
});

/** In-app notification plus outbox email; both best-effort. */
async function notifyAndEmail(
  userId: string,
  note: { type: string; title: string; body: string },
  email: { subject: string; body: string },
): Promise<void> {
  await notify({ userId, ...note, link: "/login" });
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    columns: { email: true },
  });
  if (user) {
    await sendEmail({ to: user.email, kind: note.type, subject: email.subject, body: email.body });
  }
}

export default router;
