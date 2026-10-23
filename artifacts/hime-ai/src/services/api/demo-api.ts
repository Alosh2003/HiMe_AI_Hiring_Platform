import type { Application, ApplicationStatus, CandidateProfile, Certification, Company, ContractType, Education, Experience, Job, MatchBreakdown, MatchResult, Project, Skill, User, VerificationStatus } from '@/types';
import { formatRelative, formatSalary } from '@/lib/format';

// ─── Demo data (fallback when API is unavailable) ──────────────────────────

const wait = (ms = 260) => { markDemoFallback(); return new Promise((resolve) => setTimeout(resolve, ms)); };

// ─── Demo-mode visibility ────────────────────────────────────────────────
// Every call that falls back to fake data marks the UI, which renders a
// persistent banner. Silently showing invented jobs in a hiring product is
// worse than saying "the server is unreachable".

let demoModeActive = false;

export function isDemoModeActive(): boolean {
  return demoModeActive;
}

function markDemoFallback(): void {
  if (demoModeActive || typeof window === 'undefined') return;
  demoModeActive = true;
  window.dispatchEvent(new CustomEvent('hime-demo-mode'));
}
const skills = (names: string[]): import('@/types').Skill[] => names.map((name, index) => ({ id: `${name.toLowerCase().replaceAll(' ', '-')}-${index}`, name, category: 'professional' }));

