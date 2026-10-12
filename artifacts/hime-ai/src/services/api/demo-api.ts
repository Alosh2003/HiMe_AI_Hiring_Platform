import type { Application, ApplicationStatus, CandidateProfile, Company, Job, MatchResult, User, VerificationStatus } from '@/types';

// ─── Demo data (fallback when API is unavailable) ──────────────────────────

const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));
const skills = (names: string[]): import('@/types').Skill[] => names.map((name, index) => ({ id: `${name.toLowerCase().replaceAll(' ', '-')}-${index}`, name, category: 'professional' }));
let demoCompany: Company = { id: 'c-1', name: 'مِداد للتقنية', industry: 'تقنية المعلومات', location: 'الرياض، السعودية', website: 'medad.example', description: 'نبني أدوات تجعل العمل العربي أكثر وضوحاً وإنسانية.', teamSize: '51–200', verified: true };
let demoCompanies: Company[] = [demoCompany, { id: 'c-2', name: 'سِراج المالية', industry: 'التقنية المالية', location: 'دبي، الإمارات', website: 'siraj.example', description: 'منصة مالية رقمية للجيل القادم.', teamSize: '11–50', verified: true }, { id: 'c-3', name: 'أثر للاستشارات', industry: 'الاستشارات', location: 'جدة، السعودية', website: 'athar.example', description: 'نحو قرارات أعمال أفضل في المنطقة.', teamSize: '51–200', verified: false }];
const makeJob = (id: string, title: string, c: Company, extra: Partial<Job> = {}): Job => ({ id, companyId: c.id, company: c, title, description: 'نبحث عن شخص شغوف يبني منتجات مؤثرة ويحوّل المسائل المعقدة إلى تجارب بسيطة. ستعمل مع فريق متعدد التخصصات في بيئة تتعلم فيها كل يوم.', industry: c.industry, location: c.location, contract: 'full-time', experience: 'mid', education: 'بكالوريوس أو خبرة معادلة', requiredSkills: skills(['Product strategy', 'Research', 'Communication']), preferredSkills: skills(['Analytics', 'Figma']), salary: '18,000 – 24,000 ر.س', deadline: '2025-06-30', postedAt: 'منذ يومين', applicants: 24, status: 'active', ...extra });
const demoJobs: Job[] = [makeJob('j-1', 'مصمم تجربة مستخدم أول', demoCompany, { requiredSkills: skills(['Figma', 'User research', 'Arabic UX']), preferredSkills: skills(['Design systems', 'Prototyping']), experience: 'senior', applicants: 18 }), makeJob('j-2', 'مدير منتج — منصات الذكاء الاصطناعي', demoCompanies[1], { requiredSkills: skills(['Product strategy', 'AI products', 'Roadmapping']), preferredSkills: skills(['B2B SaaS', 'Analytics']), salary: '22,000 – 30,000 ر.س', applicants: 31 }), makeJob('j-3', 'مهندس واجهات أمامية', demoCompany, { requiredSkills: skills(['React', 'TypeScript', 'CSS']), preferredSkills: skills(['Testing', 'Accessibility']), location: 'الرياض أو عن بعد', applicants: 42 }), makeJob('j-4', 'كاتب محتوى تقني', demoCompanies[2], { requiredSkills: skills(['Arabic writing', 'Content strategy', 'SEO']), preferredSkills: skills(['English', 'B2B']), contract: 'contract', experience: 'entry', salary: '9,000 – 13,000 ر.س', applicants: 12 })];
const demoExperiences = [{ id: 'e-1', role: 'مصمم منتجات', company: 'ستوديو رِواق', location: 'الرياض', startDate: '2021', endDate: 'الآن', description: 'تصميم تجارب رقمية لمنتجات مالية وتعليمية.' }];
const demoProfile: CandidateProfile = { id: 'p-1', userId: 'u-1', headline: 'مصمم منتجات يهتم بما يشعر به الناس', summary: 'أصمم منتجات رقمية عربية واضحة، من البحث إلى الإطلاق، مع اهتمام خاص بإمكانية الوصول واللغة.', location: 'الرياض، السعودية', phone: '+966 50 123 4567', skills: skills(['Figma', 'User research', 'Arabic UX', 'Design systems', 'Prototyping']), experiences: demoExperiences, education: [{ id: 'ed-1', institution: 'جامعة الملك سعود', degree: 'بكالوريوس', field: 'تصميم الوسائط الرقمية', year: '2020' }], projects: [{ id: 'pr-1', name: 'مَسار', description: 'تجربة تخطيط مالي للشباب.', skills: ['Research', 'Figma'] }], certifications: [{ id: 'cert-1', name: 'Google UX Design', issuer: 'Google', year: '2022' }], completion: 82, cvStatus: 'analyzed', preferences: { industries: ['تقنية المعلومات'], locations: ['الرياض', 'عن بعد'], contract: 'full-time', remote: true } };
const demoRecommendations: MatchResult[] = demoJobs.slice(0, 3).map((job, i) => ({ id: `m-${i}`, jobId: job.id, candidateId: 'u-1', score: [92, 87, 76][i], breakdown: { skills: [94, 84, 71][i], experience: [90, 91, 74][i], education: [92, 86, 78][i], projects: [88, 82, 71][i], certifications: [89, 75, 66][i], semantic: [95, 91, 80][i] }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), relevantExperience: demoExperiences, relevantProjects: demoProfile.projects, explanation: 'خبرتك في تصميم المنتجات والبحث النوعي تتقاطع بوضوح مع متطلبات الدور.' }));
const demoApplications: Application[] = [{ id: 'a-1', job: demoJobs[0], candidateId: 'u-1', appliedAt: 'منذ 3 أيام', status: 'reviewing', matchScore: 92 }, { id: 'a-2', job: demoJobs[2], candidateId: 'u-1', appliedAt: 'منذ أسبوع', status: 'shortlisted', matchScore: 76 }];

