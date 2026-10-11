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
