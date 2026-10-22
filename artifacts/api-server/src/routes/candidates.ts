import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { candidatesTable, experiencesTable, educationTable, projectsTable, certificationsTable, candidateSkillsTable, skillsTable, usersTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { validateUuidParam } from "../middleware/validate-params";
import { logger } from "../lib/logger";
import { parseCvText } from "../ai/cv-parser";
import { generateSummaryWithLLM, deriveHeadlineWithLLM } from "../ai/llm";
import { reassessCandidate } from "../ai/match-snapshot";
import { saveFile, deleteFile, getFile } from "../services/file-storage";
import { parseDocument } from "../services/document-parser";

/** Trim a value and treat "N/A"-style placeholders from the model as absent. */
function cleanField(value: string | null | undefined): string | null {
  const v = value?.trim() ?? "";
  return v === "" || /^(n\/?a|none|null|undefined|-|\?+)$/i.test(v) ? null : v;
}

/** Drop repeats — models sometimes re-emit a line that appears twice (or an exact duplicate) in the CV. */
function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row).trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A year column: accept a number or a numeric string, else absent. */
function toYear(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 1900 && n < 2200 ? n : null;
}

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, DOCX, TXT"));
    }
  },
});

/** Profile photos: images only, far smaller than a CV. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (PHOTO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. المسموح: JPG أو PNG أو WebP"));
    }
  },
});

/**
 * The frontend's CandidateProfile contract expects a `cvStatus` the table
 * doesn't store — derive it: parsed data means analyzed, a stored file
 * without parsed data means the analysis failed (parsing happens inline on
 * upload), no file means missing.
 */
function cvStatusOf(candidate: { cvUrl: string | null; cvParsedData: unknown }): "analyzed" | "failed" | "missing" {
  if (candidate.cvParsedData) return "analyzed";
  if (candidate.cvUrl) return "failed";
  return "missing";
}

router.get("/profile", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const account = await db.query.usersTable.findFirst({
    columns: { phone: true, avatarUrl: true },
    where: eq(usersTable.id, req.user!.userId),
  });

  const [skills, experiences, education, projects, certifications] = await Promise.all([
    db.query.candidateSkillsTable.findMany({
      where: eq(candidateSkillsTable.candidateId, candidate.id),
    }),
    db.query.experiencesTable.findMany({
      where: eq(experiencesTable.candidateId, candidate.id),
      orderBy: desc(experiencesTable.startDate),
    }),
    db.query.educationTable.findMany({
      where: eq(educationTable.candidateId, candidate.id),
    }),
    db.query.projectsTable.findMany({
      where: eq(projectsTable.candidateId, candidate.id),
    }),
    db.query.certificationsTable.findMany({
      where: eq(certificationsTable.candidateId, candidate.id),
    }),
  ]);

  const skillIds = skills.map((s) => s.skillId);
  const skillRecords = skillIds.length > 0
    ? await db.query.skillsTable.findMany({
        where: inArray(skillsTable.id, skillIds),
      })
    : [];

  const skillMap = new Map(skillRecords.map((s) => [s.id, s]));

  res.json({
    ...candidate,
    phone: account?.phone ?? null,
    avatarUrl: account?.avatarUrl ?? null,
    cvStatus: cvStatusOf(candidate),
    skills: skills.map((s) => {
      const skill = skillMap.get(s.skillId);
      return {
        id: s.skillId,
        name: skill?.name || "",
        category: skill?.category || "professional",
        proficiency: s.proficiency,
        yearsExperience: s.yearsExperience,
      };
    }),
    experiences,
    education,
    projects,
    certifications,
  });
});