// ─── API wrapper with auth token storage and demo fallback ─────────────────

function getToken(): string | null {
  return localStorage.getItem('hime_ai_token');
}

/** Error carrying the HTTP status so callers can branch on 404/403 etc. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

  // FormData must set its own multipart boundary; forcing application/json
  // here produces a body multer cannot parse.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...(options.headers as Record<string, string>) }
    : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/api${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.error || `Request failed: ${response.status}`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function hasApi(): boolean {
  return !!(import.meta.env.VITE_API_BASE_URL || localStorage.getItem('hime_ai_token'));
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const data = await apiRequest<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('hime_ai_token', data.token);
  localStorage.setItem('hime_ai_user', JSON.stringify(data.user));
  return data;
}

export async function register(name: string, email: string, password: string, role: 'seeker' | 'company') {
  const data = await apiRequest<{ token: string; user: User; onboarding?: boolean }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }) });
  localStorage.setItem('hime_ai_token', data.token);
  localStorage.setItem('hime_ai_user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('hime_ai_token');
  localStorage.removeItem('hime_ai_user');
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem('hime_ai_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

export async function listJobs(filters?: { search?: string; location?: string; industry?: string; contract?: string }) {
  if (hasApi()) {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.industry) params.set('industry', filters.industry);
    if (filters?.contract) params.set('contract', filters.contract);
    const query = params.toString();
    // GET /api/jobs returns { jobs, pagination }; every caller wants the list.
    const res = await apiRequest<Job[] | { jobs: Job[] }>(`/jobs${query ? `?${query}` : ''}`);
    return Array.isArray(res) ? res : res.jobs ?? [];
  }
  await wait();
  const q = filters?.search?.toLowerCase() || '';
  return demoJobs.filter((job) => {
    const q = filters?.search?.toLowerCase() || '';
    return (!q || `${job.title} ${job.industry} ${job.requiredSkills.map((s: { name: string }) => s.name).join(' ')}`.toLowerCase().includes(q)) && (!filters?.location || job.location.includes(filters.location)) && (!filters?.industry || job.industry === filters.industry) && (!filters?.contract || job.contract === filters.contract);
  });
}

export async function getJob(id: string) {
  if (hasApi()) return apiRequest<Job>(`/jobs/${id}`);
  await wait();
  return demoJobs.find((job) => job.id === id) || null;
}

// ─── Candidate ────────────────────────────────────────────────────────────

export async function getProfile() {
  if (hasApi()) return apiRequest<CandidateProfile>('/candidates/profile');
  await wait();
  return demoProfile;
}

export async function updateProfile(data: Partial<CandidateProfile>) {
  if (hasApi()) return apiRequest<CandidateProfile>('/candidates/profile', { method: 'PATCH', body: JSON.stringify(data) });
  await wait();
  Object.assign(demoProfile, data);
  return demoProfile;
}

/**
 * Uploads the CV as multipart/form-data.
 *
 * The previous version posted a placeholder fileUrl, so the server never saw
 * the document and the AI had nothing to parse.
 */