// ─── API job -> UI job normalization ──────────────────────────────────────
// The API answers with `contractType`/`experienceLevel`/`salaryMin`/
// `salaryMax`/`applicantsCount`/`createdAt`, but every component reads
// `contract`/`experience`/`salary`/`applicants`/`postedAt`. Without this
// bridge, job cards render blank chips, admin stats add up `undefined`
// (NaN), and "راتب يحدد عند المقابلة" appears for jobs that DO have a
// salary. Applied to every job that enters the UI from the network.
type RawJob = Record<string, unknown>;
const asNum = (value: unknown): number | undefined =>
  (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;

export function mapApiJob(raw: RawJob | Job | null | undefined): Job | null {
  if (!raw || typeof raw !== 'object') return null;
  const job = raw as RawJob;
  const salaryMin = asNum(job.salaryMin);
  const salaryMax = asNum(job.salaryMax);
  const rawCompany = job.company;
  return {
    ...(job as unknown as Job),
    company: (typeof rawCompany === 'string'
      ? { id: '', name: rawCompany }
      : rawCompany ?? { id: '', name: '' }) as Company,
    contract: (job.contract ?? job.contractType ?? 'full-time') as Job['contract'],
    experience: (job.experience ?? job.experienceLevel ?? 'mid') as Job['experience'],
    education: typeof job.education === 'string' ? job.education : '',
    salary: typeof job.salary === 'string' ? job.salary : formatSalary(salaryMin, salaryMax),
    applicants: asNum(job.applicants) ?? asNum(job.applicantsCount) ?? 0,
    postedAt: typeof job.postedAt === 'string' ? job.postedAt : formatRelative(job.createdAt as string | undefined),
  };
}

/** Maps an application row, normalizing its nested job when present. */
function mapApiApplication(raw: Record<string, unknown>): Application {
  const job = raw.job ? mapApiJob(raw.job as RawJob) : undefined;
  return { ...(raw as unknown as Application), ...(job ? { job } : {}) } as Application;
}
let demoCompany: Company = { id: 'c-1', name: 'مِداد للتقنية', industry: 'تقنية المعلومات', location: 'الرياض، السعودية', website: 'medad.example', description: 'نبني أدوات تجعل العمل العربي أكثر وضوحاً وإنسانية.', teamSize: '51–200', verified: true };
let demoCompanies: Company[] = [demoCompany, { id: 'c-2', name: 'سِراج المالية', industry: 'التقنية المالية', location: 'دبي، الإمارات', website: 'siraj.example', description: 'منصة مالية رقمية للجيل القادم.', teamSize: '11–50', verified: true }, { id: 'c-3', name: 'أثر للاستشارات', industry: 'الاستشارات', location: 'جدة، السعودية', website: 'athar.example', description: 'نحو قرارات أعمال أفضل في المنطقة.', teamSize: '51–200', verified: false }];
const makeJob = (id: string, title: string, c: Company, extra: Partial<Job> = {}): Job => ({ id, companyId: c.id, company: c, title, description: 'نبحث عن شخص شغوف يبني منتجات مؤثرة ويحوّل المسائل المعقدة إلى تجارب بسيطة. ستعمل مع فريق متعدد التخصصات في بيئة تتعلم فيها كل يوم.', industry: c.industry, location: c.location, contract: 'full-time', experience: 'mid', education: 'بكالوريوس أو خبرة معادلة', requiredSkills: skills(['Product strategy', 'Research', 'Communication']), preferredSkills: skills(['Analytics', 'Figma']), salary: '18,000 – 24,000 ر.س', deadline: '2025-06-30', postedAt: 'منذ يومين', applicants: 24, status: 'active', ...extra });
const demoJobs: Job[] = [makeJob('j-1', 'مصمم تجربة مستخدم أول', demoCompany, { requiredSkills: skills(['Figma', 'User research', 'Arabic UX']), preferredSkills: skills(['Design systems', 'Prototyping']), experience: 'senior', applicants: 18, applicationForm: [
  { id: 'f-experience', label: 'سنوات الخبرة في تصميم المنتجات', type: 'number', required: true, hint: 'رقم صحيح' },
  { id: 'f-case', label: 'اذكر منتجاً صممته وأثره', type: 'long-text', required: true, hint: 'سطران تكفيان' },
  { id: 'f-start', label: 'متى يمكنك البدء؟', type: 'date', required: false },
] }), makeJob('j-2', 'مدير منتج — منصات الذكاء الاصطناعي', demoCompanies[1], { requiredSkills: skills(['Product strategy', 'AI products', 'Roadmapping']), preferredSkills: skills(['B2B SaaS', 'Analytics']), salary: '22,000 – 30,000 ر.س', applicants: 31 }), makeJob('j-3', 'مهندس واجهات أمامية', demoCompany, { requiredSkills: skills(['React', 'TypeScript', 'CSS']), preferredSkills: skills(['Testing', 'Accessibility']), location: 'الرياض أو عن بعد', applicants: 42 }), makeJob('j-4', 'كاتب محتوى تقني', demoCompanies[2], { requiredSkills: skills(['Arabic writing', 'Content strategy', 'SEO']), preferredSkills: skills(['English', 'B2B']), contract: 'contract', experience: 'entry', salary: '9,000 – 13,000 ر.س', applicants: 12 })];
const demoExperiences = [{ id: 'e-1', role: 'مصمم منتجات', company: 'ستوديو رِواق', location: 'الرياض', startDate: '2021', endDate: 'الآن', description: 'تصميم تجارب رقمية لمنتجات مالية وتعليمية.' }];
const demoProfile: CandidateProfile = { id: 'p-1', userId: 'u-1', headline: 'مصمم منتجات يهتم بما يشعر به الناس', summary: 'أصمم منتجات رقمية عربية واضحة، من البحث إلى الإطلاق، مع اهتمام خاص بإمكانية الوصول واللغة.', location: 'الرياض، السعودية', phone: '+966 50 123 4567', skills: skills(['Figma', 'User research', 'Arabic UX', 'Design systems', 'Prototyping']), experiences: demoExperiences, education: [{ id: 'ed-1', institution: 'جامعة الملك سعود', degree: 'بكالوريوس', field: 'تصميم الوسائط الرقمية', year: '2020' }], projects: [{ id: 'pr-1', name: 'مَسار', description: 'تجربة تخطيط مالي للشباب.', skills: ['Research', 'Figma'] }], certifications: [{ id: 'cert-1', name: 'Google UX Design', issuer: 'Google', year: '2022' }], completion: 82, cvStatus: 'analyzed', preferences: { industries: ['تقنية المعلومات'], locations: ['الرياض', 'عن بعد'], contract: 'full-time', remote: true } };
const demoRecommendations: MatchResult[] = demoJobs.slice(0, 3).map((job, i) => ({ id: `m-${i}`, jobId: job.id, candidateId: 'u-1', jobTitle: job.title, score: [92, 87, 76][i], breakdown: { skills: [94, 84, 71][i], experience: [90, 91, 74][i], education: [92, 86, 78][i], culture: [88, 85, 72][i], location: [95, 80, 76][i], salary: [90, 86, 70][i] }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), relevantExperience: demoExperiences, relevantProjects: demoProfile.projects, explanation: 'خبرتك في تصميم المنتجات والبحث النوعي تتقاطع بوضوح مع متطلبات الدور.' }));
const demoApplications: Application[] = [{ id: 'a-1', job: demoJobs[0], candidateId: 'u-1', appliedAt: 'منذ 3 أيام', status: 'reviewing', matchScore: 92 }, { id: 'a-2', job: demoJobs[2], candidateId: 'u-1', appliedAt: 'منذ أسبوع', status: 'shortlisted', matchScore: 76 }];

// ─── API wrapper with auth token storage and demo fallback ─────────────────

function getToken(): string | null {
  return localStorage.getItem('hime_ai_token');
}

/** Error carrying the HTTP status so callers can branch on 404/403 etc. */
export class ApiError extends Error {
  readonly status: number;
  /** The server's own message (e.g. rate-limit wording), when provided. */
  readonly detail?: string;
  /** Seconds until a rate limit resets, when the server says so. */
  readonly retryAfter?: number;
  constructor(message: string, status: number, detail?: string, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
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
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
      retryAfter?: number;
    };
    throw new ApiError(
      body.error || `Request failed: ${response.status}`,
      response.status,
      body.message,
      typeof body.retryAfter === 'number' ? body.retryAfter : undefined,
    );
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
    const jobs = Array.isArray(res) ? res : res.jobs ?? [];
    return jobs.flatMap((job) => mapApiJob(job as unknown as RawJob) ?? []);
  }
  await wait();
  const q = filters?.search?.toLowerCase() || '';
  return demoJobs.filter((job) => {
    const q = filters?.search?.toLowerCase() || '';
    return (!q || `${job.title} ${job.industry} ${job.requiredSkills.map((s: { name: string }) => s.name).join(' ')}`.toLowerCase().includes(q)) && (!filters?.location || job.location.includes(filters.location)) && (!filters?.industry || job.industry === filters.industry) && (!filters?.contract || job.contract === filters.contract);
  });
}

