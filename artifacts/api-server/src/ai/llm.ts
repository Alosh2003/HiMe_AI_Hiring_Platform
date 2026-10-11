import { db } from "@workspace/db";
import { candidatesTable, candidateSkillsTable, experiencesTable, educationTable, projectsTable, certificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Provider config ───────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"] || "";
const OPENAI_MODEL = process.env["OPENAI_MODEL"] || "gpt-4o-mini";
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] || "";
// gemini-2.0-flash was retired; gemini-flash-latest is only ~50% reliable on
// the free tier (intermittent 503s). gemini-3.5-flash is stable and GA.
const GEMINI_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.5-flash";

const LLM_PROVIDER = process.env["LLM_PROVIDER"] || (GEMINI_API_KEY ? "gemini" : OPENAI_API_KEY ? "openai" : "none");

interface LLMResponse {
  content: string;
}

// ─── OpenAI ────────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  if (!OPENAI_API_KEY) return { content: "" };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };
  return { content: data.choices[0].message.content };
}

// ─── Google Gemini ─────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

/**
 * Gemini's free tier intermittently returns 503/429 under load. Retry with
 * backoff so a transient blip does not silently degrade to rule-based output.
 */
async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  if (!GEMINI_API_KEY) return { content: "" };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * attempt));
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as {
          candidates: { content: { parts: { text: string }[] } }[];
        };
        return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
      }

      lastError = new Error(`Gemini API error: ${response.status}`);

      // Only capacity/rate errors are worth retrying.
      if (response.status !== 429 && response.status !== 503) {
        throw lastError;
      }

      logger.warn(
        { status: response.status, attempt },
        `Gemini ${response.status} — retrying`,
      );
    } catch (err) {
      if (err instanceof Error && /API error: (4\d\d)/.test(err.message)) {
        throw err; // client error, retrying will not help
      }
      lastError = err;
      logger.warn({ attempt, err }, "Gemini request failed — retrying");
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

// ─── Unified LLM caller ───────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  if (LLM_PROVIDER === "gemini") {
    return callGemini(systemPrompt, userPrompt);
  }
  if (LLM_PROVIDER === "openai") {
    return callOpenAI(systemPrompt, userPrompt);
  }
  return { content: "" };
}

export function isLLMAvailable(): boolean {
  return LLM_PROVIDER !== "none";
}

export function getLLMProvider(): string {
  return LLM_PROVIDER;
}

