import type { ApplicationStatus } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getToken(): string | null {
  return localStorage.getItem('hime_ai_token');
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function loginApi(email: string, password: string) {
  return apiRequest<{ token: string; user: { id: string; email: string; name: string; role: string; phone?: string; avatarUrl?: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerApi(name: string, email: string, password: string, role: 'seeker' | 'company') {
  return apiRequest<{ token: string; user: { id: string; email: string; name: string; role: string; phone?: string; avatarUrl?: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });
}

export async function getMeApi() {
  return apiRequest<{ id: string; email: string; name: string; role: string; phone?: string; avatarUrl?: string }>('/auth/me');
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

export interface JobSkill {
  id: number;
  name: string;
  category: string;
}

export interface Job {
  id: string;
  companyId: string;
  company?: { id: string; name: string; industry: string; location: string };
  title: string;
  description: string;
  industry: string;
  location: string;
  contractType: string;
  experienceLevel: string;
  salaryMin?: number;
  salaryMax?: number;
  deadline?: string;
  status: string;
  applicantsCount: number;
  createdAt: string;
  updatedAt: string;
  requiredSkills?: JobSkill[];
  preferredSkills?: JobSkill[];
}

export async function listJobsApi(params?: { search?: string; industry?: string; contract?: string; status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.industry) searchParams.set('industry', params.industry);
  if (params?.contract) searchParams.set('contract', params.contract);
  if (params?.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return apiRequest<Job[]>(`/jobs${query ? `?${query}` : ''}`);
}

export async function getJobApi(id: string) {
  return apiRequest<Job>(`/jobs/${id}`);
}

export async function createJobApi(payload: {
  title: string;
  description: string;
  industry: string;
  location: string;
  contractType: string;
  experienceLevel: string;
  salaryMin?: number;
  salaryMax?: number;
  deadline?: string;
  requiredSkills: { name: string; category: string }[];
  preferredSkills: { name: string; category: string }[];
}) {
  return apiRequest<Job>('/jobs', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateJobApi(id: string, payload: Partial<Job>) {
  return apiRequest<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteJobApi(id: string) {
  return apiRequest<void>(`/jobs/${id}`, { method: 'DELETE' });
}

// ─── Candidates ────────────────────────────────────────────────────────────

export interface CandidateProfile {
  id: string;
  userId: string;
  headline?: string;
  summary?: string;
  location?: string;
  yearsExperience?: number;
  cvUrl?: string;
  cvParsedData?: unknown;
  preferences?: {
    industries: string[];
    contractTypes: string[];
    remote: boolean;
    salaryMin?: number;
  };
  completion: number;
  skills?: { id: number; name: string; category: string; proficiency: number; yearsExperience?: number }[];
  experiences?: { id: string; role: string; company: string; location?: string; description?: string; startDate: string; endDate?: string; current: boolean }[];
  education?: { id: string; degree: string; field?: string; institution: string; year: number }[];
  projects?: { id: string; name: string; description?: string; url?: string }[];
  certifications?: { id: string; name: string; issuer?: string; year: number }[];
}

export async function getCandidateProfileApi() {
  return apiRequest<CandidateProfile>('/candidates/profile');
}

export async function updateCandidateProfileApi(payload: Partial<CandidateProfile>) {
  return apiRequest<CandidateProfile>('/candidates/profile', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function uploadCvApi(payload: { fileName: string; fileSize: number; fileUrl: string; parsedData?: unknown }) {
  return apiRequest<CandidateProfile>('/candidates/cv', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Companies ─────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  userId: string;
  name: string;
  industry: string;
  location: string;
  website?: string;
  description?: string;
  verified: boolean;
  jobs?: Job[];
}

export async function listCompaniesApi() {
  return apiRequest<Company[]>('/companies');
}

export async function getCompanyApi(id: string) {
  return apiRequest<Company>(`/companies/${id}`);
}

export async function getMyCompanyApi() {
  return apiRequest<Company>('/companies/me/profile');
}

export async function createOrUpdateCompanyApi(payload: {
  name: string;
  industry: string;
  location: string;
  website?: string;
  description?: string;
  employeeCount?: number;
  foundedYear?: number;
}) {
  return apiRequest<Company>('/companies/profile', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Applications ──────────────────────────────────────────────────────────

export interface Application {
  id: string;
  jobId: string;
  job?: Job & { company?: { id: string; name: string } };
  candidateId: string;
  status: ApplicationStatus;
  matchScore?: number;
  matchBreakdown?: {
    skills: number;
    experience: number;
    education: number;
    culture: number;
    location: number;
    salary: number;
  };
  aiExplanation?: string;
  appliedAt: string;
  updatedAt: string;
}

export async function applyToJobApi(jobId: string) {
  return apiRequest<Application>('/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
}

export async function getMyApplicationsApi() {
  return apiRequest<Application[]>('/applications/my');
}

export async function getJobCandidatesApi(jobId: string) {
  return apiRequest<(Application & { candidate: { id: string; headline?: string; location?: string } })[]>(`/applications/job/${jobId}`);
}

export async function updateApplicationStatusApi(id: string, status: ApplicationStatus) {
  return apiRequest<Application>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function getAdminStatsApi() {
  return apiRequest<{ candidates: number; companies: number; jobs: number; applications: number }>('/admin/stats');
}

export async function verifyCompanyApi(id: string) {
  return apiRequest<Company>(`/admin/companies/${id}/verify`, { method: 'POST' });
}

export async function suspendCompanyApi(id: string) {
  return apiRequest<Company>(`/admin/companies/${id}/suspend`, { method: 'POST' });
}

export async function adminDeleteJobApi(id: string) {
  return apiRequest<void>(`/admin/jobs/${id}`, { method: 'DELETE' });
}

export async function getAdminApplicationsApi() {
  return apiRequest<Application[]>('/admin/applications');
}

// ─── AI Matching ───────────────────────────────────────────────────────────

export interface MatchResult {
  overallScore: number;
  breakdown: {
    skills: { score: number; matched: string[]; missing: string[]; bonus: string[] };
    experience: { score: number; relevant: string[] };
    education: { score: number; notes: string };
    culture: { score: number; notes: string };
    location: { score: number; notes: string };
    salary: { score: number; notes: string };
  };
  explanation: string;
}

export async function matchJobApi(jobId: string) {
  return apiRequest<MatchResult>('/ai/match', { method: 'POST', body: JSON.stringify({ jobId }) });
}

export async function rankCandidatesApi(jobId: string) {
  return apiRequest<{ candidate: { id: string; name: string; headline?: string; location?: string }; match: MatchResult }[]>(`/ai/rank/${jobId}`);
}

export async function getRecommendationsApi() {
  return apiRequest<{ job: { id: string; title: string; company: string; location: string }; match: MatchResult }[]>('/ai/recommendations');
}
