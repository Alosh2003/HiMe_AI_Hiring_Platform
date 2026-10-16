import { Router, type IRouter } from "express";
import multer from "multer";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { candidatesTable, experiencesTable, educationTable, projectsTable, certificationsTable, candidateSkillsTable, skillsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { parseCvText } from "../ai/cv-parser";
import { calculateProfileCompletion } from "../ai/llm";
import { saveFile } from "../services/file-storage";
import { parseDocument } from "../services/document-parser";

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
  const updateSchema = z.object({
    headline: z.string().max(200).optional(),
    summary: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    yearsExperience: z.number().int().min(0).max(50).optional(),
    preferences: z.object({
      industries: z.array(z.string()).optional(),
      contractTypes: z.array(z.string()).optional(),
      remote: z.boolean().optional(),
      salaryMin: z.number().int().positive().optional(),
    }).optional(),
    skills: z.array(z.object({
      name: z.string(),
      category: z.string().default("professional"),
      proficiency: z.number().int().min(1).max(5).default(3),
      yearsExperience: z.number().int().min(0).optional(),
    })).optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
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

  const { skills, ...profileData } = parsed.data;

  const updateData: Record<string, unknown> = { ...profileData };
  if (profileData.preferences) {
    updateData.preferences = {
      industries: profileData.preferences.industries || [],
      contractTypes: profileData.preferences.contractTypes || [],
      remote: profileData.preferences.remote || false,
      salaryMin: profileData.preferences.salaryMin,
    };
  }

  const updated = await db.update(candidatesTable)
    .set(updateData)
    .where(eq(candidatesTable.id, candidate.id))
    .returning();

  if (skills) {
    await db.delete(candidateSkillsTable).where(eq(candidateSkillsTable.candidateId, candidate.id));

    for (const skill of skills) {
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

      await db.insert(candidateSkillsTable).values({
        candidateId: candidate.id,
        skillId: skillRecord.id,
        proficiency: skill.proficiency,
        yearsExperience: skill.yearsExperience,
      });
    }
  }

  res.json({ ...updated[0], cvStatus: cvStatusOf(updated[0]) });
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
        experiences?: { role: string; company: string; description: string; startDate?: string; endDate?: string }[];
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
          if (llmResult.skills.length > 0) {
            for (const skillName of llmResult.skills) {
              let skillRecord = await db.query.skillsTable.findFirst({
                where: eq(skillsTable.name, skillName),
              });
              if (!skillRecord) {
                const inserted = await db.insert(skillsTable).values({
                  name: skillName,
                  category: "professional" as const,
                }).returning();
                skillRecord = inserted[0];
              }
              const existing = await db.query.candidateSkillsTable.findFirst({
                where: sql`${candidateSkillsTable.candidateId} = ${candidate.id} AND ${candidateSkillsTable.skillId} = ${skillRecord.id}`,
              });
              if (!existing) {
                await db.insert(candidateSkillsTable).values({
                  candidateId: candidate.id,
                  skillId: skillRecord.id,
                  proficiency: 3,
                });
              }
            }
          }
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