export async function getJob(id: string) {
  if (hasApi()) {
    const job = await apiRequest<Job>(`/jobs/${id}`);
    return mapApiJob(job as unknown as RawJob);
  }
  await wait();
  return demoJobs.find((job) => job.id === id) || null;
}

// ─── Jobs-page ranking (sort → rate → order) ──────────────────────────────

export interface JobRankingEntry {
  jobId: string;
  /** Stage 1 — deterministic profile rule-engine score (all jobs have it). */
  profileScore: number;
  /** Stage 2 — mean AI fit rating across models, or null when unrated. */
  aiScore: number | null;
  /** Stage 3 — the blended score the final ordering was sorted by. */
  finalScore: number;
  modelRatings: Record<string, { rating: number; reason: string }> | null;
}

export interface JobsRanking {
  stages: {
    sorting: { engine: string; evaluated: number };
    rating: { status: 'complete' | 'partial' | 'unavailable'; models: string[]; requested: number; rated: number; error?: string };
    ordering: { basis: string };
  };
  /** The server's final order — index 0 is the best-fit job. */
  jobs: JobRankingEntry[];
}

/**
 * The /jobs pipeline for a signed-in seeker. Returns null in demo mode — the
 * ranking is a real-API feature and the demo personas have no CV behind them.
 * Throws on HTTP/network failure so the page can show an honest note instead
 * of silently falling back.
 */
export async function jobsRanking(): Promise<JobsRanking | null> {
  if (!hasApi()) return null;
  return apiRequest<JobsRanking>('/ai/jobs-ranking', { method: 'GET' });
}

// ─── Candidate ────────────────────────────────────────────────────────────

/**
 * The API returns the raw row: nullable columns arrive as `null`, `phone`
 * lives on the account (added to the response since it has no home on the
 * candidate table), and work preferences use the server's shape
 * (`contractTypes: string[]`) rather than ours (a single `contract`).
 * Normalize to the UI contract so every form field is controlled and the
 * edit → save round trip maps back correctly.
 */
type ApiProfile = Omit<CandidateProfile, 'headline' | 'summary' | 'location' | 'phone' | 'preferences'> & {
  headline: string | null;
  summary: string | null;
  location: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  preferences?: { industries?: string[]; contractTypes?: string[]; remote?: boolean; salaryMin?: number | null } | null;
};

const CONTRACT_TYPES: readonly string[] = ['full-time', 'part-time', 'contract', 'internship'];

function normalizeProfile(raw: ApiProfile): CandidateProfile {
  const prefs = raw.preferences ?? {};
  const storedContract = prefs.contractTypes?.[0];
  return {
    ...raw,
    headline: raw.headline ?? '',
    summary: raw.summary ?? '',
    location: raw.location ?? '',
    phone: raw.phone ?? '',
    avatarUrl: raw.avatarUrl ?? null,
    coverUrl: raw.coverUrl ?? null,
    yearsExperience: raw.yearsExperience ?? null,
    // Payloads from before the privacy/alerts columns default them open.
    visibleToCompanies: raw.visibleToCompanies ?? true,
    jobAlerts: raw.jobAlerts ?? true,
    skills: raw.skills ?? [],
    experiences: raw.experiences ?? [],
    education: raw.education ?? [],
    projects: raw.projects ?? [],
    certifications: raw.certifications ?? [],
    preferences: {
      industries: prefs.industries ?? [],
      locations: [],
      contract: CONTRACT_TYPES.includes(storedContract ?? '')
        ? storedContract as ContractType
        : 'full-time',
      remote: prefs.remote ?? false,
      salaryMin: prefs.salaryMin ?? null,
    },
  };
}

export async function getProfile() {
  if (hasApi()) return normalizeProfile(await apiRequest<ApiProfile>('/candidates/profile'));
  await wait();
  return demoProfile;
}

export async function updateProfile(data: Partial<CandidateProfile>): Promise<WithReassessment<CandidateProfile>> {
  if (hasApi()) {
    // The API stores the contract preference as `contractTypes: string[]` —
    // map the UI's single selection across. `preferences` is only sent when
    // present, so partial updates (e.g. skills-only) leave it untouched.
    const { preferences, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (preferences) {
      body.preferences = {
        industries: preferences.industries ?? [],
        contractTypes: preferences.contract ? [preferences.contract] : [],
        remote: preferences.remote ?? false,
        // The salary expectation only crosses the wire when set — an explicit
        // null clears it server-side.
        ...(typeof preferences.salaryMin === 'number' ? { salaryMin: preferences.salaryMin } : {}),
      };
    }
    return apiRequest<WithReassessment<CandidateProfile>>('/candidates/profile', { method: 'PATCH', body: JSON.stringify(body) });
  }
  await wait();
  Object.assign(demoProfile, data);
  return demoProfile;
}

/**
 * Prefixes a stored file path (e.g. an avatar URL) with the API origin.
 * <img> sources don't pass through apiRequest's baseUrl handling, so they
 * need the same treatment the fetch calls get.
 */
export function fileSrc(path?: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return `${base}${path}`;
}

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadAvatar(file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('الصيغ المدعومة: JPG أو PNG أو WebP.');
  if (file.size > AVATAR_MAX_BYTES) throw new Error('حجم الصورة أكبر من 5 ميغابايت.');
  if (hasApi()) {
    const form = new FormData();
    form.append('file', file);
    const data = await apiRequest<{ avatarUrl: string }>('/candidates/photo', { method: 'POST', body: form });
    return data.avatarUrl;
  }
  await wait();
  // Local fallback: a clearly-generic placeholder, never a fake portrait.
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1b4fd8"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#ffffff" font-family="sans-serif">HI</text></svg>',
  );
}

