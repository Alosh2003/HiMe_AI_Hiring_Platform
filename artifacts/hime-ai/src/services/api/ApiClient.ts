import type { Application, ApplicationStatus, CandidateProfile, Company, Job, MatchResult, User } from '@/types';

export class ApiClient {
  readonly baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers }, ...options });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
  register(payload: { name: string; email: string; password: string; role: string }) { return this.request<User>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }); }
  login(payload: { email: string; password: string }) { return this.request<User>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }); }
  logout() { return this.request<void>('/auth/logout', { method: 'POST' }); }
  me() { return this.request<User>('/me'); }
  listJobs(params?: Record<string, string>) { return this.request<Job[]>(`/jobs${params ? `?${new URLSearchParams(params)}` : ''}`); }
  getJob(id: string) { return this.request<Job>(`/jobs/${id}`); }
  getSeekerProfile() { return this.request<CandidateProfile>('/seeker/profile'); }
  updateSeekerProfile(payload: Partial<CandidateProfile>) { return this.request<CandidateProfile>('/seeker/profile', { method: 'PUT', body: JSON.stringify(payload) }); }
  uploadCv(metadata: { name: string; size: number }) { return this.request<{ status: string; name: string }>('/seeker/cv', { method: 'POST', body: JSON.stringify(metadata) }); }
  getRecommendations() { return this.request<MatchResult[]>('/seeker/recommendations'); }
  getApplications() { return this.request<Application[]>('/seeker/applications'); }
  createJob(payload: Partial<Job>) { return this.request<Job>('/jobs', { method: 'POST', body: JSON.stringify(payload) }); }
  updateJob(id: string, payload: Partial<Job>) { return this.request<Job>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); }
  deleteJob(id: string) { return this.request<void>(`/jobs/${id}`, { method: 'DELETE' }); }
  getCompanyJobs() { return this.request<Job[]>('/company/jobs'); }
  getCandidates(jobId: string) { return this.request<MatchResult[]>(`/company/jobs/${jobId}/candidates`); }
  applyToJob(jobId: string) { return this.request<Application>(`/jobs/${jobId}/apply`, { method: 'POST' }); }
  updateApplicationStatus(id: string, status: ApplicationStatus) { return this.request<Application>(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
}

const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));
const skills = (names: string[]): import('@/types').Skill[] => names.map((name, index) => ({ id: `${name.toLowerCase().replaceAll(' ', '-')}-${index}`, name, category: 'professional' }));
const company: Company = { id: 'c-1', name: 'مِداد للتقنية', industry: 'تقنية المعلومات', location: 'الرياض، السعودية', website: 'medad.example', description: 'نبني أدوات تجعل العمل العربي أكثر وضوحاً وإنسانية.', teamSize: '51–200', verified: true };
const companies: Company[] = [company, { id: 'c-2', name: 'سِراج المالية', industry: 'التقنية المالية', location: 'دبي، الإمارات', website: 'siraj.example', description: 'منصة مالية رقمية للجيل القادم.', teamSize: '11–50', verified: true }, { id: 'c-3', name: 'أثر للاستشارات', industry: 'الاستشارات', location: 'جدة، السعودية', website: 'athar.example', description: 'نحو قرارات أعمال أفضل في المنطقة.', teamSize: '51–200', verified: false }];
const makeJob = (id: string, title: string, c: Company, extra: Partial<Job> = {}): Job => ({ id, companyId: c.id, company: c, title, description: 'نبحث عن شخص شغوف يبني منتجات مؤثرة ويحوّل المسائل المعقدة إلى تجارب بسيطة. ستعمل مع فريق متعدد التخصصات في بيئة تتعلم فيها كل يوم.', industry: c.industry, location: c.location, contract: 'full-time', experience: 'mid', education: 'بكالوريوس أو خبرة معادلة', requiredSkills: skills(['Product strategy', 'Research', 'Communication']), preferredSkills: skills(['Analytics', 'Figma']), salary: '18,000 – 24,000 ر.س', deadline: '2025-06-30', postedAt: 'منذ يومين', applicants: 24, status: 'active', ...extra });
const jobs: Job[] = [makeJob('j-1', 'مصمم تجربة مستخدم أول', company, { requiredSkills: skills(['Figma', 'User research', 'Arabic UX']), preferredSkills: skills(['Design systems', 'Prototyping']), experience: 'senior', applicants: 18 }), makeJob('j-2', 'مدير منتج — منصات الذكاء الاصطناعي', companies[1], { requiredSkills: skills(['Product strategy', 'AI products', 'Roadmapping']), preferredSkills: skills(['B2B SaaS', 'Analytics']), salary: '22,000 – 30,000 ر.س', applicants: 31 }), makeJob('j-3', 'مهندس واجهات أمامية', company, { requiredSkills: skills(['React', 'TypeScript', 'CSS']), preferredSkills: skills(['Testing', 'Accessibility']), location: 'الرياض أو عن بعد', applicants: 42 }), makeJob('j-4', 'كاتب محتوى تقني', companies[2], { requiredSkills: skills(['Arabic writing', 'Content strategy', 'SEO']), preferredSkills: skills(['English', 'B2B']), contract: 'contract', experience: 'entry', salary: '9,000 – 13,000 ر.س', applicants: 12 })];
const experiences = [{ id: 'e-1', role: 'مصمم منتجات', company: 'ستوديو رِواق', location: 'الرياض', startDate: '2021', endDate: 'الآن', description: 'تصميم تجارب رقمية لمنتجات مالية وتعليمية.' }];
const profile: CandidateProfile = { id: 'p-1', userId: 'u-1', headline: 'مصمم منتجات يهتم بما يشعر به الناس', summary: 'أصمم منتجات رقمية عربية واضحة، من البحث إلى الإطلاق، مع اهتمام خاص بإمكانية الوصول واللغة.', location: 'الرياض، السعودية', phone: '+966 50 123 4567', skills: skills(['Figma', 'User research', 'Arabic UX', 'Design systems', 'Prototyping']), experiences, education: [{ id: 'ed-1', institution: 'جامعة الملك سعود', degree: 'بكالوريوس', field: 'تصميم الوسائط الرقمية', year: '2020' }], projects: [{ id: 'pr-1', name: 'مَسار', description: 'تجربة تخطيط مالي للشباب.', skills: ['Research', 'Figma'] }], certifications: [{ id: 'cert-1', name: 'Google UX Design', issuer: 'Google', year: '2022' }], completion: 82, cvStatus: 'analyzed', preferences: { industries: ['تقنية المعلومات'], locations: ['الرياض', 'عن بعد'], contract: 'full-time', remote: true } };
const recommendations: MatchResult[] = jobs.slice(0, 3).map((job, i) => ({ id: `m-${i}`, jobId: job.id, candidateId: 'u-1', score: [92, 87, 76][i], breakdown: { skills: [94, 84, 71][i], experience: [90, 91, 74][i], education: [92, 86, 78][i], projects: [88, 82, 71][i], certifications: [89, 75, 66][i], semantic: [95, 91, 80][i] }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), relevantExperience: experiences, relevantProjects: profile.projects, explanation: 'خبرتك في تصميم المنتجات والبحث النوعي تتقاطع بوضوح مع متطلبات الدور.' }));
const applications: Application[] = [{ id: 'a-1', job: jobs[0], candidateId: 'u-1', appliedAt: 'منذ 3 أيام', status: 'reviewing', matchScore: 92 }, { id: 'a-2', job: jobs[2], candidateId: 'u-1', appliedAt: 'منذ أسبوع', status: 'shortlisted', matchScore: 76 }];