router.patch("/profile", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  // The profile form round-trips exactly what GET returned, and every one of
  // these columns is nullable — `null` means "cleared". Zod's `.optional()`
  // alone accepts `undefined` only, so a fresh account (NULL headline,
  // summary, location, years_experience) used to 400 its own save.
  const updateSchema = z.object({
    headline: z.string().max(200).nullish(),
    summary: z.string().max(2000).nullish(),
    location: z.string().max(200).nullish(),
    yearsExperience: z.number().int().min(0).max(50).nullish(),
    phone: z.string().max(30).nullish(),
    // Account-level fields: the profile page owns the seeker's whole record,
    // so the name and email are editable here too (an email change is
    // un-verified and must not collide with another account).
    name: z.string().trim().min(2).max(120).nullish(),
    email: z.string().trim().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "بريد إلكتروني غير صالح").nullish(),
    visibleToCompanies: z.boolean().nullish(),
    jobAlerts: z.boolean().nullish(),
    preferences: z.object({
      industries: z.array(z.string()).optional(),
      contractTypes: z.array(z.string()).optional(),
      remote: z.boolean().optional(),
      salaryMin: z.number().int().positive().optional(),
    }).nullish(),
    skills: z.array(z.object({
      name: z.string(),
      category: z.string().nullish(),
      proficiency: z.number().int().min(1).max(5).nullish(),
      yearsExperience: z.number().int().min(0).nullish(),
    })).optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      message: `حقول غير صالحة: ${parsed.error.issues.map((issue) => issue.path.join(".") || "body").join(", ")}`,
      details: parsed.error.issues,
    });
    return;
  }

  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const { skills, preferences, phone, name, email, ...profileData } = parsed.data;

  const updateData: Record<string, unknown> = { ...profileData };
  if (preferences) {
    updateData.preferences = {
      industries: preferences.industries || [],
      contractTypes: preferences.contractTypes || [],
      remote: preferences.remote || false,
      salaryMin: preferences.salaryMin,
    };
  }

  // A skills-only or phone-only save leaves nothing to update here — an
  // empty .set() makes drizzle throw, so skip the row update entirely.
  let saved = candidate;
  if (Object.keys(updateData).length > 0) {
    const updated = await db.update(candidatesTable)
      .set(updateData)
      .where(eq(candidatesTable.id, candidate.id))
      .returning();
    saved = updated[0] ?? candidate;
  }

  // Name and email live on the account row. An email change also flips the
  // account back to unverified — the old address proved nothing about the
  // new one — and a duplicate address is refused with an honest 409.
  const accountPatch: Record<string, unknown> = {};
  if (name !== undefined || email !== undefined) {
    const account = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.user!.userId),
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    if (name !== undefined && name !== null && name !== account.name) {
      accountPatch["name"] = name;
    }
    if (email !== undefined && email !== null) {
      const lower = email.toLowerCase();
      if (lower !== account.email.toLowerCase()) {
        const taken = await db.query.usersTable.findFirst({
          where: and(eq(usersTable.email, lower), ne(usersTable.id, account.id)),
        });
        if (taken) {
          res.status(409).json({ error: "هذا البريد الإلكتروني مستخدم في حساب آخر." });
          return;
        }
        accountPatch["email"] = lower;
        accountPatch["emailVerified"] = false;
      }
    }
  }
  if (Object.keys(accountPatch).length > 0) {
    await db.update(usersTable)
      .set({ ...accountPatch, updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.userId));
  }

  // The phone number lives on the account row, not the candidate profile —
  // the form edits it, so an absent (undefined) value must leave it alone
  // while an explicit null clears it.
  if (phone !== undefined) {
    await db.update(usersTable)
      .set({ phone })
      .where(eq(usersTable.id, req.user!.userId));
  }

  if (skills) {
    await db.delete(candidateSkillsTable).where(eq(candidateSkillsTable.candidateId, candidate.id));

    for (const skill of skills) {
      let skillRecord = await db.query.skillsTable.findFirst({
        where: eq(skillsTable.name, skill.name),
      });

      if (!skillRecord) {
        const inserted = await db.insert(skillsTable).values({
          name: skill.name,
          category: (skill.category ?? "professional") as "professional" | "technical" | "soft" | "language",
        }).returning();
        skillRecord = inserted[0];
      }

      await db.insert(candidateSkillsTable).values({
        candidateId: candidate.id,
        skillId: skillRecord.id,
        // proficiency is NOT NULL — a null (cleared) row falls back to the
        // table's default of 3 instead of failing the whole save.
        proficiency: skill.proficiency ?? 3,
        yearsExperience: skill.yearsExperience ?? null,
      });
    }
  }

  // Reassessment: the profile the engine scores just changed, so recompute
  // the completion percentage and every stored match score now — a company
  // opening the candidate list must see numbers that match this profile,
  // not the one that existed when the seeker last applied.
  const assessment = await reassessCandidate(candidate.id);
  const fresh = { ...saved, completion: assessment.completion };

  // When the account row changed, echo the new identity back so the client
  // can refresh the session (header name/avatar) without a re-login.
  const account = Object.keys(accountPatch).length > 0
    ? await db.query.usersTable.findFirst({
        columns: { name: true, email: true },
        where: eq(usersTable.id, req.user!.userId),
      })
    : undefined;

  res.json({
    ...fresh,
    ...(account ?? {}),
    cvStatus: cvStatusOf(fresh),
    reassessment: {
      completion: assessment.completion,
      reassessedMatches: assessment.reassessedMatches,
      changedMatches: assessment.changedMatches,
    },
  });
});