export async function removeAvatar(): Promise<void> {
  if (hasApi()) {
    await apiRequest<void>('/candidates/photo', { method: 'DELETE' });
    return;
  }
  await wait();
  demoProfile.avatarUrl = null;
}

// ─── Profile cover photo ──────────────────────────────────────────────────

/**
 * The cover is stored on the candidate row and served publicly through the
 * avatars route. Same size/type rules as the avatar; the response's
 * coverUrl feeds straight into the profile state.
 */
export async function uploadCover(file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('الصيغ المدعومة: JPG أو PNG أو WebP.');
  if (file.size > AVATAR_MAX_BYTES) throw new Error('حجم الصورة أكبر من 5 ميغابايت.');
  if (hasApi()) {
    const form = new FormData();
    form.append('file', file);
    const data = await apiRequest<{ coverUrl: string }>('/candidates/cover', { method: 'POST', body: form });
    return data.coverUrl;
  }
  await wait();
  // Demo mode has no file storage: a locally-generated gradient stand-in.
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b4fd8"/><stop offset="1" stop-color="#3f6fe0"/></linearGradient></defs><rect width="640" height="160" fill="url(#g)"/></svg>',
  );
}

export async function removeCover(): Promise<void> {
  if (hasApi()) {
    await apiRequest<void>('/candidates/cover', { method: 'DELETE' });
    return;
  }
  await wait();
  demoProfile.coverUrl = null;
}

// ─── Profile sections (experience / education / projects / certifications) ──

export interface ExperienceInput { role: string; company: string; location?: string; description?: string; startDate: string; endDate?: string; current?: boolean; }
export interface EducationInput { degree: string; field?: string; institution: string; year: number; }
export interface ProjectInput { name: string; description?: string; url?: string; }
export interface CertificationInput { name: string; issuer?: string; year?: number; }

/** What the server re-evaluated after a profile change (see API reassessCandidate). */
export interface Reassessment { completion: number; reassessedMatches: number; changedMatches: number; }
export type WithReassessment<T> = T & { reassessment?: Reassessment };

export async function addExperience(input: ExperienceInput): Promise<WithReassessment<Experience>> {
  if (hasApi()) return apiRequest<WithReassessment<Experience>>('/candidates/experience', { method: 'POST', body: JSON.stringify(input) });
  await wait();
  const created = { id: `exp-${Date.now()}`, location: '', description: '', ...input } as Experience;
  demoProfile.experiences = [created, ...demoProfile.experiences];
  return created;
}

export async function addEducation(input: EducationInput): Promise<WithReassessment<Education>> {
  if (hasApi()) return apiRequest<WithReassessment<Education>>('/candidates/education', { method: 'POST', body: JSON.stringify(input) });
  await wait();
  const created = { id: `edu-${Date.now()}`, field: '', ...input } as unknown as Education;
  demoProfile.education = [created, ...demoProfile.education];
  return created;
}

export async function addProject(input: ProjectInput): Promise<WithReassessment<Project>> {
  if (hasApi()) return apiRequest<WithReassessment<Project>>('/candidates/project', { method: 'POST', body: JSON.stringify(input) });
  await wait();
  const created = { id: `prj-${Date.now()}`, skills: [], ...input } as Project;
  demoProfile.projects = [created, ...demoProfile.projects];
  return created;
}

export async function addCertification(input: CertificationInput): Promise<WithReassessment<Certification>> {
  if (hasApi()) return apiRequest<WithReassessment<Certification>>('/candidates/certification', { method: 'POST', body: JSON.stringify(input) });
  await wait();
  const created = { id: `cert-${Date.now()}`, issuer: '', ...input } as unknown as Certification;
  demoProfile.certifications = [created, ...demoProfile.certifications];
  return created;
}

// ─── Section item editing (update / delete) ────────────────────────────────
// Every item the seeker adds is also editable and removable — an add-only
// profile locks mistakes in. All four kinds answer with the same reassessment
// payload a save does.

