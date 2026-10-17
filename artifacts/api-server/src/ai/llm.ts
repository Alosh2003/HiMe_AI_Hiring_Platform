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
const OLLAMA_BASE_URL = (process.env["OLLAMA_BASE_URL"] || "http://localhost:11434").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env["OLLAMA_MODEL"] || "qwen2.5:7b";

type ProviderName = "ollama" | "gemini" | "openai" | "none";

const LLM_PROVIDER = (process.env["LLM_PROVIDER"] || (GEMINI_API_KEY ? "gemini" : OPENAI_API_KEY ? "openai" : "none")) as ProviderName;
// Optional second chance: when the primary fails, try this one before giving
// up. Defaults to gemini whenever ollama is primary and a key exists.
const LLM_FALLBACK = (process.env["LLM_FALLBACK"] || (LLM_PROVIDER === "ollama" && GEMINI_API_KEY ? "gemini" : "none")) as ProviderName;

interface LLMResponse {
  content: string;
}

interface CallOptions {
  /** Ask the model for strict JSON output (both Ollama and Gemini honor it). */
  json?: boolean;
}

// ─── OpenAI ────────────────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1000,
): Promise<LLMResponse> {
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
      max_tokens: maxOutputTokens,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };
  return { content: data.choices[0].message.content };
}

// ─── Ollama (local models) ─────────────────────────────────────────────────

/**
 * Talks to a locally running Ollama (or any OpenAI-compatible endpoint) via
 * its /v1/chat/completions API. No key, no quota, no data leaving the box.
 */
