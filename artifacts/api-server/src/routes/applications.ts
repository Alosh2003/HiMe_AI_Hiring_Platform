import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { applicationsTable, jobsTable, candidatesTable, matchResultsTable, companiesTable, usersTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";
import { notify } from "../lib/notify";
import { sendEmail } from "../lib/email";
import { getConfig } from "../config/env";

const router: IRouter = Router();

/** Best-effort email to a user's address via the outbox; never throws. */
async function emailUser(
  userId: string,
  kind: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: { email: true },
    });
    if (user) {
      await sendEmail({ to: user.email, kind, subject, body });
    }
  } catch {
    // An email that cannot be sent must not fail the request.
  }
}

router.post("/", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    jobId: z.string().uuid(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(400).json({ error: "Candidate profile not found" });
    return;
  }

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, parsed.data.jobId),
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Unverified postings are not publicly listed, so they cannot receive
  // applications either — a UUID guessed from elsewhere is not an invitation.
  const hiringCompany = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, job.companyId),
    columns: { verificationStatus: true },
  });
  if (!hiringCompany || hiringCompany.verificationStatus !== "verified") {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const existing = await db.query.applicationsTable.findFirst({
    where: and(
      eq(applicationsTable.jobId, parsed.data.jobId),
      eq(applicationsTable.candidateId, candidate.id),
    ),
  });

  if (existing) {
    res.status(409).json({ error: "Already applied to this job" });
    return;
  }

  const application = await db.insert(applicationsTable).values({
    jobId: parsed.data.jobId,
    candidateId: candidate.id,
    status: "applied",
  }).returning();

  await db.update(jobsTable)
    .set({ applicantsCount: sql`${jobsTable.applicantsCount} + 1` })
    .where(eq(jobsTable.id, parsed.data.jobId));

  res.status(201).json(application[0]);

  // Confirmation that the application actually landed — the seeker should
  // not have to guess whether the click registered.
  void emailUser(
    req.user!.userId,
    "application_received",
    `HiMe AI — استلمنا طلبك لوظيفة: ${job.title}`,
    `مرحباً،\n\nاستلمنا طلب التقديم على وظيفة "${job.title}". يمكنك متابعة حالة الطلبات من حسابك:\n${getConfig().FRONTEND_URL}/seeker/applications`,
  );
});

router.get("/my", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const applications = await db.query.applicationsTable.findMany({
    where: eq(applicationsTable.candidateId, candidate.id),
    orderBy: desc(applicationsTable.appliedAt),
  });

  const jobIds = applications.map((a) => a.jobId);
  const jobs = jobIds.length > 0
    ? await db.query.jobsTable.findMany({
        where: inArray(jobsTable.id, jobIds),
      })
    : [];

  const companyIds = jobs.map((j) => j.companyId);
  const companies = companyIds.length > 0
    ? await db.query.companiesTable.findMany({
        where: inArray(companiesTable.id, companyIds),
      })
    : [];

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  res.json(applications.map((app) => {
    const job = jobMap.get(app.jobId);
    return {
      ...app,
      job: job ? { ...job, company: companyMap.get(job.companyId) || null } : null,
    };
  }));
});

router.get("/job/:jobId", authMiddleware, requireRole("company"), validateUuidParam("jobId"), async (req: AuthRequest, res) => {
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

  const applications = await db.query.applicationsTable.findMany({
    where: eq(applicationsTable.jobId, job.id),
    orderBy: desc(applicationsTable.appliedAt),
  });

  const candidateIds = applications.map((a) => a.candidateId);
  const candidates = candidateIds.length > 0
    ? await db.query.candidatesTable.findMany({
        where: inArray(candidatesTable.id, candidateIds),
      })
    : [];

  const matchResults = await db.query.matchResultsTable.findMany({
    where: eq(matchResultsTable.jobId, job.id),
  });

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  const enriched = applications.map((app) => {
    const match = matchResults.find((m) => m.candidateId === app.candidateId);
    return {
      ...app,
      candidate: candidateMap.get(app.candidateId) || null,
      matchScore: match?.overallScore,
      matchBreakdown: match?.breakdown,
      aiExplanation: match?.explanation,
    };
  });

  enriched.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  res.json(enriched);
});

router.patch("/:id", authMiddleware, requireRole("company"), validateUuidParam("id"), async (req: AuthRequest, res) => {
  const applicationId = req.params.id as string;

  const schema = z.object({
    status: z.enum(["applied", "reviewing", "shortlisted", "interview", "rejected", "accepted"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const application = await db.query.applicationsTable.findFirst({
    where: eq(applicationsTable.id, applicationId),
  });

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, application.jobId),
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

  const updated = await db.update(applicationsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(applicationsTable.id, application.id))
    .returning();

  // The seeker should learn about the decision without polling the page.
  if (updated[0] && updated[0].status !== application.status) {
    const candidate = await db.query.candidatesTable.findFirst({
      where: eq(candidatesTable.id, application.candidateId),
      columns: { userId: true },
    });
    if (candidate) {
      const statusLabels: Record<string, string> = {
        applied: "تم استلام طلبك",
        reviewing: "طلبك قيد المراجعة",
        shortlisted: "تم اختيارك ضمن القائمة المختصرة",
        interview: "تمت دعوتك للمقابلة",
        rejected: "للأسف لم يتم قبول طلبك",
        accepted: "تم قبول طلبك",
      };
      await notify({
        userId: candidate.userId,
        type: "application_status",
        title: statusLabels[updated[0].status] ?? "تحديث على طلب التقديم",
        body: `وظيفة: ${job.title}`,
        link: "/seeker/applications",
      });

      // A decision is exactly when silence hurts most: shortlist, interview,
      // rejection and acceptance also land in the outbox.
      const decisionStatuses = ["shortlisted", "interview", "rejected", "accepted"];
      if (decisionStatuses.includes(updated[0].status)) {
        await emailUser(
          candidate.userId,
          "application_status",
          `HiMe AI — ${statusLabels[updated[0].status] ?? "تحديث على طلب التقديم"}`,
          `مرحباً،\n\n${statusLabels[updated[0].status] ?? "حدّثنا حالة طلبك"}\nالوظيفة: ${job.title}\n\n${getConfig().FRONTEND_URL}/seeker/applications`,
        );
      }
    }
  }

  res.json(updated[0]);
});

router.get("/matches/:jobId", authMiddleware, requireRole("company"), validateUuidParam("jobId"), async (req: AuthRequest, res) => {
  const jobId = req.params.jobId as string;

  // Same ownership rule as /job/:jobId: rankings include candidate rows, so
  // another company must not be able to read them with a guessed UUID.
  const job = await db.query.jobsTable.findFirst({
    where: eq(jobsTable.id, jobId),
    columns: { companyId: true },
  });

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const company = await db.query.companiesTable.findFirst({
    where: eq(companiesTable.id, job.companyId),
    columns: { userId: true },
  });

  if (company?.userId !== req.user!.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const matches = await db.query.matchResultsTable.findMany({
    where: eq(matchResultsTable.jobId, jobId),
    orderBy: desc(matchResultsTable.overallScore),
  });

  const candidateIds = matches.map((m) => m.candidateId);
  const candidates = candidateIds.length > 0
    ? await db.query.candidatesTable.findMany({
        where: inArray(candidatesTable.id, candidateIds),
      })
    : [];

  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  res.json(matches.map((m) => ({
    ...m,
    candidate: candidateMap.get(m.candidateId) || null,
  })));
});

export default router;
