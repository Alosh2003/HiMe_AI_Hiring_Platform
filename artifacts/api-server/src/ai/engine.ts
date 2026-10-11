import type { MatchInput, MatchResult, MatchBreakdown } from "./types";
import { matchSkills } from "./skill-matcher";
import { matchExperience } from "./experience-matcher";
import { matchLocation } from "./location-matcher";
import { matchSalary } from "./salary-matcher";
import { matchCulture } from "./culture-matcher";
import { matchEducation } from "./education-matcher";

// ─── Weight configuration ────────────────────────────────────────────────────

const WEIGHTS = {
  skills: 0.35,
  experience: 0.25,
  education: 0.15,
  culture: 0.10,
  location: 0.10,
  salary: 0.05,
};

// ─── Main matching engine ───────────────────────────────────────────────────

export function computeMatch(input: MatchInput): MatchResult {
  const { job, candidate } = input;

  // Run all sub-matchers
  const skillsResult = matchSkills(
    job.requiredSkills,
    job.preferredSkills,
    candidate.skills,
  );

  const experienceResult = matchExperience(
    job.experienceLevel,
    candidate.yearsExperience,
    candidate.experiences,
    job.description,
  );

  const educationResult = matchEducation(job.description, candidate.education);

  const cultureResult = matchCulture(
    job.description,
    candidate.summary,
    candidate.experiences,
  );

  const locationResult = matchLocation(
    job.location,
    candidate.location,
    candidate.preferences.remote,
  );

  const salaryResult = matchSalary(
    job.salaryMin,
    job.salaryMax,
    candidate.preferences.salaryMin,
  );

  const breakdown: MatchBreakdown = {
    skills: {
      score: skillsResult.score,
      matched: skillsResult.matched,
      missing: skillsResult.missing,
      bonus: skillsResult.bonus,
    },
    experience: {
      score: experienceResult.score,
      relevant: experienceResult.relevant,
    },
    education: {
      score: educationResult.score,
      notes: educationResult.notes,
    },
    culture: {
      score: cultureResult.score,
      notes: cultureResult.notes,
    },
    location: {
      score: locationResult.score,
      notes: locationResult.notes,
    },
    salary: {
      score: salaryResult.score,
      notes: salaryResult.notes,
    },
  };

  // Weighted overall score
  const overallScore = Math.round(
    skillsResult.score * WEIGHTS.skills +
    experienceResult.score * WEIGHTS.experience +
    educationResult.score * WEIGHTS.education +
    cultureResult.score * WEIGHTS.culture +
    locationResult.score * WEIGHTS.location +
    salaryResult.score * WEIGHTS.salary,
  );

  // Generate human-readable explanation
  const explanation = generateExplanation(breakdown, overallScore, job, candidate);

  return { overallScore, breakdown, explanation };
}

// ─── Explanation generator ──────────────────────────────────────────────────

function generateExplanation(
  breakdown: MatchBreakdown,
  overallScore: number,
  job: MatchInput["job"],
  candidate: MatchInput["candidate"],
): string {
  const parts: string[] = [];

  // Opening
  if (overallScore >= 85) {
    parts.push(`مطابقة قوية جداً مع دور ${job.title}.`);
  } else if (overallScore >= 70) {
    parts.push(`مطابقة جيدة مع دور ${job.title}.`);
  } else if (overallScore >= 50) {
    parts.push(`مطابقة متوسطة مع دور ${job.title}.`);
  } else {
    parts.push(`مطابقة محدودة مع دور ${job.title}.`);
  }

  // Skills
  if (breakdown.skills.matched.length > 0) {
    parts.push(`يتقن ${breakdown.skills.matched.length} من المهارات المطلوبة`);
    if (breakdown.skills.missing.length > 0) {
      parts.push(`مع فجوات في: ${breakdown.skills.missing.join("، ")}`);
    }
  } else if (breakdown.skills.missing.length > 0) {
    parts.push(`فجوات في المهارات المطلوبة: ${breakdown.skills.missing.join("، ")}`);
  }

  // Experience
  if (breakdown.experience.relevant.length > 0) {
    parts.push(`لديه خبرة ذات صلة في: ${breakdown.experience.relevant.join("، ")}`);
  }

  // Culture
  if (breakdown.culture.notes !== "لا توجد إشرات ثقافية واضحة — محايد") {
    parts.push(`يتقاطع ثقافياً في: ${breakdown.culture.notes.replace("يتقاطع في: ", "")}`);
  }

  return parts.join(" — ") + ".";
}

export { generateExplanation };

// ─── Batch matching ────────────────────────────────────────────────────────

export function computeMatchBatch(
  jobs: MatchInput["job"][],
  candidate: MatchInput["candidate"],
): MatchResult[] {
  return jobs.map((job) => computeMatch({ job, candidate }));
}

export function rankCandidates(
  candidates: MatchInput["candidate"][],
  job: MatchInput["job"],
): { candidate: MatchInput["candidate"]; result: MatchResult }[] {
  return candidates
    .map((candidate) => ({
      candidate,
      result: computeMatch({ job, candidate }),
    }))
    .sort((a, b) => b.result.overallScore - a.result.overallScore);
}