export async function uploadCv(input: File | { name: string; size: number }) {
  if (hasApi()) {
    if (input instanceof File) {
      const form = new FormData();
      form.append('file', input);
      return apiRequest<CandidateProfile>('/candidates/cv', { method: 'POST', body: form });
    }
    // No File object (older callers) — fall back to the metadata-only shape.
    return apiRequest<CandidateProfile>('/candidates/cv', {
      method: 'POST',
      body: JSON.stringify({ fileName: input.name, fileSize: input.size, fileUrl: 'https://example.com/cv.pdf' }),
    });
  }
  await wait(750);
  demoProfile.cvStatus = 'analyzed';
  return { ...input, status: 'analyzed' as const, extractedAt: 'الآن' };
}

// ─── Public CV assessment ───────────────────────────────────────────────────

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

/**
 * Rates a CV against a job role. Public — no auth header is sent.
 * The result is stored in localStorage by the page so it survives sign-in.
 */
export async function assessCv(file: File, role: string): Promise<CvAssessment> {
  const form = new FormData();
  form.append('role', role);
  form.append('file', file);
  return apiRequest<CvAssessment>('/assess', { method: 'POST', body: form });
}

// ─── Recommendations & Applications ─────────────────────────────────────────

export async function recommendations() {
  if (hasApi()) {
    const data = await apiRequest<{ job: { id: string; title: string; company: string; location: string }; match: { overallScore: number; breakdown: { skills: { score: number; matched: string[]; missing: string[] }; experience: { score: number }; education: { score: number } }; explanation: string } }[]>('/ai/recommendations');
    return data.map((item) => ({
      id: `m-${item.job.id}`,
      jobId: item.job.id,
      candidateId: 'u-1',
      score: item.match.overallScore,
      breakdown: {
        skills: item.match.breakdown.skills.score,
        experience: item.match.breakdown.experience.score,
        education: item.match.breakdown.education.score,
        projects: 85,
        certifications: 80,
        semantic: item.match.overallScore,
      },
      matchedSkills: item.match.breakdown.skills.matched.map((name: string, i: number) => ({ id: `s-${i}`, name, category: 'professional' } as import('@/types').Skill)),
      missingSkills: item.match.breakdown.skills.missing.map((name: string, i: number) => ({ id: `s-m-${i}`, name, category: 'professional' } as import('@/types').Skill)),
      relevantExperience: demoExperiences,
      relevantProjects: demoProfile.projects,
      explanation: item.match.explanation,
    }));
  }
  await wait();
  return demoRecommendations;
}

export async function applications() {
  if (hasApi()) return apiRequest<Application[]>('/applications/my');
  await wait();
  return demoApplications;
}

export async function apply(jobId: string) {
  if (hasApi()) return apiRequest<Application>('/applications', { method: 'POST', body: JSON.stringify({ jobId }) });
  await wait();
  const job = demoJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('Job not found');
  const item: Application = { id: `a-${Date.now()}`, job, candidateId: 'u-1', appliedAt: 'الآن', status: 'applied', matchScore: 84 };
  demoApplications.unshift(item);
  return item;
}

// ─── Company ───────────────────────────────────────────────────────────────

export async function getCompanyJobs() {
  if (hasApi()) {
    // /companies/me/jobs resolves the company from the session, saving a
    // round trip and avoiding a 404 when the id isn't known up front.
    return apiRequest<Job[]>('/companies/me/jobs');
  }
  await wait();
  return demoJobs.filter((job) => job.companyId === demoCompany.id);
}

export async function createJob(input: Partial<Job>) {
  if (hasApi()) {
    return apiRequest<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        industry: input.industry,
        location: input.location,
        contractType: input.contract,
        experienceLevel: input.experience,
        salaryMin: input.salary ? Number(input.salary) : undefined,
        salaryMax: undefined,
        deadline: input.deadline,
        requiredSkills: input.requiredSkills || [],
        preferredSkills: input.preferredSkills || [],
      }),
    });
  }
  await wait();
  const newJob = makeJob(`j-${Date.now()}`, input.title || 'وظيفة جديدة', demoCompany, input);
  demoJobs.unshift(newJob);
  return newJob;
}

export async function updateJob(id: string, input: Partial<Job>) {
  if (hasApi()) return apiRequest<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  await wait();
  const found = demoJobs.find((job) => job.id === id);
  if (!found) throw new Error('Job not found');
  Object.assign(found, input);
  return found;
}

export async function deleteJob(id: string) {
  if (hasApi()) return apiRequest<void>(`/jobs/${id}`, { method: 'DELETE' });
  await wait();
  const index = demoJobs.findIndex((job) => job.id === id);
  if (index >= 0) demoJobs.splice(index, 1);
}