router.post("/experience", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    role: z.string().min(2),
    company: z.string().min(2),
    location: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
    current: z.boolean().default(false),
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
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const newExp = await db.insert(experiencesTable).values({
    candidateId: candidate.id,
    ...parsed.data,
  }).returning();

  // A new experience changes both the completion percentage and every stored
  // match score — reassess immediately so companies see the updated profile.
  const assessment = await reassessCandidate(candidate.id);

  res.status(201).json({
    ...newExp[0],
    completion: assessment.completion,
    reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
  });
});

router.post("/education", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    degree: z.string().min(2),
    field: z.string().optional(),
    institution: z.string().min(2),
    year: z.number().int().min(1950).max(2100),
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
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const newEdu = await db.insert(educationTable).values({
    candidateId: candidate.id,
    ...parsed.data,
  }).returning();

  const assessment = await reassessCandidate(candidate.id);

  res.status(201).json({
    ...newEdu[0],
    completion: assessment.completion,
    reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
  });
});

router.post("/project", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    url: z.string().max(500).optional(),
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
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const created = await db.insert(projectsTable).values({
    candidateId: candidate.id,
    ...parsed.data,
  }).returning();

  const assessment = await reassessCandidate(candidate.id);

  res.status(201).json({
    ...created[0],
    completion: assessment.completion,
    reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
  });
});

router.post("/certification", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).max(200),
    issuer: z.string().max(200).optional(),
    year: z.number().int().min(1950).max(2100).optional(),
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
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const created = await db.insert(certificationsTable).values({
    candidateId: candidate.id,
    ...parsed.data,
  }).returning();

  const assessment = await reassessCandidate(candidate.id);

  res.status(201).json({
    ...created[0],
    completion: assessment.completion,
    reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
  });
});

// ─── Section item editing (PUT / DELETE) ───────────────────────────────────
// Every item a seeker adds must also be editable and removable — an add-only
// profile locks mistakes in forever. Ownership is enforced (items are matched
// by id AND the caller's own candidate id) and every mutation re-runs the
// same assessment a save does.

const experienceSchema = z.object({
  role: z.string().min(2),
  company: z.string().min(2),
  location: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
});
const educationSchema = z.object({
  degree: z.string().min(2),
  field: z.string().optional(),
  institution: z.string().min(2),
  year: z.number().int().min(1950).max(2100),
});
const projectSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
});
const certificationSchema = z.object({
  name: z.string().min(2).max(200),
  issuer: z.string().max(200).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
});

type SectionTable = typeof experiencesTable | typeof educationTable | typeof projectsTable | typeof certificationsTable;

function registerSectionCrud<TSchema extends z.ZodType>(kind: string, table: SectionTable, schema: TSchema) {
  router.put(`/${kind}/:id`, authMiddleware, requireRole("seeker"), validateUuidParam("id"), async (req: AuthRequest, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const candidate = await db.query.candidatesTable.findFirst({
      where: eq(candidatesTable.userId, req.user!.userId),
    });
    if (!candidate) {
      res.status(404).json({ error: "Candidate profile not found" });
      return;
    }

    const id = String(req.params["id"]);
    const updated = await db.update(table)
      .set(parsed.data as Record<string, unknown>)
      .where(and(eq(table.id, id), eq(table.candidateId, candidate.id)))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "العنصر غير موجود — ربما حُذف سابقاً." });
      return;
    }

    const assessment = await reassessCandidate(candidate.id);
    res.json({
      ...updated[0],
      completion: assessment.completion,
      reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
    });
  });

  router.delete(`/${kind}/:id`, authMiddleware, requireRole("seeker"), validateUuidParam("id"), async (req: AuthRequest, res) => {
    const candidate = await db.query.candidatesTable.findFirst({
      where: eq(candidatesTable.userId, req.user!.userId),
    });
    if (!candidate) {
      res.status(404).json({ error: "Candidate profile not found" });
      return;
    }

    const id = String(req.params["id"]);
    const removed = await db.delete(table)
      .where(and(eq(table.id, id), eq(table.candidateId, candidate.id)))
      .returning({ id: table.id });

    if (removed.length === 0) {
      res.status(404).json({ error: "العنصر غير موجود — ربما حُذف سابقاً." });
      return;
    }

    // A deletion moves completion and every stored match score — same
    // reassessment as a save, and the UI needs the numbers to show it.
    const assessment = await reassessCandidate(candidate.id);
    res.json({
      deleted: true,
      completion: assessment.completion,
      reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
    });
  });
}

