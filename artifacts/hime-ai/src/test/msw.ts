import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';

// ─── Test fixtures ──────────────────────────────────────────────────────────

export const TEST_IDS = {
  job1: 'c14e27ff-7e71-40af-8335-8b28c44852c7',
  job2: 'd14e27ff-7e71-40af-8335-8b28c44852c7',
  candidate1: 'e14e27ff-7e71-40af-8335-8b28c44852c7',
  user1: 'f14e27ff-7e71-40af-8335-8b28c44852c7',
  company1: 'a14e27ff-7e71-40af-8335-8b28c44852c7',
  application1: 'b14e27ff-7e71-40af-8335-8b28c44852c7',
};

const company = {
  id: TEST_IDS.company1,
  userId: TEST_IDS.user1,
  name: 'مِداد للتقنية',
  industry: 'تقنية المعلومات',
  location: 'الرياض، السعودية',
  website: 'medad.example',
  description: 'نبني أدوات تجعل العمل العربي أكثر وضوحاً.',
  verified: true,
  verificationStatus: 'verified',
};

const job = {
  id: TEST_IDS.job1,
  companyId: TEST_IDS.company1,
  company,
  title: 'مصمم تجربة مستخدم أول',
  description: 'نبحث عن مصمم تجربة مستخدم أول شغوف ببناء منتجات رقمية.',
  industry: 'تقنية المعلومات',
  location: 'الرياض، السعودية',
  contractType: 'full-time',
  experienceLevel: 'senior',
  status: 'active',
  applicantsCount: 18,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  requiredSkills: [{ id: 1, name: 'Figma', category: 'technical' }],
  preferredSkills: [{ id: 2, name: 'Prototyping', category: 'professional' }],
};

const candidate = {
  id: TEST_IDS.candidate1,
  userId: TEST_IDS.user1,
  headline: 'مصمم منتجات',
  summary: 'أصمم منتجات رقمية عربية.',
  location: 'الرياض، السعودية',
  yearsExperience: 4,
  completion: 82,
  // The live route derives these from the stored CV row.
  cvUrl: '/files/cv-sample.pdf',
  cvStatus: 'analyzed',
  skills: [{ id: 1, name: 'Figma', category: 'technical', proficiency: 4, yearsExperience: 3 }],
  experiences: [{ id: 'x1', role: 'مصمم منتجات', company: 'ستوديو', location: 'الرياض', startDate: '2021', current: true }],
  education: [{ id: 'ed1', degree: 'بكالوريوس', field: 'تصميم', institution: 'جامعة', year: 2020 }],
  projects: [{ id: 'p1', name: 'مَسار', description: 'تجربة مالية' }],
  certifications: [{ id: 'c1', name: 'Google UX', issuer: 'Google', year: 2022 }],
  preferences: { industries: ['تقنية المعلومات'], locations: ['الرياض'], contract: 'full-time', remote: true },
};

// Re-exported for per-test handler overrides (second job fixtures, etc.).
export const jobFixture = job;
export const companyFixture = company;