export async function candidates(jobId: string) {
  if (hasApi()) {
    const data = await apiRequest<(Application & { candidate: { id: string; name: string; headline: string; score: number } })[]>(`/applications/job/${jobId}`);
    return data.map((app) => ({
      id: app.candidate.id,
      name: app.candidate.name,
      headline: app.candidate.headline,
      score: app.matchScore || 0,
      job: app.job,
      breakdown: ((app as unknown as Record<string, unknown>)['matchBreakdown'] as unknown as MatchResult['breakdown']) || { skills: 85, experience: 80, education: 75, projects: 70, certifications: 65, semantic: 75 },
      matchedSkills: [],
      missingSkills: [],
      status: app.status,
    }));
  }
  await wait();
  const job = demoJobs.find((item) => item.id === jobId) || demoJobs[0];
  return [{ id: 'u-8', name: 'سارة الحربي', headline: 'Product Designer', score: 94, job, breakdown: { skills: 96, experience: 91, education: 90, projects: 94, certifications: 87, semantic: 95 }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), status: 'shortlisted' as ApplicationStatus }, { id: 'u-9', name: 'عمر الغامدي', headline: 'UX Researcher', score: 86, job, breakdown: { skills: 88, experience: 84, education: 89, projects: 80, certifications: 76, semantic: 90 }, matchedSkills: job.requiredSkills.slice(0, 1), missingSkills: job.requiredSkills.slice(1), status: 'reviewing' as ApplicationStatus }];
}

export async function company() {
  if (hasApi()) {
    try {
      return await apiRequest<Company>('/companies/me/profile');
    } catch (err) {
      // A company that has not submitted its details yet has no row, so the
      // endpoint 404s. Return an empty draft so onboarding can render
      // instead of showing an error.
      if (err instanceof ApiError && err.status === 404) {
        return {
          id: '', name: '', industry: '', location: '', website: '',
          description: '', teamSize: '', verified: false, verificationStatus: 'draft',
        } as Company;
      }
      throw err;
    }
  }
  await wait();
  return demoCompany;
}

export interface CompanyProfileInput {
  name: string;
  industry: string;
  location: string;
  website?: string;
  description?: string;
  employeeCount?: number;
  foundedYear?: number;
}

export async function saveCompanyProfile(input: CompanyProfileInput) {
  if (hasApi()) return apiRequest<Company>('/companies/profile', { method: 'POST', body: JSON.stringify(input) });
  await wait(300);
  demoCompany = { ...demoCompany, ...input };
  return demoCompany;
}

export async function requestVerification() {
  if (hasApi()) return apiRequest<Company>('/companies/verification/request', { method: 'POST' });
  await wait(300);
  demoCompany = { ...demoCompany, verificationStatus: 'pending' as VerificationStatus };
  return demoCompany;
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function stats() {
  if (hasApi()) return apiRequest<{ candidates: number; companies: number; jobs: number; applications: number }>('/admin/stats');
  await wait();
  return { candidates: 1248, companies: 86, jobs: 214, applications: 3820 };
}

export async function listCompanies() {
  if (hasApi()) return apiRequest<Company[]>('/companies');
  await wait();
  return demoCompanies;
}

// ─── Company verification review (admin) ────────────────────────────────────

export type { VerificationStatus } from '@/types';

export interface AdminCompany extends Company {
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
  contact?: { name: string; email: string } | null;
}

export async function listCompaniesForReview(status?: VerificationStatus) {
  if (hasApi()) {
    const q = status ? `?status=${status}` : '';
    return apiRequest<AdminCompany[]>(`/admin/companies${q}`);
  }
  await wait();
  return demoCompanies as AdminCompany[];
}

export async function approveCompany(id: string) {
  if (hasApi()) return apiRequest<Company>(`/admin/companies/${id}/verify`, { method: 'POST' });
  await wait(250);
  demoCompanies = demoCompanies.map((c) => c.id === id ? { ...c, verificationStatus: 'verified' as const, verified: true } : c);
  return demoCompanies.find((c) => c.id === id)!;
}

export async function rejectCompany(id: string, reason: string) {
  if (hasApi()) return apiRequest<Company>(`/admin/companies/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  await wait(250);
  demoCompanies = demoCompanies.map((c) => c.id === id ? { ...c, verificationStatus: 'rejected' as const, verificationNote: reason } : c);
  return demoCompanies.find((c) => c.id === id)!;
}
