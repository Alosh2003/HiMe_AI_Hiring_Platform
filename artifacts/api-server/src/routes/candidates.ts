import { Router, type IRouter } from "express";
import multer from "multer";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { candidatesTable, experiencesTable, educationTable, projectsTable, certificationsTable, candidateSkillsTable, skillsTable, usersTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { parseCvText } from "../ai/cv-parser";
import { calculateProfileCompletion } from "../ai/llm";
import { saveFile } from "../services/file-storage";
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
    columns: { phone: true },
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

  const { skills, preferences, phone, ...profileData } = parsed.data;

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

  res.json({ ...saved, cvStatus: cvStatusOf(saved) });
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

  res.status(201).json(newExp[0]);
});

router.post("/education", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    degree: z.string().min(2),
    field: z.string().optional(),
    institution: z.string().min(2),
    year: z.number().int().min(1950).max(2030),
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

  res.status(201).json(newEdu[0]);
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

      if (cvText) {
        try {
          const llmResult = await parseCvText(cvText);
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
        } catch (err) {
          // Surface the reason instead of returning an empty profile with no
          // indication that parsing failed.
          logger.error({ err }, "CV parsing by the LLM failed");
          parseError = err instanceof Error ? err.message : "CV parsing failed";
        }
      }

      // Recalculate profile completion
      const completion = await calculateProfileCompletion(candidate.id);

      const updated = await db.update(candidatesTable)
        .set({
          cvUrl: storedFile.url,
          cvParsedData: parsedData,
          completion,
          updatedAt: new Date(),
        })
        .where(eq(candidatesTable.id, candidate.id))
        .returning();

      res.json({
        ...updated[0],
        cvStatus: cvStatusOf(updated[0]),
        parsed: Boolean(parsedData?.headline || parsedData?.skills?.length),
        ...(parseError ? { parseError } : {}),
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

    const completion = await calculateProfileCompletion(candidate.id);

    const updated = await db.update(candidatesTable)
      .set({
        cvUrl: parsed.data.fileUrl,
        cvParsedData: parsedData,
        completion,
        updatedAt: new Date(),
      })
      .where(eq(candidatesTable.id, candidate.id))
      .returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

export default router;