export async function updateExperience(id: string, input: ExperienceInput): Promise<WithReassessment<Experience>> {
  if (hasApi()) return apiRequest<WithReassessment<Experience>>(`/candidates/experience/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  await wait();
  const updated = { ...input, id } as Experience;
  demoProfile.experiences = demoProfile.experiences.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function updateEducation(id: string, input: EducationInput): Promise<WithReassessment<Education>> {
  if (hasApi()) return apiRequest<WithReassessment<Education>>(`/candidates/education/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  await wait();
  const updated = { ...input, id } as unknown as Education;
  demoProfile.education = demoProfile.education.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function updateProject(id: string, input: ProjectInput): Promise<WithReassessment<Project>> {
  if (hasApi()) return apiRequest<WithReassessment<Project>>(`/candidates/project/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  await wait();
  const updated = { ...input, id, skills: [] } as Project;
  demoProfile.projects = demoProfile.projects.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function updateCertification(id: string, input: CertificationInput): Promise<WithReassessment<Certification>> {
  if (hasApi()) return apiRequest<WithReassessment<Certification>>(`/candidates/certification/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  await wait();
  const updated = { ...input, id } as unknown as Certification;
  demoProfile.certifications = demoProfile.certifications.map((item) => (item.id === id ? updated : item));
  return updated;
}

export type SectionKind = 'experience' | 'education' | 'project' | 'certification';

const SECTION_LIST_KEYS: Record<SectionKind, 'experiences' | 'education' | 'projects' | 'certifications'> = {
  experience: 'experiences',
  education: 'education',
  project: 'projects',
  certification: 'certifications',
};

export async function deleteSectionItem(kind: SectionKind, id: string): Promise<WithReassessment<{ deleted: true }>> {
  if (hasApi()) return apiRequest<WithReassessment<{ deleted: true }>>(`/candidates/${kind}/${id}`, { method: 'DELETE' });
  await wait();
  const lists = demoProfile as unknown as Record<string, Array<{ id: string }>>;
  const key = SECTION_LIST_KEYS[kind];
  lists[key] = lists[key].filter((item) => item.id !== id);
  return { deleted: true };
}

/**
 * Asks the AI to write the professional summary from the seeker's stored CV —
 * only ever on this explicit call, never on its own.
 */
export async function generateSummary(): Promise<{ summary: string } & WithReassessment<{ completion: number }>> {
  if (hasApi()) {
    return apiRequest<{ summary: string } & WithReassessment<{ completion: number }>>('/candidates/profile/summary-ai', { method: 'POST' });
  }
  await wait(600);
  return { summary: 'ملخص مهني مُولّد من محتوى السيرة الذاتية (وضع العرض).', completion: demoProfile.completion };
}

/** What the reset rebuilt, per section, plus what the reassessment found. */
export interface ResetProfileResult extends WithReassessment<{ completion: number }> {
  summaryGenerated?: boolean;
  applied: { skills: number; experiences: number; education: number; projects: number; certifications: number };
}

/**
 * Resets every CV-derived part of the profile (headline, summary, skills,
 * experience, education, projects, certifications) and rebuilds it from the
 * stored CV. Name, photo and personal info are kept — server-side guarantee,
 * the endpoint only touches CV-derived content. Callers re-fetch the profile
 * afterwards; the rebuild lists live there.
 */
export async function resetProfileFromCv(): Promise<ResetProfileResult> {
  if (hasApi()) {
    return apiRequest<ResetProfileResult>('/candidates/profile/reset-from-cv', { method: 'POST' });
  }
  await wait(1200);
  Object.assign(demoProfile, {
    headline: '',
    summary: 'ملخص مُعاد بناؤه من محتوى السيرة (وضع العرض).',
    skills: [],
    experiences: [],
    education: [],
    projects: [],
    certifications: [],
    completion: 24,
  });
  return {
    completion: 24,
    applied: { skills: 3, experiences: 1, education: 1, projects: 0, certifications: 0 },
    summaryGenerated: true,
    reassessment: { completion: 24, reassessedMatches: 2, changedMatches: 2 },
  };
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

// ─── Match breakdown normalization ─────────────────────────────────────────
// The matching engine answers with nested categories
// ({ skills: { score, matched, missing }, experience: { score }, ... }) while
// older application rows carry flat numbers. The UI renders six flat scores,
// so collapse both shapes here — and produce `null` for anything the engine
// did not compute rather than inventing a percentage.

function scoreOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof (value as { score?: unknown }).score === 'number') {
    return (value as { score: number }).score;
  }
  return null;
}

function toBreakdown(raw: unknown): MatchBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const breakdown: MatchBreakdown = {
    skills: scoreOf(b.skills),
    experience: scoreOf(b.experience),
    education: scoreOf(b.education),
    culture: scoreOf(b.culture),
    location: scoreOf(b.location),
    salary: scoreOf(b.salary),
  };
  return Object.values(breakdown).some((value) => value !== null) ? breakdown : null;
}

const emptyBreakdown = (): MatchBreakdown => ({ skills: null, experience: null, education: null, culture: null, location: null, salary: null });

/** Extracts matched/missing skill names from a nested engine breakdown. */
function skillNames(raw: unknown, key: 'matched' | 'missing'): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  // The engine nests the lists under `skills` ({ skills: { matched, missing } })
  // while older rows carried them flat — accept both, or the chip lists render
  // empty while the explanation (a server string) still looks correct.
  const nested = obj.skills && typeof obj.skills === 'object'
    ? (obj.skills as Record<string, unknown>)[key]
    : undefined;
  const list = Array.isArray(nested) ? nested : obj[key];
  return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : [];
}

const chips = (names: string[]): Skill[] => names.map((name, index) => ({ id: `s-${name}-${index}`, name, category: 'professional' }));