async function callOllama(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1000,
  options: CallOptions = {},
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: maxOutputTokens,
    stream: false,
    // Ollama's default 4096-token context must hold the prompt AND the whole
    // response; a full CV plus a long JSON answer overflows it and the reply
    // gets cut off mid-object. Give the pair room.
    options: { num_ctx: 8192 },
  };
  if (options.json) {
    body["response_format"] = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Ollama unreachable at ${OLLAMA_BASE_URL} (${err instanceof Error ? err.message : err})`);
  }

  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };
  return { content: data.choices?.[0]?.message?.content ?? "" };
}

// ─── Google Gemini ─────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

/**
 * Gemini's free tier intermittently returns 503/429 under load. Retry with
 * backoff so a transient blip does not silently degrade to rule-based output.
 */
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1000,
  options: CallOptions = {},
): Promise<LLMResponse> {
  if (!GEMINI_API_KEY) return { content: "" };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * attempt));
    }

    try {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.7,
        maxOutputTokens,
      };
      if (options.json) {
        generationConfig["responseMimeType"] = "application/json";
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig,
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

async function callProvider(
  provider: ProviderName,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
  options: CallOptions,
): Promise<LLMResponse> {
  switch (provider) {
    case "ollama":
      return callOllama(systemPrompt, userPrompt, maxOutputTokens, options);
    case "gemini":
      return callGemini(systemPrompt, userPrompt, maxOutputTokens, options);
    case "openai":
      return callOpenAI(systemPrompt, userPrompt, maxOutputTokens);
    case "none":
      return { content: "" };
  }
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1000,
  options: CallOptions = {},
): Promise<LLMResponse> {
  try {
    return await callProvider(LLM_PROVIDER, systemPrompt, userPrompt, maxOutputTokens, options);
  } catch (err) {
    // Second chance on the fallback provider before surfacing the failure.
    if (LLM_FALLBACK !== "none" && LLM_FALLBACK !== LLM_PROVIDER) {
      logger.warn({ err, from: LLM_PROVIDER, to: LLM_FALLBACK }, "Primary LLM failed — trying fallback");
      return callProvider(LLM_FALLBACK, systemPrompt, userPrompt, maxOutputTokens, options);
    }
    throw err;
  }
}

export function isLLMAvailable(): boolean {
  return LLM_PROVIDER !== "none";
}

export function getLLMProvider(): string {
  return LLM_FALLBACK !== "none" && LLM_FALLBACK !== LLM_PROVIDER
    ? `${LLM_PROVIDER}+${LLM_FALLBACK}`
    : LLM_PROVIDER;
}

/**
 * Models often wrap JSON in markdown fences or add a sentence of prose.
 * Strip both before parsing so a fenced reply doesn't silently fall back.
 */
export function extractJson(raw: string): unknown {
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

export interface ParsedCv {
  headline: string;
  summary: string;
  skills: string[];
  experiences: {
    role: string;
    company: string;
    location?: string;
    description: string;
    startDate?: string;
    endDate?: string;
  }[];
  education: { degree: string; field?: string; institution?: string; year?: number }[];
  projects: { name: string; description?: string; url?: string }[];
  certifications: { name: string; issuer?: string; year?: number }[];
}

export async function parseCvWithLLM(cvText: string): Promise<ParsedCv> {
  const systemPrompt = `You are an AI assistant that extracts structured information from CV/resume text.
Extract the following as JSON:
{
  "headline": "Professional headline or title",
  "summary": "Brief professional summary (2-3 sentences)",
  "skills": ["skill1", "skill2", "skill3"],
  "experiences": [{ "role": "Job title", "company": "Company name", "location": "City, Country or null", "description": "Brief description", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null" }],
  "education": [{ "degree": "Degree", "field": "Field of study", "institution": "University or school", "year": 2024 }],
  "projects": [{ "name": "Project name", "description": "One sentence", "url": "https://... or null" }],
  "certifications": [{ "name": "Certification name", "issuer": "Issuer", "year": 2024 }]
}

Rules:
- Read the ENTIRE document, every section and page — not just the opening.
- Include EVERY skill, experience, education entry, project and certification you find.
- Use null for missing optional values; keep every key.
Return ONLY the JSON object, no other text.`;

  try {
    // The response now covers five sections of a whole CV; 1000 tokens cut it
    // off mid-object (finishReason: MAX_TOKENS) and produced invalid JSON.
    const result = await callLLM(systemPrompt, `CV Text:\n${cvText}`, 4000, { json: true });
    const parsed = extractJson(result.content) as Partial<ParsedCv>;
    // An empty parse means the model replied but with nothing usable; make
    // that visible rather than looking like a successful empty result.
    if (!parsed?.headline && !parsed?.skills?.length) {
      throw new Error("LLM returned no usable CV fields");
    }
    // Normalize: models occasionally drop an empty section entirely.
    return {
      headline: parsed.headline ?? "",
      summary: parsed.summary ?? "",
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    };
  } catch (err) {
    logger.error({ err }, "parseCvWithLLM failed");
    throw err instanceof Error ? err : new Error("CV parsing failed");
  }
}

// ─── CV Assessment (public, role-scoped) ────────────────────────────────────

export interface CvAssessment {
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

/**
 * Rates a CV against a specific job role. Used by the public, sign-in-free
 * assessment — so it must never leak CV contents back to the client, only
 * derived scores and advice.
 */
export async function assessCvForRole(
  cvText: string,
  role: string,
): Promise<CvAssessment> {
  const systemPrompt = `You are a senior technical recruiter assessing how well a CV fits a job role.

Score the CV against the role and return ONLY this JSON object, no other text:
{
  "overallScore": 0-100,
  "breakdown": {
    "skills": { "score": 0-100, "matched": ["skill the CV has"], "missing": ["skill the role needs"] },
    "experience": { "score": 0-100, "years": number, "relevant": ["relevant roles"] },
    "education": { "score": 0-100, "notes": "one sentence" },
    "presentation": { "score": 0-100, "notes": "one sentence on clarity and structure" }
  },
  "strengths": ["2-4 specific strengths"],
  "gaps": ["2-4 concrete gaps"],
  "recommendations": ["3-5 actionable improvements, most impactful first"]
}

Be specific and honest. A score of 100 means nothing is missing. Every
recommendation must be something the candidate can actually change.`;

  try {
    // The assessment JSON is much larger than a CV parse; 1000 tokens cut it
    // off mid-object (finishReason: MAX_TOKENS) and produced invalid JSON.
    // JSON mode removes the fence/prose problem at the source.
    const result = await callLLM(
      systemPrompt,
      `Job role: ${role}\n\nCV:\n${cvText.slice(0, 40_000)}`,
      4000,
      { json: true },
    );
    const parsed = extractJson(result.content) as CvAssessment;

    if (
      typeof parsed?.overallScore !== "number" ||
      !Array.isArray(parsed?.recommendations) ||
      !Array.isArray(parsed?.strengths) ||
      !parsed?.breakdown
    ) {
      throw new Error("Assessment missing required fields");
    }

    return parsed;
  } catch (err) {
    logger.error({ err }, "assessCvForRole failed");
    throw err instanceof Error ? err : new Error("CV assessment failed");
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

// ─── Skill-list sanitation ──────────────────────────────────────────────────

/** Han/Kana/Hangul ranges — skills on this platform are written in English or Arabic. */
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

/**
 * Trims, de-duplicates and caps a model-provided skill list, dropping any
 * CJK-script entry. A drifting model must never label a job's requirements in
 * a language the platform doesn't use (数据分析 instead of Data Analysis) —
 * those names would hide real matches from the skill matcher forever.
 */
function normalizeSkillList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const name = String(item ?? "").trim().slice(0, 100);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || CJK_RE.test(name)) continue;
    seen.add(key);
    out.push(name);
    if (out.length === 12) break;
  }
  return out;
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
Skill names must be in English (their standard technical form) or Arabic — never Chinese, Japanese or Korean script.
Return ONLY the JSON object.`;

  try {
    const result = await callLLM(systemPrompt, `Job Description:\n${description}`, 1000, { json: true });
    const parsed = extractJson(result.content) as {
      requiredSkills: string[];
      preferredSkills: string[];
      experienceLevel: string;
      industry: string;
    };
    if (!parsed || (!parsed.requiredSkills?.length && !parsed.industry)) {
      throw new Error("LLM returned no usable job fields");
    }
    return {
      ...parsed,
      requiredSkills: normalizeSkillList(parsed.requiredSkills),
      preferredSkills: normalizeSkillList(parsed.preferredSkills),
    };
  } catch (err) {
    logger.error({ err }, "analyzeJobDescription failed");
    return { requiredSkills: [], preferredSkills: [], experienceLevel: "mid", industry: "" };
  }
}

// ─── Job-ad drafting ─────────────────────────────────────────────────────

/** The structured draft a company reviews in the posting wizard before publishing. */
export interface AiJobDraft {
  title: string;
  description: string;
  industry: string;
  location: string;
  contractType: "full-time" | "part-time" | "contract" | "internship";
  experienceLevel: "entry" | "mid" | "senior" | "lead";
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
}

/** The posting form offers these four industries; anything else maps to the closest. */
const INDUSTRY_KEYWORDS: [RegExp, string][] = [
  [/تقني|تكنولوجيا|برمج|حاسوب|ذكاء|بيانات|\bit\b|software|tech|data|dev/i, "تقنية المعلومات"],
  [/مالي|بنك|فينتك|تأمين|fintech|bank|financ|insur/i, "التقنية المالية"],
  [/تسويق|اعلان|growth|brand|market/i, "التسويق"],
  [/استشار|consult|advisor/i, "الاستشارات"],
];

function normalizeContractType(value: unknown): AiJobDraft["contractType"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("part")) return "part-time";
  if (raw.includes("intern") || raw.includes("train")) return "internship";
  if (raw.includes("contract") || raw.includes("freelance") || raw.includes("consult")) return "contract";
  return "full-time";
}

function normalizeExperienceLevel(value: unknown, years: number | null): AiJobDraft["experienceLevel"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("lead") || raw.includes("head") || raw.includes("principal") || raw.includes("director") || raw.includes("قياد")) return "lead";
  if (raw.includes("senior") || raw.includes("experienc") || raw.includes("خبير")) return "senior";
  if (raw.includes("entry") || raw.includes("junior") || raw.includes("graduat") || raw.includes("مبتد")) return "entry";
  if (raw.includes("mid") || raw.includes("intermed") || raw.includes("متوسط")) return "mid";
  if (years !== null) return years <= 2 ? "entry" : years <= 5 ? "mid" : years <= 9 ? "senior" : "lead";
  return "mid";
}

