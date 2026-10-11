import { db } from "@workspace/db";
import { candidatesTable, candidateSkillsTable, experiencesTable, educationTable, projectsTable, certificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ─── Provider config ───────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"] || "";
const OPENAI_MODEL = process.env["OPENAI_MODEL"] || "gpt-4o-mini";
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] || "";
const GEMINI_MODEL = process.env["GEMINI_MODEL"] || "gemini-2.0-flash";

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

async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
  if (!GEMINI_API_KEY) return { content: "" };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
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
    },
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

  const data = await response.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return { content: data.candidates[0].content.parts[0].text };
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
    return JSON.parse(result.content);
  } catch {
    return { headline: "", summary: "", skills: [], experiences: [] };
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
    return JSON.parse(result.content);
  } catch {
    return { requiredSkills: [], preferredSkills: [], experienceLevel: "mid", industry: "" };
  }
}

export { callLLM };