registerSectionCrud("experience", experiencesTable, experienceSchema);
registerSectionCrud("education", educationTable, educationSchema);
registerSectionCrud("project", projectsTable, projectSchema);
registerSectionCrud("certification", certificationsTable, certificationSchema);

/**
 * Uploads a profile photo.
 *
 * The file lands in the shared upload dir but is served through the public
 * /api/avatars route (an <img> tag cannot send an Authorization header).
 * The extension is derived from the validated mime type — never from the
 * client-supplied file name.
 */
router.post("/photo", authMiddleware, requireRole("seeker"), (req, res, next) => {
  photoUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "الصورة أكبر من 5 ميغابايت."
        : err instanceof Error
          ? err.message
          : "تعذر رفع الصورة.";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "لم يتم إرفاق صورة." });
    return;
  }

  const previous = await db.query.usersTable.findFirst({
    columns: { avatarUrl: true },
    where: eq(usersTable.id, req.user!.userId),
  });

  const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
  const stored = await saveFile(file.buffer, `avatar.${ext}`, file.mimetype);
  const avatarUrl = `/api/avatars/${stored.fileName}`;

  await db.update(usersTable)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.userId));

  // Best-effort cleanup of the replaced photo.
  if (previous?.avatarUrl) {
    await deleteFile(path.basename(previous.avatarUrl));
  }

  res.status(201).json({ avatarUrl });
});

router.delete("/photo", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const previous = await db.query.usersTable.findFirst({
    columns: { avatarUrl: true },
    where: eq(usersTable.id, req.user!.userId),
  });

  await db.update(usersTable)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.userId));

  if (previous?.avatarUrl) {
    await deleteFile(path.basename(previous.avatarUrl));
  }

  res.status(204).end();
});

// ─── CV Upload with real file parsing ─────────────────────────────────────