// ─── Recommendations & Applications ─────────────────────────────────────────

/** What GET /ai/recommendations answers: `[{ job: { ..., match } }]`. */
type ApiRecommendation = {
  job: { id: string; title: string; company: string; location: string; match?: ApiMatch };
  match?: ApiMatch;
};
interface ApiMatch { overallScore?: number; explanation?: string; breakdown?: unknown; }

// ─── Match coaching ────────────────────────────────────────────────────────

/** One missing skill together with a concrete plan to close it. */
export interface CoachGap { skill: string; advice: string; cvTip: string; }

/** The AI plan that turns a recommendation into profile/CV actions. */
export interface MatchCoach {
  summary: string;
  gaps: CoachGap[];
  showcase: { skill: string; cvTip: string }[];
}

/**
 * Asks the AI how this seeker can raise their match for one job: how to gain
 * each missing skill, and how to showcase the matched ones on the CV.
 */
export async function matchCoach(jobId: string): Promise<MatchCoach> {
  if (hasApi()) return apiRequest<MatchCoach>('/ai/match-coach', { method: 'POST', body: JSON.stringify({ jobId }) });
  await wait();
  return {
    summary: 'يركز خطك أولاً على إبراز مهاراتك الحالية في الملف، ثم إغلاق فجوة واحدة عالية الأثر تباعاً.',
    gaps: [],
    showcase: [],
  };
}

/**
 * Adds one skill to the seeker's profile. PATCH /candidates/profile replaces
 * the whole skill list, so the current profile is fetched and merged first —
 * nothing the seeker already has may be dropped.
 */
export async function addProfileSkill(name: string): Promise<string[]> {
  const key = name.trim().toLowerCase();
  const merge = (skills: Skill[]): Skill[] =>
    skills.some((s) => s.name.trim().toLowerCase() === key)
      ? skills
      : [...skills, { id: `s-${name}`, name, category: 'professional' }];

  if (hasApi()) {
    const current = (await getProfile()).skills ?? [];
    const next = merge(current);
    if (next.length !== current.length) await updateProfile({ skills: next });
    return next.map((s) => s.name);
  }
  await wait();
  demoProfile.skills = merge(demoProfile.skills);
  return demoProfile.skills.map((s) => s.name);
}

export async function recommendations(): Promise<MatchResult[]> {
  if (hasApi()) {
    // On the live endpoint `match` lives INSIDE `job` — reading it off the
    // top level throws and strands this page in an error state.
    const data = await apiRequest<ApiRecommendation[]>('/ai/recommendations');
    return data.flatMap((item) => {
      const match = item.match ?? item.job.match;
      const breakdown = toBreakdown(match?.breakdown);
      if (!match || typeof match.overallScore !== 'number' || !breakdown) return [];
      return [{
        id: `m-${item.job.id}`,
        jobId: item.job.id,
        jobTitle: item.job.title,
        score: match.overallScore,
        breakdown,
        matchedSkills: chips(skillNames(match.breakdown, 'matched')),
        missingSkills: chips(skillNames(match.breakdown, 'missing')),
        relevantExperience: [],
        relevantProjects: [],
        explanation: match.explanation || '',
      } satisfies MatchResult];
    });
  }
  await wait();
  return demoRecommendations;
}

export async function applications() {
  if (hasApi()) {
    const data = await apiRequest<Application[]>('/applications/my');
    return (Array.isArray(data) ? data : []).map((app) => mapApiApplication(app as unknown as Record<string, unknown>));
  }
  await wait();
  return demoApplications;
}

export async function apply(jobId: string, options: { mode?: 'quick' | 'detailed'; answers?: Record<string, string> } = {}) {
  const mode = options.mode ?? 'quick';
  if (hasApi()) {
    const app = await apiRequest<Application & { missing?: string[] }>('/applications', {
      method: 'POST',
      body: JSON.stringify({ jobId, mode, ...(mode === 'detailed' ? { answers: options.answers ?? {} } : {}) }),
    });
    return mapApiApplication(app as unknown as Record<string, unknown>);
  }
  await wait();
  const job = demoJobs.find((item) => item.id === jobId);
  if (!job) throw new Error('Job not found');
  const item: Application = { id: `a-${Date.now()}`, job, candidateId: 'u-1', appliedAt: 'الآن', status: 'applied', matchScore: 84, mode, ...(mode === 'detailed' ? { answers: options.answers ?? {} } : {}) };
  demoApplications.unshift(item);
  return item;
}

// ─── Company ───────────────────────────────────────────────────────────────

export async function getCompanyJobs() {
  if (hasApi()) {
    // /companies/me/jobs resolves the company from the session, saving a
    // round trip and avoiding a 404 when the id isn't known up front.
    const data = await apiRequest<Job[]>('/companies/me/jobs');
    return (Array.isArray(data) ? data : []).flatMap((job) => mapApiJob(job as unknown as RawJob) ?? []);
  }
  await wait();
  return demoJobs.filter((job) => job.companyId === demoCompany.id);
}

// ─── AI job draft ────────────────────────────────────────────────────────

