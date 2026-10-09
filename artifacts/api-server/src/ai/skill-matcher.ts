import type { MatchBreakdown } from "./types";

// ─── Skill synonym & normalization engine ────────────────────────────────────

const SKILL_SYNONYMS: Record<string, string[]> = {
  "react": ["reactjs", "react.js", "react framework"],
  "typescript": ["ts", "typed javascript"],
  "javascript": ["js", "es6", "ecmascript"],
  "node.js": ["nodejs", "node", "node.js"],
  "python": ["python3", "python programming"],
  "machine learning": ["ml", "machine-learning", "statistical learning"],
  "deep learning": ["dl", "neural networks", "deep-learning"],
  "data science": ["data-science", "data analytics", "data analysis"],
  "product management": ["product manager", "pm", "product ownership"],
  "project management": ["project manager", "pm", "project lead"],
  "user experience": ["ux", "user experience design", "ux design"],
  "user interface": ["ui", "user interface design", "ui design"],
  "artificial intelligence": ["ai", "artificial intelligence"],
  "cloud computing": ["cloud", "aws", "azure", "gcp", "cloud infrastructure"],
  "database": ["sql", "postgres", "mysql", "database management"],
  "devops": ["dev ops", "ci/cd", "deployment", "infrastructure"],
  "agile": ["scrum", "kanban", "agile methodology", "sprint"],
  "leadership": ["team lead", "management", "leading teams"],
  "communication": ["communications", "verbal communication", "written communication"],
};

const SKILL_CATEGORIES: Record<string, string[]> = {
  technical: ["javascript", "typescript", "python", "java", "go", "rust", "c++", "c#", "sql", "react", "vue", "angular", "node.js", "express", "django", "postgresql", "mongodb", "redis", "docker", "kubernetes", "aws", "azure", "gcp", "git", "ci/cd", "machine learning", "deep learning", "data science"],
  professional: ["product management", "project management", "agile", "scrum", "stakeholder management", "roadmapping", "user research", "a/b testing", "data analysis", "strategy"],
  soft: ["leadership", "communication", "teamwork", "problem solving", "critical thinking", "adaptability", "time management", "collaboration", "mentoring", "conflict resolution"],
  language: ["arabic", "english", "french", "german", "spanish", "chinese"],
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[._-]/g, " ").replace(/\s+/g, " ");
}

function findCanonicalSkill(skill: string): string {
  const normalized = normalizeSkill(skill);
  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (canonical === normalized) return canonical;
    if (synonyms.includes(normalized)) return canonical;
  }
  return normalized;
}

export function getSkillCategory(skill: string): string {
  const canonical = findCanonicalSkill(skill);
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.includes(canonical)) return category;
  }
  return "professional";
}

// ─── Core skill matching algorithm ─────────────────────────────────────────

interface SkillMatchResult {
  score: number;
  matched: string[];
  missing: string[];
  bonus: string[];
}

export function matchSkills(
  requiredSkills: { id: number; name: string }[],
  preferredSkills: { id: number; name: string }[],
  candidateSkills: { name: string; proficiency: number; yearsExperience?: number }[],
): SkillMatchResult {
  const candidateSkillsNormalized = candidateSkills.map((s) => ({
    ...s,
    canonical: findCanonicalSkill(s.name),
  }));

  const matched: string[] = [];
  const missing: string[] = [];
  const bonus: string[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  // Match required skills
  for (const req of requiredSkills) {
    const reqCanonical = findCanonicalSkill(req.name);
    const weight = 2.0; // Required skills have double weight
    totalWeight += weight;

    const candidateMatch = candidateSkillsNormalized.find((cs) => {
      if (cs.canonical === reqCanonical) return true;
      // Partial match: check if one contains the other
      if (cs.canonical.includes(reqCanonical) || reqCanonical.includes(cs.canonical)) return true;
      // Check synonyms
      const synonyms = SKILL_SYNONYMS[reqCanonical] || [];
      if (synonyms.some((syn) => cs.canonical === syn || cs.canonical.includes(syn))) return true;
      return false;
    });

    if (candidateMatch) {
      const proficiencyBonus = ((candidateMatch.proficiency - 1) / 4) * 0.3; // Up to 30% bonus for high proficiency
      const experienceBonus = candidateMatch.yearsExperience
        ? Math.min(candidateMatch.yearsExperience * 0.05, 0.2)
        : 0;
      earnedWeight += weight * (1 + proficiencyBonus + experienceBonus);
      matched.push(req.name);
    } else {
      missing.push(req.name);
    }
  }

  // Match preferred skills
  for (const pref of preferredSkills) {
    const prefCanonical = findCanonicalSkill(pref.name);
    const weight = 1.0;
    totalWeight += weight;

    const candidateMatch = candidateSkillsNormalized.find((cs) => {
      if (cs.canonical === prefCanonical) return true;
      if (cs.canonical.includes(prefCanonical) || prefCanonical.includes(cs.canonical)) return true;
      const synonyms = SKILL_SYNONYMS[prefCanonical] || [];
      if (synonyms.some((syn) => cs.canonical === syn || cs.canonical.includes(syn))) return true;
      return false;
    });

    if (candidateMatch) {
      earnedWeight += weight;
      bonus.push(pref.name);
    }
  }

  const score = totalWeight > 0 ? Math.min(Math.round((earnedWeight / totalWeight) * 100), 100) : 0;

  return { score, matched, missing, bonus };
}