router.post("/cv", authMiddleware, requireRole("seeker"), upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const candidate = await db.query.candidatesTable.findFirst({
      where: eq(candidatesTable.userId, req.user!.userId),
    });

    if (!candidate) {
      res.status(404).json({ error: "Candidate profile not found" });
      return;
    }

    // Handle file upload
    if (req.file) {
      const { buffer, originalname, mimetype, size } = req.file;

      // Save file to local storage
      const storedFile = await saveFile(buffer, originalname, mimetype);

      // Parse document text
      const cvText = await parseDocument(buffer, mimetype);

      // Parse with LLM
      let parsedData: {
        headline?: string;
        summary?: string;
        skills?: string[];
        experiences?: { role: string; company: string; location?: string; description: string; startDate?: string; endDate?: string }[];
        education?: { degree: string; field?: string; institution?: string; year?: number }[];
        projects?: { name: string; description?: string; url?: string }[];
        certifications?: { name: string; issuer?: string; year?: number }[];
      } | undefined;
      let parseError: string | undefined;
      /** True when the AI wrote a professional summary the CV itself lacked. */
      let summaryGenerated = false;

      if (cvText) {
        try {
          const llmResult = await parseCvText(cvText);

          // When the parse left the role line empty, the AI derives one from
          // the document content itself — the profile must never show an
          // empty headline when the CV names the work. Best-effort: a failed
          // derivation keeps the previous behaviour (existing headline kept,
          // or empty on a brand-new profile) and logs the reason.
          let aiHeadline = cleanField(llmResult.headline);
          if (!aiHeadline) {
            try {
              aiHeadline = cleanField(
                await deriveHeadlineWithLLM({
                  cvText,
                  skills: llmResult.skills,
                  roles: llmResult.experiences
                    .filter((e) => cleanField(e?.role))
                    .map((e) => `${e.role} — ${e.company}`),
                }),
              );
            } catch (err) {
              logger.warn({ err }, "AI headline derivation from the CV failed");
            }
          }
          if (aiHeadline) {
            llmResult.headline = aiHeadline;
          }

          parsedData = {
            headline: llmResult.headline,
            summary: llmResult.summary,
            skills: llmResult.skills,
            experiences: llmResult.experiences,
            education: llmResult.education,
            projects: llmResult.projects,
            certifications: llmResult.certifications,
          };

          // Auto-update profile
          if (llmResult.headline) {
            await db.update(candidatesTable)
              .set({ headline: llmResult.headline, updatedAt: new Date() })
              .where(eq(candidatesTable.id, candidate.id));
          }
          if (llmResult.summary) {
            await db.update(candidatesTable)
              .set({ summary: llmResult.summary, updatedAt: new Date() })
              .where(eq(candidatesTable.id, candidate.id));
          }

          // The CV is the source of truth: replace the derived rows with what
          // the model just read from THIS document, so entries from an older
          // CV or placeholder data can never outlive the upload. One
          // transaction — a mid-way failure must not leave the profile
          // half-cleared. Runs only on a successful parse; a failed parse
          // keeps the existing rows and reports parseError instead.
          await db.transaction(async (tx) => {
            if (llmResult.skills.length > 0) {
              await tx.delete(candidateSkillsTable).where(eq(candidateSkillsTable.candidateId, candidate.id));
              for (const rawName of uniqueBy(llmResult.skills, (s) => s)) {
                const skillName = rawName.trim();
                let skillRecord = await tx.query.skillsTable.findFirst({
                  where: eq(skillsTable.name, skillName),
                });
                if (!skillRecord) {
                  const inserted = await tx.insert(skillsTable).values({
                    name: skillName,
                    category: "professional" as const,
                  }).returning();
                  skillRecord = inserted[0];
                }
                await tx.insert(candidateSkillsTable).values({
                  candidateId: candidate.id,
                  skillId: skillRecord.id,
                  proficiency: 3,
                });
              }
            }

            await tx.delete(experiencesTable).where(eq(experiencesTable.candidateId, candidate.id));
            for (const exp of uniqueBy(
              llmResult.experiences.filter((e) => cleanField(e?.role) && cleanField(e?.company)),
              (e) => `${e.role}|${e.company}`,
            )) {
              const endDate = cleanField(exp.endDate);
              await tx.insert(experiencesTable).values({
                candidateId: candidate.id,
                role: exp.role.trim(),
                company: exp.company.trim(),
                location: cleanField(exp.location),
                description: cleanField(exp.description),
                startDate: cleanField(exp.startDate),
                endDate,
                current: !endDate,
              });
            }

            await tx.delete(educationTable).where(eq(educationTable.candidateId, candidate.id));
            for (const edu of uniqueBy(
              llmResult.education.filter((e) => cleanField(e?.degree)),
              (e) => `${e.degree}|${e.institution ?? ""}`,
            )) {
              await tx.insert(educationTable).values({
                candidateId: candidate.id,
                degree: edu.degree.trim(),
                field: cleanField(edu.field),
                institution: cleanField(edu.institution),
                year: toYear(edu.year),
              });
            }

            await tx.delete(projectsTable).where(eq(projectsTable.candidateId, candidate.id));
            for (const project of uniqueBy(
              llmResult.projects.filter((p) => cleanField(p?.name)),
              (p) => p.name,
            )) {
              await tx.insert(projectsTable).values({
                candidateId: candidate.id,
                name: project.name.trim(),
                description: cleanField(project.description),
                url: cleanField(project.url),
              });
            }

            await tx.delete(certificationsTable).where(eq(certificationsTable.candidateId, candidate.id));
            for (const cert of uniqueBy(
              llmResult.certifications.filter((c) => cleanField(c?.name)),
              (c) => `${c.name}|${c.issuer ?? ""}`,
            )) {
              await tx.insert(certificationsTable).values({
                candidateId: candidate.id,
                name: cert.name.trim(),
                issuer: cleanField(cert.issuer),
                year: toYear(cert.year),
              });
            }
          });

          // Fill a summary gap from the CV itself: many CVs jump straight to
          // the experience list, and the profile must not ship an empty
          // summary when the content to write one is right here. Only fills
          // a gap — a summary the seeker already has (or one the CV carried)
          // is never replaced.
          if (!cleanField(llmResult.summary) && !cleanField(candidate.summary)) {
            try {
              const generated = await generateSummaryWithLLM({
                cvText,
                headline: llmResult.headline,
                skills: llmResult.skills,
                roles: llmResult.experiences.filter((e) => cleanField(e?.role)).map((e) => `${e.role} — ${e.company}`),
              });
              const cleaned = cleanField(generated);
              if (cleaned) {
                parsedData.summary = cleaned;
                await db.update(candidatesTable)
                  .set({ summary: cleaned, updatedAt: new Date() })
                  .where(eq(candidatesTable.id, candidate.id));
                summaryGenerated = true;
              }
            } catch (err) {
              // Not fatal: the upload succeeded; the profile stays honest
              // about the missing summary and the seeker can retry later.
              logger.warn({ err }, "AI summary generation from the CV failed");
            }
          }
        } catch (err) {
          // Surface the reason instead of returning an empty profile with no
          // indication that parsing failed.
          logger.error({ err }, "CV parsing by the LLM failed");
          parseError = err instanceof Error ? err.message : "CV parsing failed";
        }
      }

      // A CV import rewrites skills/experience/education — the stored
      // completion and every match score must follow, so reassess fully.
      const preUpdate = await db.update(candidatesTable)
        .set({
          cvUrl: storedFile.url,
          cvParsedData: parsedData,
          updatedAt: new Date(),
        })
        .where(eq(candidatesTable.id, candidate.id))
        .returning();

      const assessment = await reassessCandidate(candidate.id);
      const updated = [{ ...preUpdate[0]!, completion: assessment.completion }];

      res.json({
        ...updated[0],
        cvStatus: cvStatusOf(updated[0]),
        parsed: Boolean(parsedData?.headline || parsedData?.skills?.length),
        ...(parseError ? { parseError } : {}),
        ...(summaryGenerated ? { summaryGenerated: true } : {}),
        reassessment: {
          completion: assessment.completion,
          reassessedMatches: assessment.reassessedMatches,
          changedMatches: assessment.changedMatches,
        },
        file: {
          id: storedFile.id,
          name: storedFile.originalName,
          url: storedFile.url,
          size: storedFile.size,
        },
      });
      return;
    }

    // Handle JSON body (backward compat)
    const schema = z.object({
      fileName: z.string().min(1),
      fileSize: z.number().int().positive(),
      fileUrl: z.string().url(),
      cvText: z.string().optional(),
      parsedData: z.object({
        headline: z.string().optional(),
        summary: z.string().optional(),
        skills: z.array(z.string()).optional(),
        experiences: z.array(z.object({
          role: z.string(),
          company: z.string(),
          description: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })).optional(),
      }).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    let parsedData = parsed.data.parsedData;
    if (parsed.data.cvText && !parsedData) {
      try {
        const llmResult = await parseCvText(parsed.data.cvText);
        parsedData = {
          headline: llmResult.headline,
          summary: llmResult.summary,
          skills: llmResult.skills,
          experiences: llmResult.experiences,
        };
      } catch {
        // LLM parsing failed
      }
    }

    // Same reassessment as the multipart path: the profile content changed.
    await db.update(candidatesTable)
      .set({
        cvUrl: parsed.data.fileUrl,
        cvParsedData: parsedData,
        updatedAt: new Date(),
      })
      .where(eq(candidatesTable.id, candidate.id));

    const assessment = await reassessCandidate(candidate.id);

    res.json({ completion: assessment.completion, reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

// ─── On-demand AI summary ──────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

/**
 * Fills the professional summary from the seeker's stored CV on an explicit
 * click — for profiles uploaded before the upload-time generation existed,
 * or whose summary was cleared. The AI never writes to the profile on its
 * own; every failure is reported, never papered over with filler text.
 */
router.post("/profile/summary-ai", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });
  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }
  if (!candidate.cvUrl) {
    res.status(400).json({ error: "ارفع سيرتك الذاتية أولاً — الملخص يُبنى من محتواها." });
    return;
  }

  const fileName = path.basename(candidate.cvUrl);
  const mime = MIME_BY_EXT[path.extname(fileName).toLowerCase()];
  if (!mime) {
    res.status(400).json({ error: "نوع ملف السيرة الحالي غير قابل للقراءة — ارفع الملف مجدداً." });
    return;
  }

  let cvText = "";
  try {
    cvText = await parseDocument(await getFile(fileName), mime);
  } catch {
    // Missing/unreadable file — the 410 below says so honestly.
  }
  if (!cleanField(cvText)) {
    res.status(410).json({ error: "تعذر قراءة نص السيرة المخزنة — ارفع الملف مجدداً." });
    return;
  }

  try {
    const [candidateSkills, experiences] = await Promise.all([
      db.query.candidateSkillsTable.findMany({ where: eq(candidateSkillsTable.candidateId, candidate.id) }),
      db.query.experiencesTable.findMany({ where: eq(experiencesTable.candidateId, candidate.id) }),
    ]);
    const skillRecords = candidateSkills.length > 0
      ? await db.query.skillsTable.findMany({ where: inArray(skillsTable.id, candidateSkills.map((s) => s.skillId)) })
      : [];

    const generated = await generateSummaryWithLLM({
      cvText,
      headline: candidate.headline ?? undefined,
      skills: skillRecords.map((s) => s.name),
      roles: experiences.map((e) => `${e.role} — ${e.company}`),
    });
    const cleaned = cleanField(generated);
    if (!cleaned) throw new Error("LLM returned an empty summary");

    await db.update(candidatesTable)
      .set({ summary: cleaned, updatedAt: new Date() })
      .where(eq(candidatesTable.id, candidate.id));

    // The summary is part of the scored profile — same reassessment as a save.
    const assessment = await reassessCandidate(candidate.id);
    res.json({
      summary: cleaned,
      completion: assessment.completion,
      reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
    });
  } catch (err) {
    logger.error({ err }, "On-demand AI summary generation failed");
    res.status(502).json({ error: "تعذر إنشاء الملخص بالذكاء الاصطناعي الآن — أعد المحاولة." });
  }
});

/**
 * Rebuilds the professional profile from the seeker's STORED CV — the same
 * source-of-truth pipeline as the upload path, run on an explicit ask so a
 * stale CV can stop shaping a profile it no longer describes. Everything
 * CV-derived (headline, summary, skills, experiences, education, projects,
 * certifications) is reset; the account identity (name, email, photo) and
 * the personal fields (location, phone, years, privacy/preferences) are
 * never touched. Nothing is wiped unless the CV parses successfully — a
 * failed parse leaves the profile exactly as it was.
 */
router.post("/profile/reset-from-cv", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  try {
    const candidate = await db.query.candidatesTable.findFirst({
      where: eq(candidatesTable.userId, req.user!.userId),
    });
    if (!candidate) {
      res.status(404).json({ error: "Candidate profile not found" });
      return;
    }
    if (!candidate.cvUrl) {
      res.status(400).json({ error: "ارفع سيرتك الذاتية أولاً — إعادة الضبط تُبنى من محتواها." });
      return;
    }

    const fileName = path.basename(candidate.cvUrl);
    const mime = MIME_BY_EXT[path.extname(fileName).toLowerCase()];
    if (!mime) {
      res.status(400).json({ error: "نوع ملف السيرة الحالي غير قابل للقراءة — ارفع الملف مجدداً." });
      return;
    }

    let cvText = "";
    try {
      cvText = await parseDocument(await getFile(fileName), mime);
    } catch {
      // Missing/unreadable stored file — the 410 below says so honestly.
    }
    if (!cleanField(cvText)) {
      res.status(410).json({ error: "تعذر قراءة نص السيرة المخزنة — ارفع الملف مجدداً." });
      return;
    }

    let llmResult;
    try {
      llmResult = await parseCvText(cvText);
    } catch (err) {
      logger.error({ err }, "CV re-parse failed during profile reset");
      // Fail before any delete: the profile stays exactly as it was.
      res.status(502).json({ error: "تعذر تحليل سيرتك بالذكاء الاصطناعي الآن — لم يُبدَّل أي شيء. أعد المحاولة." });
      return;
    }

    // Same headline policy as the upload: when the CV carries no role line,
    // the AI derives one from its content. On a derivation failure the old
    // wording stays — never wipe a headline we could not replace.
    if (!cleanField(llmResult.headline)) {
      try {
        const derived = cleanField(
          await deriveHeadlineWithLLM({
            cvText,
            skills: llmResult.skills,
            roles: llmResult.experiences.filter((e) => cleanField(e?.role)).map((e) => `${e.role} — ${e.company}`),
          }),
        );
        if (derived) llmResult.headline = derived;
      } catch (err) {
        logger.warn({ err }, "AI headline derivation during the profile reset failed");
      }
    }
    if (!cleanField(llmResult.headline)) {
      llmResult.headline = candidate.headline ?? "";
    }

    const skillNames = uniqueBy(llmResult.skills, (s) => s);
    const expRows = uniqueBy(
      llmResult.experiences.filter((e) => cleanField(e?.role) && cleanField(e?.company)),
      (e) => `${e.role}|${e.company}`,
    );
    const eduRows = uniqueBy(
      llmResult.education.filter((e) => cleanField(e?.degree)),
      (e) => `${e.degree}|${e.institution ?? ""}`,
    );
    const projRows = uniqueBy(
      llmResult.projects.filter((p) => cleanField(p?.name)),
      (p) => p.name,
    );
    const certRows = uniqueBy(
      llmResult.certifications.filter((c) => cleanField(c?.name)),
      (c) => `${c.name}|${c.issuer ?? ""}`,
    );
    const applied = {
      skills: skillNames.length,
      experiences: expRows.length,
      education: eduRows.length,
      projects: projRows.length,
      certifications: certRows.length,
    };

    // A reset follows the CV, not the document's luck: unlike the upload
    // path (which keeps old rows when the CV yields none), the old rows
    // MUST go even when this CV carries nothing — that is what "reset"
    // means. Empty results simply leave the section empty.
    await db.transaction(async (tx) => {
      await tx.delete(candidateSkillsTable).where(eq(candidateSkillsTable.candidateId, candidate.id));
      for (const skillName of skillNames) {
        let skillRecord = await tx.query.skillsTable.findFirst({
          where: eq(skillsTable.name, skillName.trim()),
        });
        if (!skillRecord) {
          const inserted = await tx.insert(skillsTable).values({
            name: skillName.trim(),
            category: "professional" as const,
          }).returning();
          skillRecord = inserted[0];
        }
        await tx.insert(candidateSkillsTable).values({
          candidateId: candidate.id,
          skillId: skillRecord.id,
          proficiency: 3,
        });
      }

      await tx.delete(experiencesTable).where(eq(experiencesTable.candidateId, candidate.id));
      for (const exp of expRows) {
        const endDate = cleanField(exp.endDate);
        await tx.insert(experiencesTable).values({
          candidateId: candidate.id,
          role: exp.role.trim(),
          company: exp.company.trim(),
          location: cleanField(exp.location),
          description: cleanField(exp.description),
          startDate: cleanField(exp.startDate),
          endDate,
          current: !endDate,
        });
      }

      await tx.delete(educationTable).where(eq(educationTable.candidateId, candidate.id));
      for (const edu of eduRows) {
        await tx.insert(educationTable).values({
          candidateId: candidate.id,
          degree: edu.degree.trim(),
          field: cleanField(edu.field),
          institution: cleanField(edu.institution),
          year: toYear(edu.year),
        });
      }

      await tx.delete(projectsTable).where(eq(projectsTable.candidateId, candidate.id));
      for (const project of projRows) {
        await tx.insert(projectsTable).values({
          candidateId: candidate.id,
          name: project.name.trim(),
          description: cleanField(project.description),
          url: cleanField(project.url),
        });
      }

      await tx.delete(certificationsTable).where(eq(certificationsTable.candidateId, candidate.id));
      for (const cert of certRows) {
        await tx.insert(certificationsTable).values({
          candidateId: candidate.id,
          name: cert.name.trim(),
          issuer: cleanField(cert.issuer),
          year: toYear(cert.year),
        });
      }

      // Headline and summary are CV-derived content too — they reset with
      // everything else instead of outliving the CV they described.
      await tx.update(candidatesTable)
        .set({
          headline: cleanField(llmResult.headline) ?? "",
          summary: cleanField(llmResult.summary) ?? "",
          cvParsedData: {
            headline: llmResult.headline,
            summary: cleanField(llmResult.summary),
            skills: llmResult.skills,
            experiences: llmResult.experiences,
            education: llmResult.education,
            projects: llmResult.projects,
            certifications: llmResult.certifications,
          },
          updatedAt: new Date(),
        })
        .where(eq(candidatesTable.id, candidate.id));
    });

    // Fill a summary gap from the CV itself when the document carried none —
    // same gap-filling policy as the upload. Best-effort: a failed summary
    // must not undo the reset; the profile is simply honest about it.
    let summary = cleanField(llmResult.summary) ?? "";
    let summaryGenerated = false;
    if (!summary) {
      try {
        const generated = await generateSummaryWithLLM({
          cvText,
          headline: llmResult.headline,
          skills: llmResult.skills,
          roles: llmResult.experiences.filter((e) => cleanField(e?.role)).map((e) => `${e.role} — ${e.company}`),
        });
        const cleaned = cleanField(generated);
        if (cleaned) {
          await db.update(candidatesTable)
            .set({ summary: cleaned, updatedAt: new Date() })
            .where(eq(candidatesTable.id, candidate.id));
          summary = cleaned;
          summaryGenerated = true;
        }
      } catch (err) {
        logger.warn({ err }, "AI summary generation during the profile reset failed");
      }
    }

    // The profile content changed wholesale — completion and every match
    // score must follow, same as a CV upload.
    const assessment = await reassessCandidate(candidate.id);
    res.json({
      completion: assessment.completion,
      reassessment: { completion: assessment.completion, reassessedMatches: assessment.reassessedMatches, changedMatches: assessment.changedMatches },
      ...(summaryGenerated ? { summaryGenerated: true } : {}),
      applied,
    });
  } catch (error) {
    logger.error({ error }, "Profile reset from CV failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Profile reset failed" });
  }
});

export default router;