function normalizeIndustry(value: unknown): string {
  const raw = String(value ?? "");
  return INDUSTRY_KEYWORDS.find(([re]) => re.test(raw))?.[1] ?? "تقنية المعلومات";
}

function normalizeSalary(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Turns a pasted job advertisement — or just a position title plus wanted
 * experience — into a fill-in draft for the company's posting wizard. The
 * company reviews and edits every field; nothing is written to the database
 * here. Enums are normalized server-side so a creative model reply ("Full
 * Time", "junior") can never leak an invalid value into the form.
 */
export async function parseJobAdWithLLM(input: {
  adText?: string;
  position?: string;
  experienceYears?: number;
}): Promise<AiJobDraft> {
  const adText = input.adText?.trim();
  const position = input.position?.trim();
  const years = typeof input.experienceYears === "number" ? input.experienceYears : null;

  const systemPrompt = `You are a hiring assistant that drafts a structured job posting for a hiring platform.
${adText
    ? "A pasted job advertisement is provided: extract EVERY field from it faithfully."
    : "Only a position title (and maybe required years of experience) is provided: compose a realistic draft for that role."}
Return ONLY one JSON object:
{
  "title": "job title",
  "description": "the posting description: responsibilities and qualifications, 3-6 sentences, in the same language as the ad/position",
  "industry": "one of: تقنية المعلومات | التقنية المالية | التسويق | الاستشارات",
  "location": "City, Country as written in the ad (or a sensible default for the role)",
  "contractType": "full-time" | "part-time" | "contract" | "internship",
  "experienceLevel": "entry" | "mid" | "senior" | "lead",
  "salaryMin": number or null,
  "salaryMax": number or null,
  "requiredSkills": ["hard requirement", "..."],
  "preferredSkills": ["nice to have", "..."]
}
Rules:
- requiredSkills are the hard requirements, preferredSkills the nice-to-haves (3-10 each when the content supports it).
- Skills are ONLY tools, technologies and craft abilities (SQL, Power BI, communication). Education or degree requirements (Bachelor's, Master's, university) belong in the description, NEVER in the skill lists.
- Skill names must be in English (their standard technical form) or Arabic — never Chinese, Japanese or Korean script.
- experienceLevel: entry = 0-2 years, mid = 3-5, senior = 6-9, lead = 10+ (or follow the ad's wording).
- salary figures are plain numbers without currency; null when the ad does not state them — never invent figures.
- Keep technical skills in their common form (SQL, Power BI, Python) even inside Arabic text.`;

  const userPrompt = `Position: ${position ?? adText?.split("\n")[0]?.slice(0, 120) ?? "-"}
Required experience (years): ${years ?? "-"}

Job advertisement:
${(adText ?? position ?? "").slice(0, 12_000)}`;

  try {
    const result = await callLLM(systemPrompt, userPrompt, 2500, { json: true });
    const parsed = extractJson(result.content) as Partial<AiJobDraft>;
    if (!parsed || (!parsed.title && !parsed.description)) {
      throw new Error("LLM returned no usable job fields");
    }

    let salaryMin = normalizeSalary(parsed.salaryMin);
    let salaryMax = normalizeSalary(parsed.salaryMax);
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      [salaryMin, salaryMax] = [salaryMax, salaryMin];
    }

    return {
      title: String(parsed.title ?? position ?? "").trim().slice(0, 200),
      description: String(parsed.description ?? "").trim().slice(0, 8000),
      industry: normalizeIndustry(parsed.industry),
      location: String(parsed.location ?? "").trim().slice(0, 120) || "الرياض، السعودية",
      contractType: normalizeContractType(parsed.contractType),
      experienceLevel: normalizeExperienceLevel(parsed.experienceLevel, years),
      salaryMin,
      salaryMax,
      requiredSkills: normalizeSkillList(parsed.requiredSkills),
      preferredSkills: normalizeSkillList(parsed.preferredSkills),
    };
  } catch (err) {
    logger.error({ err }, "parseJobAdWithLLM failed");
    throw err instanceof Error ? err : new Error("Job-ad drafting failed");
  }
}

// ─── Match coaching ─────────────────────────────────────────────────────────

/** One missing skill together with a concrete plan to close it. */
export interface CoachGap {
  skill: string;
  /** How to GAIN the skill: course type, project idea, or on-the-job angle. */
  advice: string;
  /** How to honestly highlight adjacent existing experience on the CV. */
  cvTip: string;
}

/** The actionable plan that turns one recommendation into profile/CV work. */
export interface MatchCoach {
  summary: string;
  gaps: CoachGap[];
  showcase: { skill: string; cvTip: string }[];
}

/**
 * Fallback for a gap the model skipped — still actionable, and deliberately
 * never suggests claiming experience the candidate does not have.
 */
function defaultGap(skill: string): CoachGap {
  return {
    skill,
    advice: `ابدأ بمصدر تعلم واحد مركّز لمهارة ${skill} (دورة تطبيقية أو مشروع صغير)، ثم طبّقها في مهمة حقيقية داخل عملك إن أمكن.`,
    cvTip: `أدرج ${skill} في ملفك مع أي استخدام قريب منها من خبراتك الحالية بدون مبالغة، وحدّث السيرة الذاتية بعد إتمام تدريبك فيها.`,
  };
}

/**
 * Turns a job-candidate match into an improvement plan: for every missing
 * skill, how to gain it and how to reframe adjacent experience truthfully on
 * the CV; plus achievement-style tips for the matched skills. The result is
 * advice only — this function never writes to the database.
 */
export async function coachMatchWithLLM(input: {
  jobTitle: string;
  jobDescription: string;
  jobSkills: string[];
  candidateHeadline: string;
  candidateSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  experienceRoles: string[];
}): Promise<MatchCoach> {
  const systemPrompt = `You are a career coach. You help a candidate raise their job match by improving their profile and CV — honestly, never fabricating experience.
CRITICAL LANGUAGE RULE: write summary, advice and cvTip prose in professional Arabic (العربية). Keep only skill names, technical terms, and any quoted example CV bullet in English.
Return ONLY one JSON object:
{
  "summary": "١-٢ جملة: أعلى الإجراءات أثراً لهذا المرشح",
  "gaps": [{ "skill": "...", "advice": "كيف تكتسب هذه المهارة: نوع دورة محددة، فكرة مشروع، أو زاوية تطبيقها في العمل (١-٢ جملة)", "cvTip": "كيف تُبرز بصدق خبرة قريبة منها في السيرة الذاتية (١-٢ جملة)" }],
  "showcase": [{ "skill": "...", "cvTip": "جملة واحدة: كيف تصوغ إنجازاً قوياً بمهارة مطابقة" }]
}
Rules:
- Use ONLY skill names from the provided lists, spelled exactly as given, in English or Arabic (never Chinese/Japanese/Korean).
- Cover EVERY missing skill in "gaps" (same order); pick up to 5 of the strongest matched skills for "showcase".
- Never tell the candidate to claim a skill they don't have — advice is about gaining it or reframing adjacent work truthfully.
- Keep each field 1-3 sentences.`;

  const userPrompt = `Job: ${input.jobTitle}
Job description: ${input.jobDescription.slice(0, 3000)}
Required skills: ${input.jobSkills.join(", ")}

Candidate headline: ${input.candidateHeadline || "-"}
Candidate skills: ${input.candidateSkills.join(", ") || "-"}
Recent roles: ${input.experienceRoles.join(" | ") || "-"}
Matched skills: ${input.matchedSkills.join(", ") || "-"}
Missing skills: ${input.missingSkills.join(", ") || "-"}`;

  const result = await callLLM(systemPrompt, userPrompt, 3000, { json: true });
  const parsed = extractJson(result.content) as Partial<MatchCoach> & { gaps?: Array<Partial<CoachGap>> };
  if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.gaps)) {
    throw new Error("LLM returned no usable coaching plan");
  }

  const missing = input.missingSkills.filter(Boolean);
  const bySkill = new Map<string, CoachGap>();
  for (const gap of parsed.gaps) {
    if (!gap || typeof gap.skill !== "string") continue;
    // Only the real gaps of THIS job may appear in the plan.
    const canonical = missing.find((m) => m.toLowerCase() === gap.skill!.trim().toLowerCase());
    if (!canonical) continue;
    bySkill.set(canonical, {
      skill: canonical,
      advice: String(gap.advice ?? "").trim() || defaultGap(canonical).advice,
      cvTip: String(gap.cvTip ?? "").trim() || defaultGap(canonical).cvTip,
    });
  }

  const showcase = (Array.isArray(parsed.showcase) ? parsed.showcase : [])
    .filter((s): s is { skill: string; cvTip: string } =>
      Boolean(s) && typeof s.skill === "string" && typeof s.cvTip === "string" && Boolean(s.cvTip.trim()))
    .slice(0, 5)
    .map((s) => ({ skill: s.skill.trim(), cvTip: s.cvTip.trim() }))
    .filter((s) => Boolean(s.skill));

  return {
    summary: String(parsed.summary).trim(),
    gaps: missing.map((skill) => bySkill.get(skill) ?? defaultGap(skill)),
    showcase,
  };
}

export { callLLM };