/**
 * Models often wrap JSON in markdown fences or add a sentence of prose.
 * Strip both before parsing so a fenced reply doesn't silently fall back.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the first balanced {...} block
    const start = candidate.indexOf("{");
    if (start === -1) throw new Error("No JSON object in LLM response");
    let depth = 0;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
      }
    }
    throw new Error("Unbalanced JSON in LLM response");
  }
}

// ─── CV Parsing ────────────────────────────────────────────────────────────

export async function parseCvWithLLM(cvText: string): Promise<{
  headline: string;
  summary: string;
  skills: string[];
  experiences: { role: string; company: string; description: string; startDate?: string; endDate?: string }[];
}> {
  const systemPrompt = `You are an AI assistant that extracts structured information from CV/resume text.
Extract the following as JSON:
{
  "headline": "Professional headline or title",
  "summary": "Brief professional summary (2-3 sentences)",
  "skills": ["skill1", "skill2", "skill3"],
  "experiences": [{ "role": "Job title", "company": "Company name", "description": "Brief description", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null" }]
}

Return ONLY the JSON object, no other text.`;

  try {
    const result = await callLLM(systemPrompt, `CV Text:\n${cvText}`);
    const parsed = extractJson(result.content) as {
      headline: string;
      summary: string;
      skills: string[];
      experiences: { role: string; company: string; description: string; startDate?: string; endDate?: string }[];
    };
    // An empty parse means the model replied but with nothing usable; make
    // that visible rather than looking like a successful empty result.
    if (!parsed?.headline && !parsed?.skills?.length) {
      throw new Error("LLM returned no usable CV fields");
    }
    return parsed;
  } catch (err) {
    logger.error({ err }, "parseCvWithLLM failed");
    throw err instanceof Error ? err : new Error("CV parsing failed");
  }
}

// ─── Match Explanation ─────────────────────────────────────────────────────

export async function generateMatchExplanation(
  jobTitle: string,
  candidateName: string,
  overallScore: number,
  breakdown: {
    skills: { score: number; matched: string[]; missing: string[] };
    experience: { score: number; relevant: string[] };
    education: { score: number; notes: string };
    culture: { score: number; notes: string };
    location: { score: number; notes: string };
    salary: { score: number; notes: string };
  },
): Promise<string> {
  if (!isLLMAvailable()) {
    const parts: string[] = [];
    if (overallScore >= 85) parts.push(`مطابقة قوية جداً مع دور ${jobTitle}.`);
    else if (overallScore >= 70) parts.push(`مطابقة جيدة مع دور ${jobTitle}.`);
    else if (overallScore >= 50) parts.push(`مطابقة متوسطة مع دور ${jobTitle}.`);
    else parts.push(`مطابقة محدودة مع دور ${jobTitle}.`);
    if (breakdown.skills.matched.length > 0) {
      parts.push(`يتقن ${breakdown.skills.matched.length} من المهارات المطلوبة`);
      if (breakdown.skills.missing.length > 0) parts.push(`مع فجوات في: ${breakdown.skills.missing.join("، ")}`);
    }
    if (breakdown.experience.relevant.length > 0) parts.push(`لديه خبرة ذات صلة في: ${breakdown.experience.relevant.join("، ")}`);
    return parts.join(" — ") + ".";
  }

  const systemPrompt = `You are an AI assistant that explains job-candidate matching results in Arabic.
Write a clear, concise explanation (2-3 sentences) of why this candidate matches or doesn't match the job.
Be specific about strengths and gaps. Use professional Arabic.
Return ONLY the explanation text, no other formatting.`;

  const userPrompt = `Job: ${jobTitle}
Candidate: ${candidateName}
Overall Score: ${overallScore}%
Breakdown:
- Skills: ${breakdown.skills.score}% (matched: ${breakdown.skills.matched.join(", ")}, missing: ${breakdown.skills.missing.join(", ")})
- Experience: ${breakdown.experience.score}% (relevant: ${breakdown.experience.relevant.join(", ")})
- Education: ${breakdown.education.score}% (${breakdown.education.notes})
- Culture: ${breakdown.culture.score}% (${breakdown.culture.notes})
- Location: ${breakdown.location.score}% (${breakdown.location.notes})
- Salary: ${breakdown.salary.score}% (${breakdown.salary.notes})`;

  try {
    const result = await callLLM(systemPrompt, userPrompt);
    return result.content;
  } catch {
    return `مطابقة ${overallScore >= 70 ? "جيدة" : overallScore >= 50 ? "متوسطة" : "محدودة"} مع دور ${jobTitle}.`;
  }
}

// ─── Profile Completion ───────────────────────────────────────────────────

export async function calculateProfileCompletion(candidateId: string): Promise<number> {
  const candidate = await db.query.candidatesTable.findFirst({
    where: eq(candidatesTable.id, candidateId),
  });
  if (!candidate) return 0;

  let score = 0;
  if (candidate.headline) score += 10;
  if (candidate.summary) score += 5;
  if (candidate.location) score += 5;

  const candidateSkills = await db.query.candidateSkillsTable.findMany({
    where: eq(candidateSkillsTable.candidateId, candidateId),
  });
  if (candidateSkills.length >= 3) score += 25;
  else if (candidateSkills.length >= 1) score += (candidateSkills.length / 3) * 25;

  const experiences = await db.query.experiencesTable.findMany({
    where: eq(experiencesTable.candidateId, candidateId),
  });
  if (experiences.length >= 1) score += 25;

  const education = await db.query.educationTable.findMany({
    where: eq(educationTable.candidateId, candidateId),
  });
  if (education.length >= 1) score += 15;

  const projects = await db.query.projectsTable.findMany({
    where: eq(projectsTable.candidateId, candidateId),
  });
  if (projects.length >= 1) score += 10;

  const certifications = await db.query.certificationsTable.findMany({
    where: eq(certificationsTable.candidateId, candidateId),
  });
  if (certifications.length >= 1) score += 5;

  return Math.min(Math.round(score), 100);
}

// ─── Job Description Analysis ──────────────────────────────────────────────

export async function analyzeJobDescription(description: string): Promise<{
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  industry: string;
}> {
  if (!isLLMAvailable()) {
    return { requiredSkills: [], preferredSkills: [], experienceLevel: "mid", industry: "" };
  }

  const systemPrompt = `You are an AI assistant that analyzes job descriptions.
Extract the following as JSON:
{
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill3"],
  "experienceLevel": "entry|mid|senior|lead",
  "industry": "industry name"
}
Return ONLY the JSON object.`;

  try {
    const result = await callLLM(systemPrompt, `Job Description:\n${description}`);
    const parsed = extractJson(result.content) as {
      requiredSkills: string[];
      preferredSkills: string[];
      experienceLevel: string;
      industry: string;
    };
    if (!parsed || (!parsed.requiredSkills?.length && !parsed.industry)) {
      throw new Error("LLM returned no usable job fields");
    }
    return parsed;
  } catch (err) {
    logger.error({ err }, "analyzeJobDescription failed");
    return { requiredSkills: [], preferredSkills: [], experienceLevel: "mid", industry: "" };
  }
}

export { callLLM };
