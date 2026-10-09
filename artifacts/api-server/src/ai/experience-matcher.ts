import type { MatchBreakdown } from "./types";

const EXPERIENCE_WEIGHTS: Record<string, number> = {
  entry: 1,
  mid: 3,
  senior: 6,
  lead: 8,
};

interface ExperienceMatchResult {
  score: number;
  relevant: string[];
}

export function matchExperience(
  requiredLevel: "entry" | "mid" | "senior" | "lead",
  candidateYears: number,
  candidateExperiences: { role: string; description: string; current: boolean }[],
  jobDescription: string,
): ExperienceMatchResult {
  const requiredYears = EXPERIENCE_WEIGHTS[requiredLevel] || 3;

  // Calculate experience score
  const yearRatio = candidateYears / requiredYears;
  let score: number;
  if (yearRatio >= 1.2) score = 100;
  else if (yearRatio >= 0.8) score = 90;
  else if (yearRatio >= 0.5) score = 70;
  else if (yearRatio >= 0.25) score = 50;
  else score = 30;

  // Find relevant experiences by keyword overlap
  const jobKeywords = extractKeywords(jobDescription);
  const relevant = candidateExperiences
    .map((exp) => {
      const expKeywords = extractKeywords(`${exp.role} ${exp.description}`);
      const overlap = jobKeywords.filter((k) => expKeywords.includes(k)).length;
      return { role: exp.role, relevance: overlap, current: exp.current };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3)
    .map((r) => r.role);

  // Boost score if relevant experience found
  if (relevant.length > 0) score = Math.min(score + 10, 100);

  return { score: Math.round(score), relevant };
}

function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "shall", "this",
    "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "ما", "في", "من", "على", "إلى", "عن", "أن", "كان", "هذا", "هذه",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
