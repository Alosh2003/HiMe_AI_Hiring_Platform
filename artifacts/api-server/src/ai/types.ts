export interface MatchInput {
  job: {
    title: string;
    description: string;
    requiredSkills: { id: number; name: string; category: string }[];
    preferredSkills: { id: number; name: string; category: string }[];
    experienceLevel: "entry" | "mid" | "senior" | "lead";
    location: string;
    industry: string;
    salaryMin?: number;
    salaryMax?: number;
  };
  candidate: {
    id: string;
    headline: string;
    summary: string;
    skills: { id: number; name: string; proficiency: number; yearsExperience?: number }[];
    yearsExperience: number;
    location: string;
    preferences: {
      industries: string[];
      contractTypes: string[];
      remote: boolean;
      salaryMin?: number;
    };
    education: { degree: string; field: string; year: number }[];
    experiences: { role: string; company: string; description: string; startDate: string; endDate?: string; current: boolean }[];
  };
}

export interface MatchBreakdown {
  skills: { score: number; matched: string[]; missing: string[]; bonus: string[] };
  experience: { score: number; relevant: string[] };
  education: { score: number; notes: string };
  culture: { score: number; notes: string };
  location: { score: number; notes: string };
  salary: { score: number; notes: string };
}

export interface MatchResult {
  overallScore: number;
  breakdown: MatchBreakdown;
  explanation: string;
}

export interface SkillSynonym {
  canonical: string;
  synonyms: string[];
}
