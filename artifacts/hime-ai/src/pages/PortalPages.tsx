import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowUpLeft, BriefcaseBusiness, Building2, CalendarDays, Check, CheckCircle2, ChevronLeft, CircleAlert, CircleDashed, Clock3, FileCheck2, FileText, Globe2, HeartHandshake, Mail, MapPin, Pencil, Plus, ShieldCheck, Sparkles, Target, TrendingUp, Users, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDemo } from '@/hooks/use-demo';
import { useLanguage } from '@/i18n';
import * as demoApi from '@/services/api/demo-api';
import { adminActivity, adminPermissions, candidateActivity, companyActivity, companyBenefits } from '@/services/portal-data';
import type { CandidateProfile, Company, VerificationStatus } from '@/types';
import { Field, FeedbackState, JobCard, LoadingState, PageHeader, ScoreRing } from '@/components/app-kit';
import { RoleShell } from '@/components/role-shell';
import { WorkflowGuide } from '@/components/workflow-guide';

function MetricCard({ label, value, detail, icon: Icon, tone = 'primary' }: { label: string; value: string | number; detail: string; icon: typeof TrendingUp; tone?: 'primary' | 'accent' }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-4 text-3xl font-bold">{value}</p><p className={`mt-2 text-[11px] ${tone === 'accent' ? 'text-accent-foreground' : 'text-primary'}`}>{detail}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone === 'accent' ? 'bg-accent/15 text-accent-foreground' : 'bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

function ActivityList({ items }: { items: typeof candidateActivity }) {
  return <div className="space-y-5">{items.map((item) => <div key={item.title} className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === 'accent' ? 'bg-accent' : item.tone === 'primary' ? 'bg-primary' : 'bg-muted-foreground/40'}`} /><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.time}</p></div></div>)}</div>;
}

function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-bold">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>{action}</div>;
}

export function CandidateDashboardPage() {
  const { data: rawProfile, loading } = useDemo(demoApi.getProfile, []);
  const profile = typeof rawProfile === 'function' ? null : rawProfile;
  const { data: jobs } = useDemo(() => demoApi.listJobs(), []);
  const { data: rawApplications } = useDemo(demoApi.applications, []);
  const applications = typeof rawApplications === 'function' ? null : rawApplications;
  if (loading || !profile) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  return <RoleShell role="seeker">
    <PageHeader eyebrow="لوحة الباحث عن عمل" title="مساحتك المهنية في صورة واحدة." description="تابع جاهزية ملفك، فرصك الأقرب، وكل ما يحتاج انتباهك اليوم." action={<div className="flex gap-2"><Link href="/seeker/cv" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">مراجعة السيرة</Link><Link href="/seeker/profile" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">تعديل الملف</Link></div>} />
    <WorkflowGuide role="seeker" current="profile" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="اكتمال الملف" value={`${profile.completion}%`} detail="أضف مشروعاً واحداً" icon={Target} /><MetricCard label="التقديمات النشطة" value={applications?.length || 0} detail="طلبان قيد المتابعة" icon={FileText} /><MetricCard label="التطابقات الجديدة" value="8" detail="+3 منذ آخر زيارة" icon={Sparkles} tone="accent" /><MetricCard label="مشاهدات الملف" value="24" detail="+18% هذا الأسبوع" icon={TrendingUp} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="overflow-hidden bg-sidebar text-sidebar-foreground"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-xs text-sidebar-foreground/60">قوة ملفك أمام الشركات</p><p className="mt-3 text-4xl font-bold">{profile.completion}%</p><p className="mt-2 max-w-md text-sm leading-6 text-sidebar-foreground/65">أنت قريب من ملف مكتمل. إضافة رابط مشروع حديث ستجعل قصتك المهنية أكثر وضوحاً.</p></div><div className="grid place-items-center"><ScoreRing score={profile.completion} size="lg" /></div></div><div className="mt-7 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#f2c66d]" style={{ width: `${profile.completion}%` }} /></div><div className="mt-5 flex flex-wrap gap-2 text-xs text-sidebar-foreground/70"><span className="rounded-full bg-white/10 px-3 py-1.5">المعلومات الأساسية <Check className="ms-1 inline h-3 w-3 text-[#f2c66d]" /></span><span className="rounded-full bg-white/10 px-3 py-1.5">السيرة محللة <Check className="ms-1 inline h-3 w-3 text-[#f2c66d]" /></span><span className="rounded-full bg-white/10 px-3 py-1.5">أضف مشروعاً</span></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">قائمة اليوم</CardTitle></CardHeader><CardContent className="space-y-4"><Link href="/seeker/recommendations" className="flex items-center gap-3 rounded-xl bg-primary/5 p-3 hover:bg-primary/10"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">راجع 3 توصيات جديدة</p><p className="mt-1 text-xs text-muted-foreground">أعلى تطابق 92%</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link><Link href="/seeker/profile" className="flex items-center gap-3 rounded-xl bg-secondary p-3 hover:bg-secondary/80"><div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-primary"><Pencil className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">أكمل تفضيلاتك</p><p className="mt-1 text-xs text-muted-foreground">ساعدنا على تحسين المطابقة</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link><Link href="/seeker/applications" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted"><div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary"><Clock3 className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">تابع طلباتك</p><p className="mt-1 text-xs text-muted-foreground">لديك طلبان قيد المتابعة</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link></CardContent></Card>
    </div>
    <div className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">الفرص الأقرب لك</CardTitle><Link href="/seeker/recommendations" className="text-xs font-bold text-primary">عرض الكل</Link></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{(jobs || []).slice(0, 2).map((job, index) => <JobCard key={job.id} job={job} match={[92, 87][index]} />)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">آخر نشاط مهني</CardTitle></CardHeader><CardContent><ActivityList items={candidateActivity} /></CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.8fr]"><Card><CardHeader><CardTitle className="text-base">آخر طلبات التقديم</CardTitle></CardHeader><CardContent className="space-y-3">{(applications || []).slice(0, 3).map((application) => <div key={application.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{application.job.title}</p><p className="mt-1 text-xs text-muted-foreground">{application.job.company.name} · {application.appliedAt}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">قيد المراجعة</span><span className="text-sm font-bold text-primary">{application.matchScore}%</span></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">حالة السيرة الذاتية</CardTitle></CardHeader><CardContent><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div><div><p className="text-sm font-bold">تم التحليل بنجاح</p><p className="mt-1 text-xs leading-5 text-muted-foreground">راجع المعلومات المستخرجة قبل اعتمادها ضمن ملفك.</p><Link href="/seeker/cv" className="mt-4 inline-block text-xs font-bold text-primary">فتح السيرة <ArrowUpLeft className="inline h-3 w-3" /></Link></div></div></CardContent></Card></div>
  </RoleShell>;
}

export function CandidateProfilePage() {
  const { data, loading } = useDemo(demoApi.getProfile, []);
  const [draft, setDraft] = useState<CandidateProfile | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [saved, setSaved] = useState(false);
  if (loading || (!data && !draft)) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  const profile = draft || data!;
  const update = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) => { setDraft({ ...profile, [key]: value }); setSaved(false); };
  const save = async () => { await demoApi.updateProfile(profile); setSaved(true); };
  const addSkill = () => { if (!newSkill.trim()) return; update('skills', [...profile.skills, { id: `skill-${Date.now()}`, name: newSkill.trim(), category: 'professional' }]); setNewSkill(''); };
  return <RoleShell role="seeker">
    <PageHeader eyebrow="الملف المهني" title="كل ما تحتاجه الشركات لفهم مسارك." description="تحكم في قصتك المهنية، من العنوان الأول إلى تفضيلاتك للخطوة القادمة." action={<Button onClick={save} data-testid="button-save-full-candidate-profile">{saved ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}{saved ? 'تم حفظ الملف' : 'حفظ الملف'}</Button>} />
    <WorkflowGuide role="seeker" current="profile" />
    <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between md:p-6"><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">لع</div><div><h2 className="text-xl font-bold">{profile.headline}</h2><p className="mt-1 text-sm text-muted-foreground">{profile.location} · متاح لفرص جديدة</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">ملف عام</span><span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">CV محلل</span></div></div></div><div className="flex items-center gap-4"><ScoreRing score={profile.completion} size="sm" /><div><p className="text-xs text-muted-foreground">اكتمال الملف</p><p className="mt-1 text-sm font-bold">أضف مشروعاً لرفع النتيجة</p></div></div></div>
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]"><div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-base">المعلومات الشخصية</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Field label="العنوان المهني" value={profile.headline} onChange={(value) => update('headline', value)} /><Field label="الموقع" value={profile.location} onChange={(value) => update('location', value)} /><Field label="رقم الهاتف" value={profile.phone} onChange={(value) => update('phone', value)} /><Field label="البريد الإلكتروني" value="layan@example.com" onChange={() => undefined} /><div className="md:col-span-2"><Field label="الملخص المهني" value={profile.summary} onChange={(value) => update('summary', value)} multiline /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">المهارات</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{profile.skills.map((skill: import('@/types').Skill) => <span key={skill.id} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{skill.name}<button onClick={() => update('skills', profile.skills.filter((item: import('@/types').Skill) => item.id !== skill.id))} aria-label={`إزالة ${skill.name}`} className="text-primary/60 hover:text-destructive">×</button></span>)}</div><div className="mt-5 flex max-w-md gap-2"><Input value={newSkill} onChange={(event) => setNewSkill(event.target.value)} placeholder="أضف مهارة جديدة" data-testid="input-new-candidate-skill" /><Button type="button" variant="outline" onClick={addSkill} data-testid="button-add-candidate-skill"><Plus className="h-4 w-4" />إضافة</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الخبرة العملية</CardTitle></CardHeader><CardContent className="space-y-6">{profile.experiences.map((item) => <div key={item.id} className="relative flex gap-4 border-s border-border ps-5 last:border-s-0"><span className="absolute -start-1.5 top-1 h-3 w-3 rounded-full bg-accent" /><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.role}</p><span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{item.startDate} — {item.endDate}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.company} · {item.location}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div>)}<Button type="button" variant="outline" className="w-full border-dashed"><Plus className="h-4 w-4" />إضافة خبرة</Button></CardContent></Card>
      <div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">التعليم</CardTitle></CardHeader><CardContent className="space-y-4">{profile.education.map((item) => <div key={item.id} className="rounded-xl bg-secondary/60 p-4"><p className="font-bold">{item.degree}</p><p className="mt-1 text-xs text-muted-foreground">{item.field}</p><p className="mt-2 text-xs">{item.institution} · {item.year}</p></div>)}<Button type="button" variant="outline" className="w-full border-dashed"><Plus className="h-4 w-4" />إضافة تعليم</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base">المشاريع</CardTitle></CardHeader><CardContent className="space-y-4">{profile.projects.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between"><p className="font-bold">{item.name}</p><Globe2 className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p></div>)}<Button type="button" variant="outline" className="w-full border-dashed"><Plus className="h-4 w-4" />إضافة مشروع</Button></CardContent></Card></div>
      <Card><CardHeader><CardTitle className="text-base">الشهادات والاعتمادات</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{profile.certifications.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent-foreground"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.issuer} · {item.year}</p></div></div>)}<Button type="button" variant="outline" className="border-dashed"><Plus className="h-4 w-4" />إضافة شهادة</Button></CardContent></Card>
    </div><div className="space-y-6">
      <Card className="bg-secondary/50"><CardHeader><CardTitle className="text-base">تفضيلات العمل</CardTitle></CardHeader><CardContent className="space-y-4"><label className="block text-xs font-semibold">المجالات المفضلة<select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={profile.preferences.industries[0]} onChange={(event) => update('preferences', { ...profile.preferences, industries: [event.target.value] })}><option>تقنية المعلومات</option><option>التقنية المالية</option><option>الاستشارات</option></select></label><label className="block text-xs font-semibold">نوع العقد<select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={profile.preferences.contract} onChange={(event) => update('preferences', { ...profile.preferences, contract: event.target.value as CandidateProfile['preferences']['contract'] })}><option value="full-time">دوام كامل</option><option value="part-time">دوام جزئي</option><option value="contract">عقد مستقل</option></select></label><label className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-xs"><span><span className="block font-bold">العمل عن بعد</span><span className="mt-1 block text-muted-foreground">أظهر فرص العمل المرنة</span></span><input type="checkbox" checked={profile.preferences.remote} onChange={(event) => update('preferences', { ...profile.preferences, remote: event.target.checked })} /></label></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">السيرة الذاتية</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div><div className="flex-1"><p className="text-sm font-bold">Layan_Alotaibi_CV.pdf</p><p className="mt-1 text-xs text-muted-foreground">تم التحليل · 2.3MB</p></div></div><Link href="/seeker/cv" className="mt-5 block rounded-lg border border-border px-3 py-2.5 text-center text-xs font-bold hover:bg-muted">مراجعة السيرة</Link></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الظهور والخصوصية</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><label className="flex items-start gap-3"><input type="checkbox" defaultChecked className="mt-0.5" /><span><span className="font-bold">السماح للشركات برؤية ملفي</span><span className="mt-1 block leading-5 text-muted-foreground">اعرض ملفك ضمن التوصيات المناسبة فقط.</span></span></label><label className="flex items-start gap-3"><input type="checkbox" defaultChecked className="mt-0.5" /><span><span className="font-bold">إشعارات الفرص الجديدة</span><span className="mt-1 block leading-5 text-muted-foreground">أرسل لي فرصاً تتجاوز 80% تطابق.</span></span></label></CardContent></Card>
    </div></div>
  </RoleShell>;
}

export function CompanyDashboardPage() {
  const { data: rawCompany, loading } = useDemo(demoApi.company, []);
  const company = typeof rawCompany === 'function' ? null : rawCompany;
  const { data: rawJobs } = useDemo(demoApi.getCompanyJobs, []);
  const jobs = typeof rawJobs === 'function' ? null : rawJobs;
  // Candidates belong to a real job, so derive the id from loaded data
  // rather than hardcoding a demo id that no longer exists in the database.
  const firstJobId = jobs?.[0]?.id;
  const { data: rawCandidates } = useDemo(
    () => (firstJobId ? demoApi.candidates(firstJobId) : Promise.resolve([])),
    [firstJobId],
  );
  const candidates = typeof rawCandidates === 'function' ? null : rawCandidates;
  if (loading || !company) return <RoleShell role="company"><LoadingState /></RoleShell>;
  return <RoleShell role="company">
    <PageHeader eyebrow="لوحة الشركة" title="مركز التوظيف الذي يرى الصورة كاملة." description="من أداء الوظائف إلى جودة المرشحين، كل قرار يبدأ من بيانات أوضح." action={<div className="flex gap-2"><Link href="/company/profile" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">ملف الشركة</Link><Link href="/company/jobs/new" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="me-1 inline h-4 w-4" />إضافة وظيفة</Link></div>} />
    <WorkflowGuide role="company" current="manage" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="الوظائف النشطة" value={jobs?.length || 0} detail="+2 هذا الشهر" icon={BriefcaseBusiness} /><MetricCard label="طلبات التقديم" value="86" detail="+18% عن الشهر الماضي" icon={FileText} /><MetricCard label="مرشحون جدد" value="24" detail="7 يحتاجون مراجعة" icon={Users} tone="accent" /><MetricCard label="متوسط التطابق" value="88%" detail="+4% هذا الشهر" icon={Target} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">قمع التوظيف</CardTitle><p className="mt-1 text-xs text-muted-foreground">آخر 30 يوماً</p></div><Link href="/company/jobs" className="text-xs font-bold text-primary">كل الوظائف</Link></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4">{[['جديد', 42, 'bg-primary'], ['قيد المراجعة', 28, 'bg-primary/70'], ['مختصر', 11, 'bg-accent'], ['مقابلة', 5, 'bg-[#123e43]']].map(([label, value, color]) => <div key={label} className="rounded-xl bg-secondary p-4"><div className={`mb-4 h-1.5 rounded-full ${color}`} /><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div><div className="mt-7 flex h-32 items-end gap-2">{[34, 45, 38, 58, 52, 70, 63, 80, 74, 92, 86, 96].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-primary/75" style={{ height: `${height}%` }} /><span className="text-[9px] text-muted-foreground">{index + 1}</span></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">نشاط الفريق</CardTitle></CardHeader><CardContent><ActivityList items={companyActivity} /></CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">أفضل المرشحين الآن</CardTitle><Link href={firstJobId ? `/company/jobs/${firstJobId}/candidates` : '/company/jobs'} className="text-xs font-bold text-primary" data-testid="link-top-candidates-list">عرض القائمة</Link></CardHeader><CardContent className="space-y-3">{(candidates || []).map((candidate) => <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary font-bold text-primary">{candidate.name.slice(0, 2)}</div><div className="flex-1"><p className="text-sm font-bold">{candidate.name}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.headline}</p><div className="mt-2 flex flex-wrap gap-1.5">{candidate.matchedSkills.map((skill) => <span key={skill.id} className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">{skill.name}</span>)}</div></div><div className="text-start sm:text-end"><p className="text-xl font-bold text-primary">{candidate.score}%</p><p className="text-[10px] text-muted-foreground">تطابق</p></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">صحة ملف الشركة</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-bold">ملف موثق</p><p className="mt-1 text-xs text-muted-foreground">تظهر شارة التحقق للمرشحين</p></div></div><div className="mt-6 space-y-3 text-xs"><div className="flex items-center justify-between"><span>اكتمال المعلومات</span><span className="font-bold text-primary">92%</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full w-[92%] rounded-full bg-primary" /></div><Link href="/company/profile" className="mt-4 block text-center text-xs font-bold text-primary">تحسين الملف</Link></div></CardContent></Card></div>
  </RoleShell>;
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  const map = {
    verified: { label: 'موثقة', cls: 'bg-primary/10 text-primary', icon: CheckCircle2 },
    pending: { label: 'قيد المراجعة', cls: 'bg-accent/15 text-accent-foreground', icon: Clock3 },
    rejected: { label: 'مرفوضة', cls: 'bg-destructive/10 text-destructive', icon: CircleAlert },
    draft: { label: 'غير مكتملة', cls: 'bg-muted text-muted-foreground', icon: CircleDashed },
  } as const;
  const { label, cls, icon: Icon } = map[status] ?? map.draft;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`} data-testid={`badge-verification-${status}`}>
      <Icon className="me-1 inline h-3 w-3" />{label}
    </span>
  );
}