/** Structured draft the posting wizard fills from a pasted ad or a role hint. */
export interface AiJobDraft {
  title: string;
  description: string;
  industry: string;
  location: string;
  contractType: 'full-time' | 'part-time' | 'contract' | 'internship';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead';
  salaryMin: number | null;
  salaryMax: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
}

/**
 * Asks the AI to turn a pasted job advertisement (or just a position title
 * plus wanted experience) into a fill-in draft for the posting wizard.
 */
export async function parseJobAd(input: { adText?: string; position?: string; experienceYears?: number }): Promise<AiJobDraft> {
  if (hasApi()) return apiRequest<AiJobDraft>('/ai/parse-job-ad', { method: 'POST', body: JSON.stringify(input) });
  await wait();
  // Offline demo: a clearly template draft built from whatever was provided.
  const title = input.position?.trim() || input.adText?.trim().split('\n')[0]?.slice(0, 80) || 'دور جديد';
  const years = input.experienceYears;
  return {
    title,
    description: `${title}${years != null ? ` بخبرة ${years} سنوات` : ''}. (مسودة تجريبية — في الوضع المتصل يستخرج النظام الحقول من إعلانك.)`,
    industry: 'تقنية المعلومات',
    location: 'الرياض، السعودية',
    contractType: 'full-time',
    experienceLevel: years == null ? 'mid' : years <= 2 ? 'entry' : years <= 5 ? 'mid' : 'senior',
    salaryMin: null,
    salaryMax: null,
    requiredSkills: [],
    preferredSkills: [],
  };
}

/**
 * The salary field is free text ("18,000", "10000 ر.س"); publish only needs
 * the number. Number("18,000") is NaN — strip separators instead so any
 * human phrasing survives the round trip.
 */
function salaryToNumber(value?: string): number | undefined {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

export async function createJob(input: Partial<Job>) {
  if (hasApi()) {
    const job = await apiRequest<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        industry: input.industry,
        location: input.location,
        contractType: input.contract,
        experienceLevel: input.experience,
        salaryMin: salaryToNumber(input.salary),
        salaryMax: undefined,
        deadline: input.deadline,
        requiredSkills: input.requiredSkills || [],
        preferredSkills: input.preferredSkills || [],
        applicationForm: input.applicationForm ?? [],
      }),
    });
    return mapApiJob(job as unknown as RawJob)!;
  }
  await wait();
  const newJob = makeJob(`j-${Date.now()}`, input.title || 'وظيفة جديدة', demoCompany, { applicationForm: input.applicationForm, ...input });
  demoJobs.unshift(newJob);
  return newJob;
}

