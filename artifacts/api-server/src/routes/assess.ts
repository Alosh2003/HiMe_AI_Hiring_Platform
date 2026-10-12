import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { parseDocument } from "../services/document-parser";
import { assessCv } from "../ai/cv-parser";
import { assessRateLimiter } from "../middleware/rate-limiter";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

export interface CvAssessment {
  role: string;
  overallScore: number;
  breakdown: {
    skills: { score: number; matched: string[]; missing: string[] };
    experience: { score: number; years: number; relevant: string[] };
    education: { score: number; notes: string };
    presentation: { score: number; notes: string };
  };
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

const assessmentSchema = z.object({
  role: z.string().min(2).max(300),
  cvText: z.string().max(50_000).optional(),
});

/**
 * Public CV assessment — no account needed.
 *
 * Deliberately rate-limited hard: every call spends a Gemini request, and
 * unlike the authenticated matcher there is no user to absorb the cost.
 */
router.post(
  "/",
  assessRateLimiter,
  upload.single("file"),
  async (req, res) => {
    const parsed = assessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A job role (2-300 chars) is required" });
      return;
    }

    const { role, cvText: pastedText } = parsed.data;

    // Prefer an uploaded document; fall back to pasted text.
    let cvText = pastedText ?? "";
    if (req.file) {
      try {
        cvText = await parseDocument(req.file.buffer, req.file.mimetype);
      } catch (err) {
        logger.error({ err }, "Failed to read uploaded CV");
        res.status(400).json({ error: "Could not read that file. Try PDF, DOCX or TXT." });
        return;
      }
    }

    if (!cvText || cvText.trim().length < 50) {
      res.status(400).json({
        error: "Not enough text to assess. Upload a CV or paste its contents.",
      });
      return;
    }

    try {
      const assessment = await assessCv(cvText, role);

      res.json({
        ...assessment,
        role,
        truncated: cvText.length > 40_000,
      });
    } catch (err) {
      logger.error({ err }, "CV assessment failed");
      res.status(502).json({
        error: "The assessment service is unavailable right now. Please try again shortly.",
      });
    }
  },
);

export default router;