function VerificationBanner({ status, note }: { status: VerificationStatus; note?: string | null }) {
  if (status === 'verified') {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="banner-verification-approved">
        <p className="text-sm font-bold text-primary">تم التحقق من بيانات الشركة</p>
        <p className="mt-1 text-xs text-muted-foreground">يمكنك نشر الوظائف واستقبال طلبات التقديم.</p>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4" data-testid="banner-verification-pending">
        <p className="text-sm font-bold">طلب التحقق قيد المراجعة</p>
        <p className="mt-1 text-xs text-muted-foreground">أرسلنا بياناتك إلى إدارة المنصة. سيصلك القرار هنا.</p>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" data-testid="banner-verification-rejected">
        <p className="text-sm font-bold text-destructive">تم رفض طلب التحقق</p>
        {note && <p className="mt-1 text-xs leading-6 text-muted-foreground">{note}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4" data-testid="banner-verification-draft">
      <p className="text-sm font-bold">أكمل بياناتك واطلب التحقق</p>
      <p className="mt-1 text-xs text-muted-foreground">تحتاج المنصة إلى بيانات，准确ة قبل عرض شارة التحقق أمام المرشحين.</p>
    </div>
  );
}

export function CompanyProfilePage() {
  const { data: rawData, loading } = useDemo(demoApi.company, []);
  const data = typeof rawData === 'function' ? null : rawData;
  const [draft, setDraft] = useState<Partial<Company> | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [current, setCurrent] = useState<Company | null>(null);

  const company = { ...(current ?? data ?? {}), ...draft } as Company;
  const status = ((current ?? data)?.verificationStatus ?? 'draft') as VerificationStatus;

  const update = (key: keyof Company, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setState('idle');
  };

  const requiredMissing = [
    !company.name?.trim() && 'اسم الشركة',
    !company.industry?.trim() && 'المجال',
    !company.location?.trim() && 'الموقع',
    (!company.description || company.description.trim().length < 20) && 'وصف الشركة (20 حرفاً على الأقل)',
    // The API validates website as a URL; catch it here so the failure is
    // obvious instead of a generic 400.
    (!!company.website?.trim() && !/^https?:\/\/\S+\.\S+$/.test(company.website.trim())) && 'الموقع الإلكتروني (مثال: https://example.com)',
  ].filter(Boolean) as string[];

  /** Persists the form. Returns the saved company, or null when it failed. */
  const persist = async (): Promise<Company | null> => {
    try {
      const saved = await demoApi.saveCompanyProfile({
        name: company.name,
        industry: company.industry,
        location: company.location,
        website: company.website || undefined,
        description: company.description || undefined,
      });
      setCurrent(saved);
      setDraft(null);
      setState('saved');
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
      setState('error');
      return null;
    }
  };

  const save = async () => {
    setState('saving');
    setError('');
    await persist();
  };

  const submitForReview = async () => {
    if (requiredMissing.length > 0) return;
    setRequesting(true);
    setError('');
    try {
      // Persist pending edits first so the admin reviews current data, and
      // stop if that failed — otherwise the verification request fails with
      // a confusing "complete your profile" message.
      setState('saving');
      const saved = await persist();
      if (!saved) return;

      const updated = await demoApi.requestVerification();
      setCurrent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب');
    } finally {
      setRequesting(false);
      setState((s) => (s === 'saving' ? 'idle' : s));
    }
  };

  if (loading && !data && !draft) return <RoleShell role="company"><LoadingState /></RoleShell>;

  return <RoleShell role="company">
    <PageHeader eyebrow="ملف الشركة" title="هوية تساعد المرشحين على اختياركم." description="عرّفوا الناس بالعمل الذي تبنونه، والثقافة التي سيجدونها بعد الانضمام." action={
      <div className="flex gap-2">
        <Button onClick={save} disabled={state === 'saving'} data-testid="button-save-full-company-profile">
          {state === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {state === 'saving' ? 'جارٍ الحفظ…' : state === 'saved' ? 'تم الحفظ' : 'حفظ التغييرات'}
        </Button>
      </div>
    } />
    <WorkflowGuide role="company" current="profile" />

    <VerificationBanner status={status} note={(current ?? data)?.verificationNote} />

    {error && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert" data-testid="error-company-profile">{error}</p>}

    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-28 bg-[linear-gradient(110deg,hsl(var(--primary)),#1e666a_55%,#f2c66d)]" />
      <div className="-mt-10 flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-7">
        <div className="flex items-end gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-card bg-secondary text-2xl font-bold text-primary"><Building2 className="h-9 w-9" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{company.name || 'اسم الشركة'}</h2>
              <VerificationBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{company.industry} · {company.location}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="text-base">المعلومات الأساسية</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="اسم الشركة *" value={company.name} onChange={(v) => update('name', v)} />
          <Field label="المجال *" value={company.industry} onChange={(v) => update('industry', v)} />
          <Field label="الموقع *" value={company.location} onChange={(v) => update('location', v)} />
          <Field label="الموقع الإلكتروني" value={company.website} onChange={(v) => update('website', v)} />
          <div className="md:col-span-2"><Field label="عن الشركة *" value={company.description} onChange={(v) => update('description', v)} multiline /></div>
        </CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card data-testid="card-verification-request">
          <CardHeader><CardTitle className="text-base">طلب التحقق</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {status === 'pending' ? (
              <p className="rounded-lg bg-accent/10 p-3 text-xs leading-6" data-testid="status-verification-pending">
                طلبك قيد المراجعة لدى إدارة المنصة. سنعلمك فور اتخاذ القرار.
              </p>
            ) : status === 'verified' ? (
              <p className="rounded-lg bg-primary/10 p-3 text-xs leading-6" data-testid="status-verification-approved">
                تم التحقق من بياناتك، وشارة التحقق ظاهرة للمرشحين.
              </p>
            ) : (
              <>
                {requiredMissing.length > 0 && (
                  <div className="rounded-lg bg-muted p-3 text-xs leading-6" data-testid="list-verification-missing">
                    <p className="font-bold">أكمل الحقول التالية قبل الإرسال:</p>
                    <ul className="mt-1 list-inside list-disc">{requiredMissing.map((f) => <li key={f}>{f}</li>)}</ul>
                  </div>
                )}
                {status === 'rejected' && (
                  <p className="rounded-lg bg-destructive/10 p-3 text-xs leading-6 text-destructive" data-testid="status-verification-rejected">
                    تم رفض الطلبPreviously. عدّل البيانات وأعد الإرسال.
                  </p>
                )}
                <Button className="w-full" onClick={submitForReview} disabled={requiredMissing.length > 0 || requesting} data-testid="button-request-verification">
                  {requesting ? 'جارٍ الإرسال…' : 'إرسال طلب التحقق'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </RoleShell>;
}

export function AdminDashboardPage() {
  const { data: stats, loading } = useDemo(demoApi.stats, []);
  const { data: companies } = useDemo(demoApi.listCompanies, []);
  const { data: jobs } = useDemo(() => demoApi.listJobs(), []);
  if (loading || !stats) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  return <RoleShell role="admin">
    <PageHeader eyebrow="إدارة المنصة" title="صورة HiMe AI التشغيلية." description="راقب صحة المنصة، راجع قوائم الانتظار، وتابع جودة التجربة للباحثين والشركات." action={<Link href="/admin/profile" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"><ShieldCheck className="me-1 inline h-4 w-4" />ملفي وصلاحياتي</Link>} />
    <WorkflowGuide role="admin" current="dashboard" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="الباحثون" value={stats.candidates.toLocaleString()} detail="+8.4% هذا الشهر" icon={Users} /><MetricCard label="الشركات" value={stats.companies.toLocaleString()} detail="3 بانتظار التحقق" icon={Building2} /><MetricCard label="الوظائف" value={stats.jobs.toLocaleString()} detail="214 نشطة" icon={BriefcaseBusiness} tone="accent" /><MetricCard label="طلبات التقديم" value={stats.applications.toLocaleString()} detail="+12.6% هذا الشهر" icon={FileText} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">صحة المنصة</CardTitle><p className="mt-1 text-xs text-muted-foreground">مراقبة الخدمات الأساسية</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"><span className="me-1 inline-block h-2 w-2 rounded-full bg-primary" />كل الأنظمة تعمل</span></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[['واجهة المستخدم', '99.99%', 'ممتاز'], ['API Gateway', '99.96%', 'ممتاز'], ['خدمة الذكاء', '98.72%', 'مستقر']].map(([label, value, state]) => <div key={label} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{state} · آخر ساعة</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">إجراءات تحتاج انتباهك</CardTitle></CardHeader><CardContent className="space-y-3"><Link href="/admin/companies" className="flex items-center justify-between rounded-xl bg-accent/10 p-3 text-xs"><span><span className="block font-bold">شركات بانتظار التحقق</span><span className="mt-1 block text-muted-foreground">مراجعة 3 طلبات</span></span><span className="rounded-full bg-accent px-2 py-1 font-bold text-accent-foreground">3</span></Link><Link href="/admin/jobs" className="flex items-center justify-between rounded-xl bg-secondary p-3 text-xs"><span><span className="block font-bold">وظائف تحتاج مراجعة</span><span className="mt-1 block text-muted-foreground">وصف أو تصنيف</span></span><span className="rounded-full bg-primary px-2 py-1 font-bold text-primary-foreground">7</span></Link><Link href="/admin/applications" className="flex items-center justify-between rounded-xl border border-border p-3 text-xs"><span><span className="block font-bold">بلاغات جديدة</span><span className="mt-1 block text-muted-foreground">لم يتم التعامل معها</span></span><span className="rounded-full bg-muted px-2 py-1 font-bold">2</span></Link></CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">آخر الشركات والوظائف</CardTitle><Link href="/admin/companies" className="text-xs font-bold text-primary">إدارة الكل</Link></CardHeader><CardContent className="space-y-3">{(companies || []).slice(0, 3).map((company) => <div key={company.id} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{company.name}</p><p className="mt-1 text-xs text-muted-foreground">{company.industry} · {company.location}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${company.verified ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>{company.verified ? 'موثقة' : 'قيد المراجعة'}</span></div>)}<div className="border-t border-border pt-3 text-xs text-muted-foreground">إجمالي الوظائف النشطة: <span className="font-bold text-foreground">{jobs?.filter((job) => job.status === 'active').length || 0}</span> في البيانات التجريبية</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">سجل النشاط</CardTitle></CardHeader><CardContent><ActivityList items={adminActivity} /></CardContent></Card></div>
  </RoleShell>;
}

export function AdminProfilePage() {
  const [saved, setSaved] = useState(false);
  return <RoleShell role="admin">
    <PageHeader eyebrow="حساب الإدارة" title="ملفي وصلاحياتي." description="إدارة بيانات الحساب، مستوى الوصول، وتفضيلات الإشعارات." action={<Button onClick={() => setSaved(true)}>{saved ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}{saved ? 'تم الحفظ' : 'حفظ التغييرات'}</Button>} />
    <WorkflowGuide role="admin" current="profile" />
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-base">بيانات الحساب</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Field label="الاسم الكامل" value="سلمان القحطاني" onChange={() => undefined} /><Field label="البريد الإلكتروني" value="salman@hime.ai" onChange={() => undefined} /><Field label="المسمى الوظيفي" value="مدير المنصة" onChange={() => undefined} /><Field label="المنطقة الزمنية" value="Asia/Riyadh" onChange={() => undefined} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الصلاحيات الحالية</CardTitle></CardHeader><CardContent className="space-y-3">{adminPermissions.map((permission) => <div key={permission.label} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className={`grid h-9 w-9 place-items-center rounded-lg ${permission.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><ShieldCheck className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{permission.label}</p><p className="mt-1 text-xs text-muted-foreground">{permission.detail}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${permission.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{permission.enabled ? 'مفعلة' : 'مقيدة'}</span></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الأمان</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><button className="rounded-xl border border-border p-4 text-start hover:bg-muted"><p className="text-sm font-bold">تغيير كلمة المرور</p><p className="mt-1 text-xs text-muted-foreground">آخر تغيير منذ 42 يوماً</p></button><button className="rounded-xl border border-border p-4 text-start hover:bg-muted"><p className="text-sm font-bold">الجلسات النشطة</p><p className="mt-1 text-xs text-muted-foreground">جلسة واحدة · الرياض</p></button></CardContent></Card>
    </div><div className="space-y-6"><Card className="bg-sidebar text-sidebar-foreground"><CardContent className="p-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f2c66d] text-lg font-bold text-[#123e43]">سق</div><p className="mt-5 text-lg font-bold">سلمان القحطاني</p><p className="mt-1 text-xs text-sidebar-foreground/60">مدير المنصة · وصول إداري</p><div className="mt-6 border-t border-white/10 pt-5 text-xs text-sidebar-foreground/65"><p>آخر دخول</p><p className="mt-1 font-semibold text-sidebar-foreground">اليوم، 09:42 · الرياض</p></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">الإشعارات</CardTitle></CardHeader><CardContent className="space-y-4 text-xs"><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">تنبيهات المراجعة</span><span className="mt-1 block text-muted-foreground">بلاغات وتحقق الشركات</span></span><input type="checkbox" defaultChecked /></label><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">ملخص يومي</span><span className="mt-1 block text-muted-foreground">إحصاءات المنصة الرئيسية</span></span><input type="checkbox" defaultChecked /></label><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">تنبيهات النظام</span><span className="mt-1 block text-muted-foreground">الصحة والأخطاء الحرجة</span></span><input type="checkbox" defaultChecked /></label></CardContent></Card></div></div>
  </RoleShell>;
}