export async function updateJob(id: string, input: Partial<Job>) {
  if (hasApi()) {
    const job = await apiRequest<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    return mapApiJob(job as unknown as RawJob)!;
  }
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

/** What GET /applications/job/:jobId answers (application joined with its match snapshot). */
type ApiJobApplication = {
  id: string;
  status: ApplicationStatus;
  matchScore?: number | null;
  matchBreakdown?: unknown;
  aiExplanation?: string | null;
  mode?: 'quick' | 'detailed';
  cvUrl?: string | null;
  answers?: Record<string, string> | null;
  job?: Job;
  candidate: {
    id: string;
    name?: string;
    headline?: string | null;
    location?: string | null;
    completion?: number;
    cvParsedData?: unknown;
  } | null;
};

export async function candidates(jobId: string) {
  if (hasApi()) {
    const data = await apiRequest<ApiJobApplication[]>(`/applications/job/${jobId}`);
    return data.flatMap((app) => {
      // Orphan rows have no profile to render — skip rather than crash .slice().
      if (!app.candidate) return [];
      return [{
        id: app.candidate.id,
        name: app.candidate.name || app.candidate.headline || 'مرشح',
        headline: app.candidate.headline || '',
        location: app.candidate.location || '',
        completion: app.candidate.completion ?? 0,
        cvAnalyzed: app.candidate.cvParsedData != null,
        score: typeof app.matchScore === 'number' ? app.matchScore : 0,
        job: app.job ? mapApiJob(app.job as unknown as RawJob) ?? undefined : undefined,
        breakdown: toBreakdown(app.matchBreakdown) ?? emptyBreakdown(),
        matchedSkills: chips(skillNames(app.matchBreakdown, 'matched')),
        missingSkills: chips(skillNames(app.matchBreakdown, 'missing')),
        explanation: app.aiExplanation || '',
        status: app.status,
        // How the candidate applied — quick (CV + profile) or detailed
        // (the company's own form answers).
        applicationMode: (app.mode ?? 'quick') as 'quick' | 'detailed',
        applicationCvUrl: app.cvUrl ?? null,
        applicationAnswers: (app.answers ?? null) as Record<string, string> | null,
      }];
    });
  }
  await wait();
  const job = demoJobs.find((item) => item.id === jobId) || demoJobs[0];
  return [{ id: 'u-8', name: 'سارة الحربي', headline: 'Product Designer', location: 'الرياض، السعودية', completion: 82, cvAnalyzed: true, score: 94, job, breakdown: { skills: 96, experience: 91, education: 90, culture: 88, location: 95, salary: 85 }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), explanation: 'مهارات المرشح تغطي متطلبات الدور الأساسية مع خبرة قوية في التصميم.', status: 'shortlisted' as ApplicationStatus, applicationMode: 'quick' as const, applicationCvUrl: '/files/demo-cv.pdf', applicationAnswers: null }, { id: 'u-9', name: 'عمر الغامدي', headline: 'UX Researcher', location: 'جدة، السعودية', completion: 74, cvAnalyzed: true, score: 86, job, breakdown: { skills: 88, experience: 84, education: 89, culture: 82, location: 70, salary: 80 }, matchedSkills: job.requiredSkills.slice(0, 1), missingSkills: job.requiredSkills.slice(1), explanation: 'ملف قوي في الأبحاث مع فجوات في بعض المهارات المطلوبة.', status: 'reviewing' as ApplicationStatus, applicationMode: 'detailed' as const, applicationCvUrl: null, applicationAnswers: { 'f-experience': '6', 'f-case': 'أعدت بنية قائمة قياس داخلكم فخفضت زمن الاستشارة من أسبوع إلى يومين.' } }];
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

export async function listCompaniesForReview(status?: VerificationStatus, page = 1, limit = 50) {
  if (hasApi()) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('limit', String(limit));
    // GET /admin/companies returns { items, pagination }; tolerate the old
    // bare-array shape so fixtures and older servers keep working.
    const res = await apiRequest<AdminCompany[] | { items: AdminCompany[] }>(`/admin/companies?${params}`);
    return Array.isArray(res) ? res : res.items ?? [];
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

// ─── Platform-wide applications & seekers (admin) ──────────────────────────

/** Application joined with its job and the candidate's user (real name). */
export interface AdminApplication extends Application {
  candidateName: string;
}

/**
 * GET /admin/applications answers `{ items, pagination }` with the candidate
 * joined through users for the real name. The previous version called
 * /applications/my (seeker-scoped -> 403 for an admin) and rendered a
 * hardcoded candidate name.
 */
export async function adminApplications(): Promise<AdminApplication[]> {
  if (hasApi()) {
    const res = await apiRequest<AdminApplication[] | { items: AdminApplication[] }>('/admin/applications');
    const items = Array.isArray(res) ? res : res.items ?? [];
    return items.map((item) => {
      const mapped = mapApiApplication(item as unknown as Record<string, unknown>) as AdminApplication;
      const candidate = (item as unknown as { candidate?: { name?: string; headline?: string | null; user?: { name?: string } | null } }).candidate;
      return {
        ...mapped,
        candidateName: candidate?.user?.name || candidate?.name || candidate?.headline || '—',
      };
    });
  }
  await wait();
  return demoApplications.map((item) => ({ ...item, candidateName: 'ليان العتيبي' }));
}

export interface AdminCandidate {
  id: string;
  candidateId: string | null;
  name: string;
  email: string;
  headline: string | null;
  completion: number;
  cvStatus: 'analyzed' | 'pending';
  applications: number;
  isActive: boolean;
}

/** GET /admin/candidates — every seeker account with profile health. */
export async function adminCandidates(): Promise<AdminCandidate[]> {
  if (hasApi()) {
    const res = await apiRequest<AdminCandidate[] | { items: AdminCandidate[] }>('/admin/candidates');
    return Array.isArray(res) ? res : res.items ?? [];
  }
  await wait();
  return [
    { id: 'u-1', candidateId: 'p-1', name: 'ليان العتيبي', email: 'layan@example.com', headline: demoProfile.headline, completion: demoProfile.completion, cvStatus: 'analyzed', applications: demoApplications.length, isActive: true },
  ];
}

// ─── Notifications ───────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export async function notifications() {
  if (hasApi()) {
    return apiRequest<{ notifications: AppNotification[]; unreadCount: number }>('/notifications');
  }
  await wait(120);
  return { notifications: [] as AppNotification[], unreadCount: 0 };
}

export async function markNotificationRead(id: string): Promise<void> {
  if (hasApi()) {
    await apiRequest<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH' });
    return;
  }
  await wait(80);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (hasApi()) {
    await apiRequest<void>('/notifications/read-all', { method: 'POST' });
    return;
  }
  await wait(80);
}

// ─── Company funnel (real numbers from applications) ─────────────────────

export interface FunnelSummary {
  total: number;
  applied: number;
  reviewing: number;
  shortlisted: number;
  interview: number;
  rejected: number;
  accepted: number;
  avgMatch: number | null;
}

export interface CompanyFunnel {
  jobs: Array<{ jobId: string; title: string; status: string } & FunnelSummary>;
  totals: FunnelSummary;
}

export async function companyFunnel(): Promise<CompanyFunnel> {
  if (hasApi()) return apiRequest<CompanyFunnel>('/companies/me/funnel');
  await wait(200);
  return {
    jobs: [],
    totals: { total: 0, applied: 0, reviewing: 0, shortlisted: 0, interview: 0, rejected: 0, accepted: 0, avgMatch: null },
  };
}

// ─── Password reset & email verification ─────────────────────────────────

export async function forgotPassword(email: string) {
  return apiRequest<{ ok: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiRequest<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmail(token: string) {
  return apiRequest<{ ok: boolean }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string) {
  return apiRequest<{ ok: boolean; message: string }>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