const application = {
  id: TEST_IDS.application1,
  jobId: TEST_IDS.job1,
  job,
  candidateId: TEST_IDS.candidate1,
  status: 'reviewing',
  matchScore: 92,
  appliedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Match fixtures mirror the engine's real response shape (nested categories,
// overallScore on top) exactly as api-server/src/ai/engine.ts produces it.
const engineBreakdown = {
  skills: { score: 94, matched: ['Figma', 'User Research'], missing: ['Design Systems'], bonus: [] },
  experience: { score: 90, relevant: ['مصمم منتجات'] },
  education: { score: 92, notes: 'تعليم مناسب' },
  culture: { score: 88, notes: 'توافق جيد' },
  location: { score: 95, notes: 'الموقع مطابق' },
  salary: { score: 91, notes: 'ضمن النطاق' },
};
const apiMatch = { overallScore: 92, breakdown: engineBreakdown, explanation: 'خبرتك تتقاطع مع متطلبات الدور.' };

const authUser = { id: TEST_IDS.user1, email: 'seeker@hime.ai', name: 'ليان العتيبي', role: 'seeker' };
const authToken = 'test-jwt-token';

// ─── Handlers ───────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post('*/api/auth/login', async () => {
    await delay(10);
    return HttpResponse.json({ token: authToken, user: authUser });
  }),
  http.post('*/api/auth/register', async ({ request }) => {
    await delay(10);
    // Echo back the role the visitor actually chose, like the real API does,
    // otherwise a company signup would land on the seeker dashboard.
    const body = (await request.json()) as { name?: string; email?: string; role?: 'seeker' | 'company' };
    const role = body.role === 'company' ? 'company' : 'seeker';
    return HttpResponse.json(
      {
        token: authToken,
        onboarding: true,
        user: { ...authUser, id: role === 'company' ? TEST_IDS.company1 : TEST_IDS.user1, name: body.name ?? authUser.name, email: body.email ?? authUser.email, role },
      },
      { status: 201 },
    );
  }),
  http.get('*/api/auth/me', async () => {
    await delay(10);
    // The live route answers with the user behind the bearer token. In tests
    // that identity lives in localStorage (setRole/login write it), so echo it
    // back — a hardcoded seeker fixture would flip company/admin sessions the
    // moment AuthProvider's background refresh adopts the response.
    let stored: Record<string, unknown> = {};
    try {
      stored = JSON.parse(localStorage.getItem('hime_ai_user') ?? '{}') as Record<string, unknown>;
    } catch {
      /* keep the fixture defaults */
    }
    return HttpResponse.json({ ...authUser, ...stored });
  }),

  // Public CV assessment (no auth)
  http.post('*/api/assess', async () => {
    await delay(50);
    return HttpResponse.json({
      overallScore: 85,
      role: 'Senior Backend Engineer',
      breakdown: {
        skills: { score: 85, matched: ['Node.js', 'PostgreSQL'], missing: ['CI/CD'] },
        experience: { score: 82, years: 5, relevant: ['Senior Backend Engineer'] },
        education: { score: 95, notes: 'Relevant degree with active certification.' },
        presentation: { score: 80, notes: 'Concise with quantified achievements.' },
      },
      strengths: ['Strong backend fundamentals', 'Quantified impact'],
      gaps: ['No testing frameworks', 'No CI/CD experience'],
      recommendations: [
        'Add testing frameworks (Jest/Vitest) to your skills',
        'Detail a CI/CD pipeline you built or improved',
        'Expand bullet points for roles with 5+ years of experience',
      ],
    });
  }),

  // Jobs — the live API wraps the list in { jobs, pagination } after the
  // pagination change. Mirroring that here is what lets the route matrix
  // catch response-shape bugs like the admin/jobs crash.
  http.get('*/api/jobs', async () => {
    await delay(10);
    return HttpResponse.json({ jobs: [job], pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false } });
  }),
  http.get(`*/api/jobs/${TEST_IDS.job1}`, async () => {
    await delay(10);
    return HttpResponse.json(job);
  }),
  http.post('*/api/jobs', async () => {
    await delay(10);
    return HttpResponse.json(job, { status: 201 });
  }),
  http.patch(`*/api/jobs/${TEST_IDS.job1}`, async () => {
    await delay(10);
    return HttpResponse.json(job);
  }),
  http.delete(`*/api/jobs/${TEST_IDS.job1}`, async () => {
    await delay(10);
    return new HttpResponse(null, { status: 204 });
  }),

  // Companies
  http.get('*/api/companies', async () => {
    await delay(10);
    return HttpResponse.json([company]);
  }),
  http.get(`*/api/companies/${TEST_IDS.company1}`, async () => {
    await delay(10);
    return HttpResponse.json({ ...company, jobs: [job] });
  }),
  http.get('*/api/companies/me/profile', async () => {
    await delay(10);
    return HttpResponse.json(company);
  }),
  http.get('*/api/companies/me/jobs', async () => {
    await delay(10);
    return HttpResponse.json([job]);
  }),
  http.get(`*/api/companies/${TEST_IDS.company1}/jobs`, async () => {
    await delay(10);
    return HttpResponse.json([job]);
  }),

  // Company profile + verification workflow
  http.post('*/api/companies/profile', async ({ request }) => {
    await delay(10);
    const body = (await request.json()) as Partial<typeof company>;
    return HttpResponse.json({ ...company, ...body });
  }),
  http.post('*/api/companies/verification/request', async () => {
    await delay(10);
    return HttpResponse.json({ ...company, verificationStatus: 'pending', verificationRequestedAt: new Date().toISOString() });
  }),

  // Admin company review
  http.get('*/api/admin/companies', async () => {
    await delay(10);
    return HttpResponse.json([
      { ...company, verificationStatus: 'pending', contact: { name: 'ليان العتيبي', email: 'company@hime.ai' } },
    ]);
  }),
  http.post(`*/api/admin/companies/${TEST_IDS.company1}/verify`, async () => {
    await delay(10);
    return HttpResponse.json({ ...company, verified: true, verificationStatus: 'verified' });
  }),
  http.post(`*/api/admin/companies/${TEST_IDS.company1}/reject`, async () => {
    await delay(10);
    return HttpResponse.json({ ...company, verified: false, verificationStatus: 'rejected', verificationNote: 'بيانات غير كافية' });
  }),

  // Candidates
  http.get('*/api/candidates/profile', async () => {
    await delay(10);
    return HttpResponse.json(candidate);
  }),
  http.patch('*/api/candidates/profile', async () => {
    await delay(10);
    // Mirrors the real response: the saved profile plus what was reassessed.
    return HttpResponse.json({ ...candidate, completion: 88, reassessment: { completion: 88, reassessedMatches: 2, changedMatches: 1 } });
  }),
  http.post('*/api/candidates/experience', async ({ request }) => {
    await delay(10);
    return HttpResponse.json({ id: 'exp-new', ...(await request.json() as object), completion: 90, reassessment: { completion: 90, reassessedMatches: 2, changedMatches: 1 } }, { status: 201 });
  }),
  http.post('*/api/candidates/education', async ({ request }) => {
    await delay(10);
    return HttpResponse.json({ id: 'edu-new', ...(await request.json() as object), completion: 85, reassessment: { completion: 85, reassessedMatches: 2, changedMatches: 0 } }, { status: 201 });
  }),
  http.post('*/api/candidates/project', async ({ request }) => {
    await delay(10);
    return HttpResponse.json({ id: 'prj-new', ...(await request.json() as object), completion: 87, reassessment: { completion: 87, reassessedMatches: 2, changedMatches: 1 } }, { status: 201 });
  }),
  http.post('*/api/candidates/certification', async ({ request }) => {
    await delay(10);
    return HttpResponse.json({ id: 'cert-new', ...(await request.json() as object), completion: 84, reassessment: { completion: 84, reassessedMatches: 2, changedMatches: 0 } }, { status: 201 });
  }),
  // Section item editing: PUT echoes the stored row, DELETE returns the
  // reassessment exactly like the live routes.
  ...(['experience', 'education', 'project', 'certification'] as const).flatMap((kind) => [
    http.put(`*/api/candidates/${kind}/:id`, async ({ request }) => {
      await delay(10);
      const body = await request.json() as object;
      return HttpResponse.json({ ...body, completion: 82, reassessment: { completion: 82, reassessedMatches: 2, changedMatches: 1 } });
    }),
    http.delete(`*/api/candidates/${kind}/:id`, async () => {
      await delay(10);
      return HttpResponse.json({ deleted: true, completion: 74, reassessment: { completion: 74, reassessedMatches: 2, changedMatches: 1 } });
    }),
  ]),
  http.post('*/api/candidates/profile/summary-ai', async () => {
    await delay(10);
    return HttpResponse.json({ summary: 'ملخص مهني أنشأه الذكاء الاصطناعي من محتوى السيرة المرفوعة.', completion: 88, reassessment: { completion: 88, reassessedMatches: 2, changedMatches: 1 } });
  }),
  http.post('*/api/candidates/profile/reset-from-cv', async () => {
    await delay(10);
    // Mirrors the real response: what got rebuilt, whether the AI wrote the
    // summary, and the reassessment that followed the wipe.
    return HttpResponse.json({
      completion: 46,
      reassessment: { completion: 46, reassessedMatches: 1, changedMatches: 1 },
      summaryGenerated: true,
      applied: { skills: 4, experiences: 2, education: 1, projects: 1, certifications: 1 },
    });
  }),
  http.post('*/api/candidates/photo', async () => {
    await delay(10);
    return HttpResponse.json({ avatarUrl: '/api/avatars/test-avatar.png' }, { status: 201 });
  }),
  http.delete('*/api/candidates/photo', async () => {
    await delay(10);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/candidates/cv', async () => {
    await delay(50);
    // Mirrors the real response: the parsed CV plus the updated profile.
    return HttpResponse.json({
      ...candidate,
      cvUrl: '/files/test.pdf',
      parsed: true,
      cvParsedData: {
        headline: 'مهندس برمجيات أول',
        summary: 'خبرة في بناء أنظمة قابلة للتوسع.',
        skills: ['Node.js', 'PostgreSQL', 'TypeScript', 'React', 'Docker', 'Kubernetes', 'GraphQL'],
        experiences: [{ role: 'System Analyst', company: 'ACME', description: 'Entire systems', startDate: '2023-01', endDate: null }],
        education: [{ degree: 'BSc', field: 'Computer Science', institution: 'KSU', year: 2022 }],
        projects: [{ name: 'Data Pipeline', description: 'Batch pipeline', url: null }],
        certifications: [],
      },
      file: { id: 'f-1', name: 'resume.pdf', url: '/files/test.pdf', size: 1024 },
    });
  }),

  // Applications
  http.post('*/api/applications', async () => {
    await delay(10);
    return HttpResponse.json(application, { status: 201 });
  }),
  http.get('*/api/applications/my', async () => {
    await delay(10);
    return HttpResponse.json([application]);
  }),
  http.get(`*/api/applications/job/${TEST_IDS.job1}`, async () => {
    await delay(10);
    // Shape must match the live endpoint: application columns plus the joined
    // candidate (named from users) and the nested match snapshot that
    // api-server routes/applications.ts GET /job/:jobId enriches in.
    return HttpResponse.json([
      {
        ...application,
        matchScore: 92,
        matchBreakdown: engineBreakdown,
        aiExplanation: apiMatch.explanation,
        candidate: {
          id: TEST_IDS.candidate1,
          name: 'سارة الحربي',
          headline: 'Product Designer',
          location: 'الرياض، السعودية',
          completion: 82,
          cvParsedData: { skills: ['Figma'] },
        },
      },
    ]);
  }),
  http.patch(`*/api/applications/${TEST_IDS.application1}`, async () => {
    await delay(10);
    return HttpResponse.json(application);
  }),

  // AI
  http.get('*/api/ai/recommendations', async () => {
    await delay(10);
    // Live shape nests match inside job (api-server routes/matching.ts).
    return HttpResponse.json([{ job: { id: job.id, title: job.title, company: company.name, location: job.location, match: apiMatch } }]);
  }),
  http.post('*/api/ai/match', async () => {
    await delay(10);
    return HttpResponse.json(apiMatch);
  }),
  // AI job-ad drafting (company posting wizard)
  http.post('*/api/ai/parse-job-ad', async () => {
    await delay(10);
    return HttpResponse.json({
      title: 'محلل بيانات أول',
      description: 'تحليل مجموعات البيانات وبناء لوحات معلومات لدعم قرارات العمل، وتوثيق مناهج التحليل لضمان جودة البيانات.',
      industry: 'تقنية المعلومات',
      location: 'الرياض، السعودية',
      contractType: 'full-time',
      experienceLevel: 'mid',
      salaryMin: 15000,
      salaryMax: 20000,
      requiredSkills: ['SQL', 'Python', 'Power BI', 'Excel', 'ETL', 'Data Modeling', 'Statistics'],
      preferredSkills: ['Airflow'],
    });
  }),
  // AI match coaching (seeker recommendations → profile/CV plan)
  http.post('*/api/ai/match-coach', async () => {
    await delay(10);
    return HttpResponse.json({
      summary: 'ابدأ بإضافة الفجوة عالية الأثر إلى ملفك، ثم أعد صياغة إنجازاتك في السيرة الذاتية وفق نصائح المهارات المطابقة.',
      gaps: [
        {
          skill: 'Design Systems',
          advice: 'ابنِ مكوّنات موحّدة في مشروع شخصي ووثّق قواعدها — دورة تطبيقية على أنظمة التصميم تكفي للبداية.',
          cvTip: 'أبرز أعمالك في Figma وUser Research كأساس قريب من بناء أنظمة التصميم، بدون ادعاء خبرة لا تملكها.',
        },
      ],
      showcase: [
        { skill: 'Figma', cvTip: 'اذكر مشروعاً بأرقام: عدد المكوّنات أو وقت الاختصار الذي حققته.' },
      ],
    });
  }),
  http.get(`*/api/ai/rank/${TEST_IDS.job1}`, async () => {
    await delay(10);
    return HttpResponse.json([{ candidate: { id: candidate.id, name: 'سارة الحربي', headline: 'Product Designer' }, match: apiMatch }]);
  }),
  // Jobs-page ranking: the three-stage pipeline (sort → rate → order).
  http.get('*/api/ai/jobs-ranking', async () => {
    await delay(10);
    return HttpResponse.json({
      stages: {
        sorting: { engine: 'profile-rule-engine', evaluated: 2 },
        rating: { status: 'complete', models: ['qwen2.5:7b'], requested: 2, rated: 2 },
        ordering: { basis: '60% AI rating + 40% profile score' },
      },
      jobs: [
        { jobId: TEST_IDS.job1, profileScore: 70, aiScore: 92, finalScore: 84, modelRatings: { 'qwen2.5:7b': { rating: 92, reason: 'خبرتك مناسبة للدور.' } } },
        { jobId: TEST_IDS.job2, profileScore: 55, aiScore: 40, finalScore: 46, modelRatings: { 'qwen2.5:7b': { rating: 40, reason: 'خبرة أقل من المطلوب.' } } },
      ],
    });
  }),

  // Admin
  http.get('*/api/admin/stats', async () => {
    await delay(10);
    return HttpResponse.json({ candidates: 1248, companies: 86, jobs: 214, applications: 3820 });
  }),
  http.get('*/api/admin/applications', async () => {
    await delay(10);
    return HttpResponse.json([application]);
  }),
  http.get('*/api/admin/candidates', async () => {
    await delay(10);
    // Mirrors the live endpoint: seeker accounts joined with their profile.
    return HttpResponse.json({
      items: [
        { id: 'cand-1', candidateId: 'p-1', name: 'سارة الحربي', email: 'sara@example.com', headline: 'Product Designer', completion: 82, cvStatus: 'analyzed', applications: 3, isActive: true },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
  }),
  http.get('*/api/healthz', async () => {
    await delay(5);
    return HttpResponse.json({ status: 'ok' });
  }),

  // Notifications — the RoleShell bell fetches these on mount.
  http.get('*/api/notifications', async () => {
    await delay(10);
    return HttpResponse.json({
      notifications: [{
        id: 'n-1',
        type: 'application_status',
        title: 'تم اختيارك ضمن القائمة المختصرة',
        body: `وظيفة: ${job.title}`,
        link: '/seeker/applications',
        read: false,
        createdAt: new Date().toISOString(),
      }],
      unreadCount: 1,
    });
  }),
  http.patch('*/api/notifications/:id/read', async () => {
    await delay(10);
    return HttpResponse.json({ id: 'n-1', read: true });
  }),
  http.post('*/api/notifications/read-all', async () => {
    await delay(10);
    return new HttpResponse(null, { status: 204 });
  }),

  // Company funnel — real numbers for the dashboard stats.
  http.get('*/api/companies/me/funnel', async () => {
    await delay(10);
    return HttpResponse.json({
      jobs: [{ jobId: job.id, title: job.title, status: 'active', total: 2, applied: 1, reviewing: 1, shortlisted: 0, interview: 0, rejected: 0, accepted: 0, avgMatch: 84 }],
      totals: { total: 2, applied: 1, reviewing: 1, shortlisted: 0, interview: 0, rejected: 0, accepted: 0, avgMatch: 84 },
    });
  }),

  // Auth flows: password reset + email verification.
  http.post('*/api/auth/forgot-password', async () => {
    await delay(10);
    return HttpResponse.json({ ok: true, message: 'إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة التعيين.' });
  }),
  http.post('*/api/auth/reset-password', async () => {
    await delay(10);
    return HttpResponse.json({ ok: true });
  }),
  http.post('*/api/auth/verify-email', async () => {
    await delay(10);
    return HttpResponse.json({ ok: true });
  }),
  http.post('*/api/auth/resend-verification', async () => {
    await delay(10);
    return HttpResponse.json({ ok: true, message: 'إذا كان البريد بانتظر التأكيد فسيصلك رابط جديد.' });
  }),
];

export const server = setupServer(...handlers);