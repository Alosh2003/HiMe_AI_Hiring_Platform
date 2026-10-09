import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { candidatesTable, experiencesTable, educationTable, projectsTable, certificationsTable, candidateSkillsTable, skillsTable } from "@workspace/db/schema";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware/auth";

const router: IRouter = Router();

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
        where: sql`${skillsTable.id} IN ${sql.raw(`(${skillIds.map(() => "?").join(",")})`)}`,
      })
    : [];

  const skillMap = new Map(skillRecords.map((s) => [s.id, s]));

  res.json({
    ...candidate,
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

  res.json(updated[0]);
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

router.post("/cv", authMiddleware, requireRole("seeker"), async (req: AuthRequest, res) => {
  const schema = z.object({
    fileName: z.string().min(1),
    fileSize: z.number().int().positive(),
    fileUrl: z.string().url(),
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

  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.userId, req.user!.userId),
  });

  if (!candidate) {
    res.status(404).json({ error: "Candidate profile not found" });
    return;
  }

  const updated = await db.update(candidatesTable)
    .set({
      cvUrl: parsed.data.fileUrl,
      cvParsedData: parsed.data.parsedData,
      updatedAt: new Date(),
    })
    .where(eq(candidatesTable.id, candidate.id))
    .returning();

  res.json(updated[0]);
});

export default router;
