export type Role = 'seeker' | 'company' | 'admin';
export type ContractType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';
export type ApplicationStatus = 'applied' | 'reviewing' | 'shortlisted' | 'interview' | 'rejected' | 'accepted';

export interface User { id: string; name: string; email: string; role: Role; avatarInitials: string; }
export interface Skill { id: string; name: string; category: string; }
export interface Experience { id: string; role: string; company: string; location: string; startDate: string; endDate?: string; description: string; }
export interface Education { id: string; institution: string; degree: string; field: string; year: string; }
export interface Project { id: string; name: string; description: string; url?: string; skills: string[]; }
export interface Certification { id: string; name: string; issuer: string; year: string; }
export interface CandidateProfile { id: string; userId: string; headline: string; summary: string; location: string; phone: string; skills: Skill[]; experiences: Experience[]; education: Education[]; projects: Project[]; certifications: Certification[]; completion: number; cvStatus: 'missing' | 'processing' | 'analyzed' | 'failed'; preferences: { industries: string[]; locations: string[]; contract: ContractType; remote: boolean; }; }
export type VerificationStatus = 'draft' | 'pending' | 'verified' | 'rejected';

export interface CvAssessment {
  overallScore: number;
  role: string;
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

export interface Company { id: string; name: string; industry: string; location: string; website: string; description: string; teamSize: string; verified: boolean; verificationStatus?: VerificationStatus; verificationNote?: string | null; }
export interface Job { id: string; companyId: string; company: Company; title: string; description: string; industry: string; location: string; contract: ContractType; experience: ExperienceLevel; education: string; requiredSkills: Skill[]; preferredSkills: Skill[]; salary?: string; deadline: string; postedAt: string; applicants: number; status: 'active' | 'paused' | 'closed'; }
export interface Application { id: string; job: Job; candidateId: string; appliedAt: string; status: ApplicationStatus; matchScore: number | null; }
/**
 * The six categories the matching engine actually computes
 * (see api-server/src/ai/engine.ts). `null` means the engine produced no
 * value for that category — the UI skips those rows instead of inventing one.
 */
export interface MatchBreakdown { skills: number | null; experience: number | null; education: number | null; culture: number | null; location: number | null; salary: number | null; }
export interface MatchResult { id: string; jobId: string; candidateId?: string; jobTitle?: string; score: number; breakdown: MatchBreakdown; matchedSkills: Skill[]; missingSkills: Skill[]; relevantExperience: Experience[]; relevantProjects: Project[]; explanation: string; }
export interface Notification { id: string; title: string; body: string; read: boolean; createdAt: string; }