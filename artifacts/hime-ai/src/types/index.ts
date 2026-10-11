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

export interface Company { id: string; name: string; industry: string; location: string; website: string; description: string; teamSize: string; verified: boolean; verificationStatus?: VerificationStatus; verificationNote?: string | null; }
export interface Job { id: string; companyId: string; company: Company; title: string; description: string; industry: string; location: string; contract: ContractType; experience: ExperienceLevel; education: string; requiredSkills: Skill[]; preferredSkills: Skill[]; salary?: string; deadline: string; postedAt: string; applicants: number; status: 'active' | 'paused' | 'closed'; }
export interface Application { id: string; job: Job; candidateId: string; appliedAt: string; status: ApplicationStatus; matchScore: number; }
export interface MatchResult { id: string; jobId: string; candidateId?: string; score: number; breakdown: { skills: number; experience: number; education: number; projects: number; certifications: number; semantic: number; }; matchedSkills: Skill[]; missingSkills: Skill[]; relevantExperience: Experience[]; relevantProjects: Project[]; explanation: string; }
export interface Notification { id: string; title: string; body: string; read: boolean; createdAt: string; }