export const demoApi = {
  async listJobs(filters?: { search?: string; location?: string; industry?: string; contract?: string }) { await wait(); const q = filters?.search?.toLowerCase() || ''; return jobs.filter((job) => (!q || `${job.title} ${job.industry} ${job.requiredSkills.map((s) => s.name).join(' ')}`.toLowerCase().includes(q)) && (!filters?.location || job.location.includes(filters.location)) && (!filters?.industry || job.industry === filters.industry) && (!filters?.contract || job.contract === filters.contract)); },
  async getJob(id: string) { await wait(); return jobs.find((job) => job.id === id) || null; },
  async getProfile() { await wait(); return profile; },
  async updateProfile(data: Partial<CandidateProfile>) { await wait(); Object.assign(profile, data); return profile; },
  async uploadCv(file: { name: string; size: number }) { await wait(750); profile.cvStatus = 'analyzed'; return { ...file, status: 'analyzed' as const, extractedAt: 'الآن' }; },
  async recommendations() { await wait(); return recommendations; },
  async applications() { await wait(); return applications; },
  async apply(jobId: string) { await wait(); const job = jobs.find((item) => item.id === jobId); if (!job) throw new Error('Job not found'); const item = { id: `a-${Date.now()}`, job, candidateId: 'u-1', appliedAt: 'الآن', status: 'applied' as const, matchScore: 84 }; applications.unshift(item); return item; },
  async getCompanyJobs() { await wait(); return jobs.filter((job) => job.companyId === company.id); },
  async createJob(input: Partial<Job>) { await wait(); const newJob = makeJob(`j-${Date.now()}`, input.title || 'وظيفة جديدة', company, input); jobs.unshift(newJob); return newJob; },
  async updateJob(id: string, input: Partial<Job>) { await wait(); const found = jobs.find((job) => job.id === id); if (!found) throw new Error('Job not found'); Object.assign(found, input); return found; },
  async deleteJob(id: string) { await wait(); const index = jobs.findIndex((job) => job.id === id); if (index >= 0) jobs.splice(index, 1); },
  async candidates(jobId: string) { await wait(); const job = jobs.find((item) => item.id === jobId) || jobs[0]; return [{ id: 'u-8', name: 'سارة الحربي', headline: 'Product Designer', score: 94, job, breakdown: { skills: 96, experience: 91, education: 90, projects: 94, certifications: 87, semantic: 95 }, matchedSkills: job.requiredSkills.slice(0, 2), missingSkills: job.requiredSkills.slice(2), status: 'shortlisted' as ApplicationStatus }, { id: 'u-9', name: 'عمر الغامدي', headline: 'UX Researcher', score: 86, job, breakdown: { skills: 88, experience: 84, education: 89, projects: 80, certifications: 76, semantic: 90 }, matchedSkills: job.requiredSkills.slice(0, 1), missingSkills: job.requiredSkills.slice(1), status: 'reviewing' as ApplicationStatus }]; },
  async company() { await wait(); return company; },
  async stats() { await wait(); return { candidates: 1248, companies: 86, jobs: 214, applications: 3820 }; },
  async listCompanies() { await wait(); return companies; },
};