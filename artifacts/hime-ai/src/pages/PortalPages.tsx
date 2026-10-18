import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowUpLeft, BriefcaseBusiness, Building2, CalendarDays, Camera, Check, CheckCircle2, ChevronLeft, CircleAlert, CircleDashed, Clock3, FileCheck2, FileText, Globe2, HeartHandshake, Mail, MapPin, Pencil, Plus, ShieldCheck, Sparkles, Target, TrendingUp, Users, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDemo } from '@/hooks/use-demo';
import { useLanguage } from '@/i18n';
import * as demoApi from '@/services/api/demo-api';
import { adminPermissions } from '@/services/portal-data';
import type { CandidateProfile, Company, CvAssessment, Job, VerificationStatus } from '@/types';
import { formatDate, initials, statusLabels } from '@/lib/format';
import { useAuth } from '@/contexts/auth-context';
import { Field, FeedbackState, JobCard, LoadingState, PageHeader, ScoreRing } from '@/components/app-kit';
import { RoleShell } from '@/components/role-shell';
import { WorkflowGuide } from '@/components/workflow-guide';
import { readSavedAssessment } from '@/pages/AssessPage';

function MetricCard({ label, value, detail, icon: Icon, tone = 'primary' }: { label: string; value: string | number; detail: string; icon: typeof TrendingUp; tone?: 'primary' | 'accent' }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-4 text-3xl font-bold">{value}</p><p className={`mt-2 text-[11px] ${tone === 'accent' ? 'text-accent-foreground' : 'text-primary'}`}>{detail}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone === 'accent' ? 'bg-accent/15 text-accent-foreground' : 'bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}

/** One feed row. Dashboards build these from real data — never invented entries. */
export interface ActivityItem {
  title: string;
  detail: string;
  time?: string;
  tone: 'primary' | 'accent' | 'neutral';
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  return <div className="space-y-5">{items.map((item) => <div key={item.title} className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === 'accent' ? 'bg-accent' : item.tone === 'primary' ? 'bg-primary' : 'bg-muted-foreground/40'}`} /><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>{item.time && <p className="mt-1 text-[10px] text-muted-foreground">{item.time}</p>}</div></div>)}</div>;
}

function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-bold">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>{action}</div>;
}

/**
 * Picks up an assessment produced on the public /assess page before sign-in,
 * so the recommendations the visitor already earned are waiting for them.
 */
function useSavedAssessment() {
  const [assessment, setAssessment] = useState<CvAssessment | null>(() => readSavedAssessment());
  useEffect(() => {
    const sync = () => setAssessment(readSavedAssessment());
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
  return assessment;
}

function CvInsightsCard({ completion }: { completion: number }) {
  const assessment = useSavedAssessment();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-cv-insights">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          توصيات الذكاء الاصطناعي لسيرتك
        </CardTitle>
        {assessment && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {assessment.overallScore}% آخر تقييم
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              آخر تقييم لسيرتك كان مقابل دور <span className="font-bold text-foreground">{assessment.role}</span>.
              هذه أهم التحسينات:
            </p>
            <ol className="space-y-2">
              {assessment.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-6">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {completion >= 60
              ? 'ملفك في حالة جيدة. ارفع سيرتك للحصول على تقييم مفصل وتوصيات تحسين مخصصة.'
              : 'أكمل ملفك لتحصل على تقييم مفصل وتوصيات تحسين مخصصة من الذكاء الاصطناعي.'}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/seeker/recommendations"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
            data-testid="link-insights-recommendations"
          >
            استكشف الوظائف المطابقة <ArrowUpLeft className="h-4 w-4" />
          </Link>
          <Link
            href="/seeker/cv"
            className="group inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary/35 bg-background px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-md active:translate-y-0"
            data-testid="link-insights-upload"
          >
            <FileText className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            {assessment ? 'أعد التقييم' : 'ارفع سيرتك'}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function CandidateDashboardPage() {
  const { data: rawProfile, loading } = useDemo(demoApi.getProfile, []);
  const profile = typeof rawProfile === 'function' ? null : rawProfile;
  const { data: jobs } = useDemo(() => demoApi.listJobs(), []);
  const { data: rawApplications } = useDemo(demoApi.applications, []);
  const applications = typeof rawApplications === 'function' ? null : rawApplications;
  const { data: rawMatches } = useDemo(demoApi.recommendations, []);
  const matches = typeof rawMatches === 'function' ? null : rawMatches;
  if (loading || !profile) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  // Every metric below derives from loaded data — no invented counters.
  const appCount = applications?.length ?? 0;
  const reviewingCount = (applications || []).filter((a) => a.status === 'reviewing' || a.status === 'applied').length;
  const topMatch = matches && matches.length > 0 ? Math.max(...matches.map((m) => m.score)) : null;
  // "Nearest opportunities": the matcher's own scores — never invented ones.
  // Falls back to plain jobs (no score chip) when fewer than two matches exist.
  const scored = (matches || [])
    .map((m) => {
      const job = (jobs || []).find((j) => j.id === m.jobId);
      return job ? { job, score: m.score } : null;
    })
    .filter((item): item is { job: Job; score: number } => item !== null)
    .slice(0, 2);
  const spotlight: { job: Job; score?: number }[] = [
    ...scored,
    ...(jobs || [])
      .filter((j) => !scored.some((s) => s.job.id === j.id))
      .slice(0, 2 - scored.length)
      .map((job) => ({ job })),
  ];
  // Activity feed derived from what actually happened.
  const feed: ActivityItem[] = [
    ...(matches || []).slice(0, 2).map((m) => ({ title: `توصية جديدة: ${m.jobTitle}`, detail: `تطابق ${m.score}%`, tone: 'accent' as const })),
    ...(applications || []).slice(0, 2).map((a) => ({ title: `قدّمت على ${a.job.title}`, detail: statusLabels[a.status] ?? a.status, time: formatDate(a.appliedAt), tone: 'primary' as const })),
  ].slice(0, 4);
  return <RoleShell role="seeker">
    <PageHeader eyebrow="لوحة الباحث عن عمل" title="مساحتك المهنية في صورة واحدة." description="تابع جاهزية ملفك، فرصك الأقرب، وكل ما يحتاج انتباهك اليوم." action={<div className="flex gap-2"><Link href="/seeker/cv" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">مراجعة السيرة</Link><Link href="/seeker/profile" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">تعديل الملف</Link></div>} />
    <WorkflowGuide role="seeker" current="profile" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="اكتمال الملف" value={`${profile.completion}%`} detail={profile.completion >= 100 ? 'ملفك مكتمل' : 'أضف مشروعاً لرفع النتيجة'} icon={Target} /><MetricCard label="التقديمات النشطة" value={appCount} detail={appCount > 0 ? `${reviewingCount} قيد المتابعة` : 'لم تقدّم بعد'} icon={FileText} /><MetricCard label="التطابقات الذكية" value={matches?.length ?? 0} detail={topMatch != null ? `أعلى تطابق ${topMatch}%` : 'أكمل ملفك لتحسين المطابقة'} icon={Sparkles} tone="accent" /><MetricCard label="المهارات المذكورة" value={profile.skills.length} detail={`${profile.experiences.length} خبرة عملية`} icon={TrendingUp} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="overflow-hidden bg-sidebar text-sidebar-foreground"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-xs text-sidebar-foreground/60">قوة ملفك أمام الشركات</p><p className="mt-3 text-4xl font-bold">{profile.completion}%</p><p className="mt-2 max-w-md text-sm leading-6 text-sidebar-foreground/65">{profile.completion >= 100 ? 'ملفك مكتمل وجاهز للعرض أمام الشركات.' : profile.projects.length > 0 ? 'ملفك في حالة جيدة — حدّث مهاراتك وتفضيلاتك لتطابق أدق.' : 'أضف مشروعاً واحداً على الأقل لتصبح قصتك المهنية أكثر وضوحاً.'}</p></div><div className="grid place-items-center"><ScoreRing score={profile.completion} size="lg" /></div></div><div className="mt-7 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#f2c66d]" style={{ width: `${profile.completion}%` }} /></div><div className="mt-5 flex flex-wrap gap-2 text-xs text-sidebar-foreground/70"><span className="rounded-full bg-white/10 px-3 py-1.5">المعلومات الأساسية <Check className="ms-1 inline h-3 w-3 text-[#f2c66d]" /></span><span className="rounded-full bg-white/10 px-3 py-1.5">{profile.cvStatus === 'analyzed' ? <>السيرة محللة <Check className="ms-1 inline h-3 w-3 text-[#f2c66d]" /></> : 'ارفع سيرتك'}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{profile.projects.length > 0 ? <>أضف مشروعاً <Check className="ms-1 inline h-3 w-3 text-[#f2c66d]" /></> : 'أضف مشروعاً'}</span></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">قائمة اليوم</CardTitle></CardHeader><CardContent className="space-y-4"><Link href="/seeker/recommendations" className="flex items-center gap-3 rounded-xl bg-primary/5 p-3 hover:bg-primary/10"><div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{(matches?.length ?? 0) > 0 ? `راجع ${matches!.length} توصية` : 'اكتشف توصياتك'}</p><p className="mt-1 text-xs text-muted-foreground">{topMatch != null ? `أعلى تطابق ${topMatch}%` : 'توصيات مبنية على ملفك'}</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link><Link href="/seeker/profile" className="flex items-center gap-3 rounded-xl bg-secondary p-3 hover:bg-secondary/80"><div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-primary"><Pencil className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">أكمل تفضيلاتك</p><p className="mt-1 text-xs text-muted-foreground">ساعدنا على تحسين المطابقة</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link><Link href="/seeker/applications" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted"><div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary"><Clock3 className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">تابع طلباتك</p><p className="mt-1 text-xs text-muted-foreground">{appCount > 0 ? `لديك ${appCount} طلب` : 'لم تقدّم على أي وظيفة بعد'}</p></div><ChevronLeft className="h-4 w-4 text-muted-foreground" /></Link></CardContent></Card>
    </div>

    <div className="mt-6">
      <CvInsightsCard completion={profile.completion} />
    </div>
    <div className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">الفرص الأقرب لك</CardTitle><Link href="/seeker/recommendations" className="text-xs font-bold text-primary">عرض الكل</Link></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{spotlight.map(({ job, score }) => <JobCard key={job.id} job={job} match={score} />)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">آخر نشاط مهني</CardTitle></CardHeader><CardContent>{feed.length > 0 ? <ActivityList items={feed} /> : <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد — ابدأ برفع سيرتك أو استكشاف التوصيات.</p>}</CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.8fr]"><Card><CardHeader><CardTitle className="text-base">آخر طلبات التقديم</CardTitle></CardHeader><CardContent className="space-y-3">{(applications || []).slice(0, 3).map((application) => <div key={application.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{application.job.title}</p><p className="mt-1 text-xs text-muted-foreground">{application.job.company.name} · {formatDate(application.appliedAt)}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">{statusLabels[application.status] ?? application.status}</span><span className="text-sm font-bold text-primary">{application.matchScore != null ? `${application.matchScore}%` : '—'}</span></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">حالة السيرة الذاتية</CardTitle></CardHeader><CardContent><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div><div><p className="text-sm font-bold">{profile.cvStatus === 'analyzed' ? 'تم التحليل بنجاح' : 'لم تُرفع سيرة ذاتية بعد'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{profile.cvStatus === 'analyzed' ? 'راجع المعلومات المستخرجة قبل اعتمادها ضمن ملفك.' : 'ارفع سيرتك ليستخرج الذكاء الاصطناعي مهاراتك وخبراتك.'}</p><Link href="/seeker/cv" className="mt-4 inline-block text-xs font-bold text-primary">{profile.cvStatus === 'analyzed' ? 'فتح السيرة' : 'ارفع السيرة'} <ArrowUpLeft className="inline h-3 w-3" /></Link></div></div></CardContent></Card></div>
  </RoleShell>;
}

type SectionKind = 'experience' | 'education' | 'project' | 'certification';

type AddFormField = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'checkbox'; required?: boolean; placeholder?: string };

/**
 * Inline "add item" form used by the profile's section buttons. Kept local to
 * the page: each section mounts its own instance, so closing the form resets
 * the values. Validation errors stay in the form; the caller passes server
 * failures through so nothing is swallowed.
 */
function AddSectionForm({ title, fields, testid, busy, error, onSubmit, onCancel }: {
  title: string;
  fields: AddFormField[];
  testid: string;
  busy: boolean;
  error: string;
  onSubmit: (values: Record<string, string | boolean>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.type === 'checkbox' ? false : ''])));
  const [localError, setLocalError] = useState('');
  const submit = () => {
    const missing = fields.filter((field) => field.required && !String(values[field.key] ?? '').trim()).map((field) => field.label);
    if (missing.length) {
      setLocalError(`أكمل الحقول المطلوبة: ${missing.join('، ')}`);
      return;
    }
    setLocalError('');
    onSubmit(values);
  };
  return (
    <div className="mt-5 rounded-xl border border-dashed border-primary/40 bg-secondary/40 p-4" data-testid={`form-${testid}`}>
      <p className="mb-3 text-sm font-bold">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (field.type === 'checkbox' ? (
          <label key={field.key} className="flex items-center gap-2 text-xs font-semibold md:col-span-2">
            <input
              type="checkbox"
              checked={values[field.key] === true}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked }))}
              data-testid={`input-${testid}-${field.key}`}
            />
            {field.label}
          </label>
        ) : (
          <label key={field.key} className="block text-xs font-semibold">
            {field.label}{field.required && <span className="text-destructive"> *</span>}
            {field.type === 'textarea' ? (
              <textarea
                value={values[field.key] as string}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="mt-1.5 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm"
                data-testid={`input-${testid}-${field.key}`}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.key] as string}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal shadow-sm"
                data-testid={`input-${testid}-${field.key}`}
              />
            )}
          </label>
        )))}
      </div>
      {(localError || error) && (
        <p role="alert" className="mt-3 text-xs font-semibold text-destructive" data-testid={`error-${testid}`}>{localError || error}</p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={submit} disabled={busy} data-testid={`button-submit-${testid}`}>{busy ? 'جارٍ الإضافة…' : 'حفظ'}</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} data-testid={`button-cancel-${testid}`}>إلغاء</Button>
      </div>
    </div>
  );
}

/** Field layouts for each add form. */
const SECTION_FORMS: Record<SectionKind, { title: string; fields: AddFormField[] }> = {
  experience: {
    title: 'إضافة خبرة عملية',
    fields: [
      { key: 'role', label: 'المسمى الوظيفي', required: true },
      { key: 'company', label: 'جهة العمل', required: true },
      { key: 'location', label: 'الموقع' },
      { key: 'startDate', label: 'سنة البداية', required: true, placeholder: '2021' },
      { key: 'endDate', label: 'سنة النهاية', placeholder: '2023 (اتركها فارغة إن كانت حالياً)' },
      { key: 'current', label: 'أعمل هنا حالياً', type: 'checkbox' },
      { key: 'description', label: 'وصف المهام', type: 'textarea' },
    ],
  },
  education: {
    title: 'إضافة مؤهل تعليمي',
    fields: [
      { key: 'degree', label: 'الدرجة', required: true },
      { key: 'field', label: 'التخصص' },
      { key: 'institution', label: 'الجهة التعليمية', required: true },
      { key: 'year', label: 'سنة التخرج', type: 'number', required: true, placeholder: '2020' },
    ],
  },
  project: {
    title: 'إضافة مشروع',
    fields: [
      { key: 'name', label: 'اسم المشروع', required: true },
      { key: 'url', label: 'رابط المشروع' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
    ],
  },
  certification: {
    title: 'إضافة شهادة',
    fields: [
      { key: 'name', label: 'اسم الشهادة', required: true },
      { key: 'issuer', label: 'الجهة المانحة' },
      { key: 'year', label: 'سنة الحصول عليها', type: 'number', placeholder: '2024' },
    ],
  },
};

export function CandidateProfilePage() {
  const { data, loading } = useDemo(demoApi.getProfile, []);
  const { user, updateUser } = useAuth();
  const [draft, setDraft] = useState<CandidateProfile | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [section, setSection] = useState<'' | SectionKind>('');
  const [sectionBusy, setSectionBusy] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reassess, setReassess] = useState<demoApi.Reassessment | null>(null);
  if (loading || (!data && !draft)) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  const profile = draft || data!;
  const update = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) => { setDraft({ ...profile, [key]: value }); setSaved(false); setSaveError(''); };
  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await demoApi.updateProfile(profile);
      setSaved(true);
      // The server reassessed the profile (completion + stored match scores)
      // — adopt the fresh completion so the dashboard shows the new number.
      if (updated?.reassessment) {
        setReassess(updated.reassessment);
        setDraft({ ...profile, completion: updated.reassessment.completion });
      }
    } catch (error) {
      // A rejected save must stay on the page and explain itself — an
      // uncaught ApiError here used to blow up into an error overlay.
      setSaved(false);
      setSaveError(
        error instanceof demoApi.ApiError
          ? error.status === 401
            ? 'انتهت صلاحية الجلسة — سجّل الدخول من جديد ثم أعد الحفظ.'
            : error.detail || `تعذّر حفظ الملف (${error.message})`
          : 'تعذّر حفظ الملف — تحقّق من اتصالك ثم أعد المحاولة.',
      );
    } finally {
      setSaving(false);
    }
  };
  const addSkill = () => { if (!newSkill.trim()) return; update('skills', [...profile.skills, { id: `skill-${Date.now()}`, name: newSkill.trim(), category: 'professional' }]); setNewSkill(''); };
  // Section items and the avatar are persisted by their own endpoints the
  // moment they succeed — update their draft slice without marking the main
  // حفظ الملف form as dirty. The reassessment's new completion rides along in
  // the same write so it can never clobber the list that was just appended.
  const setPersistedList = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K], completion?: number) =>
    setDraft({ ...profile, [key]: value, ...(typeof completion === 'number' ? { completion } : {}) });
  const toggleSection = (kind: SectionKind) => { setSection((current) => (current === kind ? '' : kind)); setSectionError(''); };
  const addSectionItem = async (kind: SectionKind, values: Record<string, string | boolean>) => {
    setSectionBusy(true);
    setSectionError('');
    try {
      let reassessment: demoApi.Reassessment | undefined;
      if (kind === 'experience') {
        const item = await demoApi.addExperience({
          role: String(values.role),
          company: String(values.company),
          location: String(values.location ?? '') || undefined,
          startDate: String(values.startDate),
          endDate: values.current ? undefined : (String(values.endDate ?? '') || undefined),
          current: values.current === true,
          description: String(values.description ?? '') || undefined,
        });
        reassessment = item.reassessment;
        setPersistedList('experiences', [...profile.experiences, item], reassessment?.completion);
      } else if (kind === 'education') {
        const item = await demoApi.addEducation({
          degree: String(values.degree),
          field: String(values.field ?? '') || undefined,
          institution: String(values.institution),
          year: Number(values.year),
        });
        reassessment = item.reassessment;
        setPersistedList('education', [...profile.education, item], reassessment?.completion);
      } else if (kind === 'project') {
        const item = await demoApi.addProject({
          name: String(values.name),
          url: String(values.url ?? '') || undefined,
          description: String(values.description ?? '') || undefined,
        });
        reassessment = item.reassessment;
        setPersistedList('projects', [...profile.projects, item], reassessment?.completion);
      } else {
        const item = await demoApi.addCertification({
          name: String(values.name),
          issuer: String(values.issuer ?? '') || undefined,
          year: values.year ? Number(values.year) : undefined,
        });
        reassessment = item.reassessment;
        setPersistedList('certifications', [...profile.certifications, item], reassessment?.completion);
      }
      // The server reassessed on insert (completion + stored match scores) —
      // surface what changed so the seeker sees the update actually land.
      if (reassessment) setReassess(reassessment);
      setSection('');
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'تعذر حفظ العنصر — أعد المحاولة.');
    } finally {
      setSectionBusy(false);
    }
  };
  const onPhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // re-picking the same file must fire again
    if (!file) return;
    setPhotoError('');
    setPhotoBusy(true);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    try {
      const avatarUrl = await demoApi.uploadAvatar(file);
      // Saved server-side already — no need to touch the حفظ button state.
      setDraft({ ...profile, avatarUrl });
      // Reflect it in the header/sidebar avatar circles right away.
      updateUser({ avatarUrl });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'تعذر رفع الصورة — حاول مرة أخرى.');
    } finally {
      URL.revokeObjectURL(preview);
      setPhotoPreview(null);
      setPhotoBusy(false);
    }
  };
  const removePhoto = async () => {
    setPhotoError('');
    setPhotoBusy(true);
    try {
      await demoApi.removeAvatar();
      setDraft({ ...profile, avatarUrl: null });
      // Fall back to initials in the header/sidebar circles too.
      updateUser({ avatarUrl: undefined });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'تعذر حذف الصورة — حاول مرة أخرى.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const avatarSrc = photoPreview ?? demoApi.fileSrc(profile.avatarUrl);
  return <RoleShell role="seeker">
    <PageHeader eyebrow="الملف المهني" title="كل ما تحتاجه الشركات لفهم مسارك." description="تحكم في قصتك المهنية، من العنوان الأول إلى تفضيلاتك للخطوة القادمة." action={<Button onClick={save} disabled={saving} data-testid="button-save-full-candidate-profile">{saving ? <Clock3 className="h-4 w-4" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}{saving ? 'جارٍ الحفظ…' : saved ? 'تم حفظ الملف' : 'حفظ الملف'}</Button>} />
    {saveError && (
      <div role="alert" data-testid="error-save-profile" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
        <span>{saveError}</span>
        <button type="button" onClick={() => setSaveError('')} className="text-xs font-bold underline opacity-80 hover:opacity-100" data-testid="button-dismiss-save-error">إخفاء</button>
      </div>
    )}
    {reassess && (
      <div role="status" data-testid="reassess-profile" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
        <span>تم حفظ التغييرات وإعادة تقييم ملفك — نسبة الاكتمال الآن {reassess.completion}%{reassess.reassessedMatches > 0 ? ` · أُعيد حساب ${reassess.reassessedMatches} من نتائج المطابقة${reassess.changedMatches > 0 ? ` (${reassess.changedMatches} تغيّرت)` : ''}` : ''}</span>
        <button type="button" onClick={() => setReassess(null)} className="text-xs font-bold underline opacity-80 hover:opacity-100" data-testid="button-dismiss-reassess">إخفاء</button>
      </div>
    )}
    <WorkflowGuide role="seeker" current="profile" />
    <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between md:p-6"><div className="flex items-center gap-4"><div className="relative"><div data-testid="box-profile-avatar" className="h-16 w-16 overflow-hidden rounded-2xl">{avatarSrc ? <img src={avatarSrc} alt={user?.name ?? ''} className="h-16 w-16 object-cover" data-testid="img-profile-avatar" /> : <div className="grid h-16 w-16 place-items-center bg-primary text-xl font-bold text-primary-foreground">{initials(user?.name)}</div>}</div><label title="تغيير صورة الملف" className="absolute -bottom-1.5 -end-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-border bg-card text-primary shadow-sm transition-colors hover:bg-muted" data-testid="label-upload-photo"><Camera className="h-3.5 w-3.5" /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhotoSelected} disabled={photoBusy} data-testid="input-profile-photo" aria-label="رفع صورة الملف الشخصي" /></label>{profile.avatarUrl && !photoBusy && <button type="button" onClick={removePhoto} aria-label="إزالة الصورة" title="إزالة الصورة" className="absolute -top-1.5 -end-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-xs font-bold text-muted-foreground shadow-sm hover:text-destructive" data-testid="button-remove-photo">×</button>}{photoBusy && <span className="absolute inset-0 grid place-items-center rounded-2xl bg-background/60"><Clock3 className="h-5 w-5 animate-spin text-primary" /></span>}</div><div><h2 className="text-xl font-bold">{profile.headline}</h2><p className="mt-1 text-sm text-muted-foreground">{profile.location} · متاح لفرص جديدة</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">ملف عام</span><span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">CV محلل</span></div></div></div><div className="flex items-center gap-4"><ScoreRing score={profile.completion} size="sm" /><div><p className="text-xs text-muted-foreground">اكتمال الملف</p><p className="mt-1 text-sm font-bold">أضف مشروعاً لرفع النتيجة</p></div></div></div>
    {photoError && (
      <div role="alert" data-testid="error-profile-photo" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
        <span>{photoError}</span>
        <button type="button" onClick={() => setPhotoError('')} className="text-xs font-bold underline opacity-80 hover:opacity-100">إخفاء</button>
      </div>
    )}
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]"><div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-base">المعلومات الشخصية</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Field label="العنوان المهني" value={profile.headline} onChange={(value) => update('headline', value)} /><Field label="الموقع" value={profile.location} onChange={(value) => update('location', value)} /><Field label="رقم الهاتف" value={profile.phone} onChange={(value) => update('phone', value)} /><Field label="البريد الإلكتروني" value={user?.email ?? ''} onChange={() => undefined} /><div className="md:col-span-2"><Field label="الملخص المهني" value={profile.summary} onChange={(value) => update('summary', value)} multiline /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">المهارات</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{profile.skills.map((skill: import('@/types').Skill) => <span key={skill.id} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{skill.name}<button onClick={() => update('skills', profile.skills.filter((item: import('@/types').Skill) => item.id !== skill.id))} aria-label={`إزالة ${skill.name}`} className="text-primary/60 hover:text-destructive">×</button></span>)}</div><div className="mt-5 flex max-w-md gap-2"><Input value={newSkill} onChange={(event) => setNewSkill(event.target.value)} placeholder="أضف مهارة جديدة" data-testid="input-new-candidate-skill" /><Button type="button" variant="outline" onClick={addSkill} data-testid="button-add-candidate-skill"><Plus className="h-4 w-4" />إضافة</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الخبرة العملية</CardTitle></CardHeader><CardContent className="space-y-6">{profile.experiences.map((item) => <div key={item.id} className="relative flex gap-4 border-s border-border ps-5 last:border-s-0"><span className="absolute -start-1.5 top-1 h-3 w-3 rounded-full bg-accent" /><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.role}</p><span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{item.startDate} — {item.endDate}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.company} · {item.location}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div>)}<Button type="button" variant="outline" className="w-full border-dashed" onClick={() => toggleSection('experience')} aria-expanded={section === 'experience'} data-testid="button-add-experience"><Plus className="h-4 w-4" />إضافة خبرة</Button>{section === 'experience' && <AddSectionForm title={SECTION_FORMS.experience.title} fields={SECTION_FORMS.experience.fields} testid="experience" busy={sectionBusy} error={sectionError} onSubmit={(values) => addSectionItem('experience', values)} onCancel={() => setSection('')} />}</CardContent></Card>
      <div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">التعليم</CardTitle></CardHeader><CardContent className="space-y-4">{profile.education.map((item) => <div key={item.id} className="rounded-xl bg-secondary/60 p-4"><p className="font-bold">{item.degree}</p><p className="mt-1 text-xs text-muted-foreground">{item.field}</p><p className="mt-2 text-xs">{item.institution} · {item.year}</p></div>)}<Button type="button" variant="outline" className="w-full border-dashed" onClick={() => toggleSection('education')} aria-expanded={section === 'education'} data-testid="button-add-education"><Plus className="h-4 w-4" />إضافة تعليم</Button>{section === 'education' && <AddSectionForm title={SECTION_FORMS.education.title} fields={SECTION_FORMS.education.fields} testid="education" busy={sectionBusy} error={sectionError} onSubmit={(values) => addSectionItem('education', values)} onCancel={() => setSection('')} />}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">المشاريع</CardTitle></CardHeader><CardContent className="space-y-4">{profile.projects.map((item) => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between"><p className="font-bold">{item.name}</p><Globe2 className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p></div>)}<Button type="button" variant="outline" className="w-full border-dashed" onClick={() => toggleSection('project')} aria-expanded={section === 'project'} data-testid="button-add-project"><Plus className="h-4 w-4" />إضافة مشروع</Button>{section === 'project' && <AddSectionForm title={SECTION_FORMS.project.title} fields={SECTION_FORMS.project.fields} testid="project" busy={sectionBusy} error={sectionError} onSubmit={(values) => addSectionItem('project', values)} onCancel={() => setSection('')} />}</CardContent></Card></div>
      <Card><CardHeader><CardTitle className="text-base">الشهادات والاعتمادات</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{profile.certifications.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent-foreground"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.issuer} · {item.year}</p></div></div>)}<Button type="button" variant="outline" className="border-dashed" onClick={() => toggleSection('certification')} aria-expanded={section === 'certification'} data-testid="button-add-certification"><Plus className="h-4 w-4" />إضافة شهادة</Button>{section === 'certification' && <AddSectionForm title={SECTION_FORMS.certification.title} fields={SECTION_FORMS.certification.fields} testid="certification" busy={sectionBusy} error={sectionError} onSubmit={(values) => addSectionItem('certification', values)} onCancel={() => setSection('')} />}</CardContent></Card>
    </div><div className="space-y-6">
      <Card className="bg-secondary/50"><CardHeader><CardTitle className="text-base">تفضيلات العمل</CardTitle></CardHeader><CardContent className="space-y-4"><label className="block text-xs font-semibold">المجالات المفضلة<select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={profile.preferences.industries[0] ?? ''} onChange={(event) => update('preferences', { ...profile.preferences, industries: [event.target.value] })}><option>تقنية المعلومات</option><option>التقنية المالية</option><option>الاستشارات</option></select></label><label className="block text-xs font-semibold">نوع العقد<select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={profile.preferences.contract} onChange={(event) => update('preferences', { ...profile.preferences, contract: event.target.value as CandidateProfile['preferences']['contract'] })}><option value="full-time">دوام كامل</option><option value="part-time">دوام جزئي</option><option value="contract">عقد مستقل</option></select></label><label className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-xs"><span><span className="block font-bold">العمل عن بعد</span><span className="mt-1 block text-muted-foreground">أظهر فرص العمل المرنة</span></span><input type="checkbox" checked={profile.preferences.remote} onChange={(event) => update('preferences', { ...profile.preferences, remote: event.target.checked })} /></label></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">السيرة الذاتية</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div><div className="flex-1"><p className="text-sm font-bold">{profile.cvStatus !== 'missing' ? 'السيرة المرفوعة' : 'لم تُرفع سيرة بعد'}</p><p className="mt-1 text-xs text-muted-foreground">{profile.cvStatus === 'analyzed' ? 'تم التحليل — راجع المعلومات المستخرجة' : 'ارفع سيرتك من صفحة السيرة الذاتية'}</p></div></div><Link href="/seeker/cv" className="mt-5 block rounded-lg border border-border px-3 py-2.5 text-center text-xs font-bold hover:bg-muted">مراجعة السيرة</Link></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الظهور والخصوصية</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><label className="flex items-start gap-3"><input type="checkbox" defaultChecked className="mt-0.5" /><span><span className="font-bold">السماح للشركات برؤية ملفي</span><span className="mt-1 block leading-5 text-muted-foreground">اعرض ملفك ضمن التوصيات المناسبة فقط.</span></span></label><label className="flex items-start gap-3"><input type="checkbox" defaultChecked className="mt-0.5" /><span><span className="font-bold">إشعارات الفرص الجديدة</span><span className="mt-1 block leading-5 text-muted-foreground">أرسل لي فرصاً تتجاوز 80% تطابق.</span></span></label></CardContent></Card>
    </div></div>
  </RoleShell>;
}

export function CompanyDashboardPage() {
  const { data: rawCompany, loading } = useDemo(demoApi.company, []);
  const company = typeof rawCompany === 'function' ? null : rawCompany;
  const { data: rawJobs } = useDemo(demoApi.getCompanyJobs, []);
  const jobs = typeof rawJobs === 'function' ? null : rawJobs;
  // Real funnel: computed from the applications table, not invented numbers.
  const { data: rawFunnel } = useDemo(demoApi.companyFunnel, []);
  const funnel = typeof rawFunnel === 'function' ? null : rawFunnel;
  // Candidates belong to a real job, so derive the id from loaded data
  // rather than hardcoding a demo id that no longer exists in the database.
  const firstJobId = jobs?.[0]?.id;
  const { data: rawCandidates } = useDemo(
    () => (firstJobId ? demoApi.candidates(firstJobId) : Promise.resolve([])),
    [firstJobId],
  );
  const candidates = typeof rawCandidates === 'function' ? null : rawCandidates;
  if (loading || !company) return <RoleShell role="company"><LoadingState /></RoleShell>;
  // Completeness derived from the fields the company actually filled in —
  // the old card claimed a hardcoded 92% for every account.
  const profileFields = [company.name, company.industry, company.location, company.website, company.description];
  const health = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  // Team activity built from the real funnel and job list.
  const companyFeed: ActivityItem[] = [
    ...(funnel?.jobs ?? []).slice(0, 2).map((j) => ({ title: `${j.total} طلب على ${j.title}`, detail: typeof j.avgMatch === 'number' ? `متوسط تطابق ${j.avgMatch}%` : 'قيد المتابعة', tone: 'primary' as const })),
    ...(jobs ?? []).slice(0, 2).map((j) => ({ title: `وظيفة ${j.title}`, detail: j.status === 'active' ? 'منشورة الآن' : 'موقوفة', tone: 'neutral' as const })),
  ].slice(0, 4);
  return <RoleShell role="company">
    <PageHeader eyebrow="لوحة الشركة" title="مركز التوظيف الذي يرى الصورة كاملة." description="من أداء الوظائف إلى جودة المرشحين، كل قرار يبدأ من بيانات أوضح." action={<div className="flex gap-2"><Link href="/company/profile" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">ملف الشركة</Link><Link href="/company/jobs/new" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="me-1 inline h-4 w-4" />إضافة وظيفة</Link></div>} />
    <WorkflowGuide role="company" current="manage" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="الوظائف النشطة" value={jobs?.filter((j) => j.status === 'active').length || 0} detail={`${jobs?.length ?? 0} وظيفة إجمالاً`} icon={BriefcaseBusiness} /><MetricCard label="طلبات التقديم" value={funnel?.totals.total ?? 0} detail="من كل وظائفك" icon={FileText} /><MetricCard label="قيد المراجعة" value={funnel?.totals.reviewing ?? 0} detail={`${funnel?.totals.shortlisted ?? 0} في القائمة المختصرة`} icon={Users} tone="accent" /><MetricCard label="متوسط التطابق" value={funnel?.totals.avgMatch != null ? `${funnel.totals.avgMatch}%` : '—'} detail="من نتائج المطابقة الفعلية" icon={Target} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">قمع التوظيف</CardTitle><p className="mt-1 text-xs text-muted-foreground">محسوب من طلبات التقديم الفعلية</p></div><Link href="/company/jobs" className="text-xs font-bold text-primary">كل الوظائف</Link></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-4">{[['جديد', funnel?.totals.applied ?? 0, 'bg-primary'], ['قيد المراجعة', funnel?.totals.reviewing ?? 0, 'bg-primary/70'], ['مختصر', funnel?.totals.shortlisted ?? 0, 'bg-accent'], ['مقابلة', funnel?.totals.interview ?? 0, 'bg-[#123e43]']].map(([label, value, color]) => <div key={label as string} className="rounded-xl bg-secondary p-4"><div className={`mb-4 h-1.5 rounded-full ${color as string}`} /><p className="text-2xl font-bold">{value as number}</p><p className="mt-1 text-xs text-muted-foreground">{label as string}</p></div>)}</div>{(funnel?.jobs?.length ?? 0) > 0 && <div className="mt-6 space-y-2">{funnel!.jobs.map((j) => <div key={j.jobId} className="flex items-center justify-between gap-3 text-xs" data-testid={`row-funnel-job-${j.jobId}`}><span className="truncate font-semibold">{j.title}</span><span className="shrink-0 text-muted-foreground">{j.total} طلب{typeof j.avgMatch === 'number' ? ` · تطابق ${j.avgMatch}%` : ''}</span></div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">نشاط الفريق</CardTitle></CardHeader><CardContent><ActivityList items={companyFeed} /></CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">أفضل المرشحين الآن</CardTitle><Link href={firstJobId ? `/company/jobs/${firstJobId}/candidates` : '/company/jobs'} className="text-xs font-bold text-primary" data-testid="link-top-candidates-list">عرض القائمة</Link></CardHeader><CardContent className="space-y-3">{(candidates || []).map((candidate) => <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary font-bold text-primary">{candidate.name.slice(0, 2)}</div><div className="flex-1"><p className="text-sm font-bold">{candidate.name}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.headline}</p><div className="mt-2 flex flex-wrap gap-1.5">{candidate.matchedSkills.map((skill) => <span key={skill.id} className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">{skill.name}</span>)}</div></div><div className="text-start sm:text-end"><p className="text-xl font-bold text-primary">{candidate.score}%</p><p className="text-[10px] text-muted-foreground">تطابق</p></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">صحة ملف الشركة</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-bold">ملف موثق</p><p className="mt-1 text-xs text-muted-foreground">تظهر شارة التحقق للمرشحين</p></div></div><div className="mt-6 space-y-3 text-xs"><div className="flex items-center justify-between"><span>اكتمال المعلومات</span><span className="font-bold text-primary">{health}%</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${health}%` }} /></div><Link href="/company/profile" className="mt-4 block text-center text-xs font-bold text-primary">تحسين الملف</Link></div></CardContent></Card></div>
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
      <p className="mt-1 text-xs text-muted-foreground">تحتاج المنصة إلى بيانات دقيقة قبل عرض شارة التحقق أمام المرشحين.</p>
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
  const [emailGate, setEmailGate] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

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
    setEmailGate(false);
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
      // The API refuses companies whose email is unconfirmed (403); show the
      // dedicated gate instead of a generic failure.
      if (err instanceof demoApi.ApiError && err.status === 403 && err.message === 'Email verification required') {
        setEmailGate(true);
      } else {
        setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب');
      }
    } finally {
      setRequesting(false);
      setState((s) => (s === 'saving' ? 'idle' : s));
    }
  };

  const resendVerificationEmail = async () => {
    const email = (JSON.parse(localStorage.getItem('hime_ai_user') || '{}') as { email?: string }).email || '';
    setResendState('sending');
    try {
      await demoApi.resendVerification(email);
      setResendState('sent');
    } catch {
      setResendState('idle');
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

    {emailGate && (
      <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4" data-testid="banner-email-verification-required">
        <p className="text-sm font-bold">أكّد بريدك الإلكتروني أولاً</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          طلب التحقق من الشركة يتطلب بريداً مؤكداً. أرسلنا رابط التأكيد إلى بريدك — افتحه ثم أعد المحاولة.
        </p>
        {resendState === 'sent' ? (
          <p className="mt-2 text-xs font-semibold text-primary" role="status" data-testid="status-email-resend-sent">إذا كان البريد بانتظر التأكيد فسيصلك رابط جديد.</p>
        ) : (
          <button type="button" onClick={resendVerificationEmail} disabled={resendState === 'sending'} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground" data-testid="button-resend-verification">
            {resendState === 'sending' ? 'جارٍ الإرسال…' : 'إرسال رابط التأكيد مجدداً'}
          </button>
        )}
      </div>
    )}

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
  // Counts derived from the loaded lists — the old cards showed invented
  // percentages ("+8.4%", "3 بانتظار") and fake service uptimes.
  const pendingCompanies = (companies || []).filter((c) => !c.verified).length;
  const verifiedCompanies = (companies || []).filter((c) => c.verified).length;
  const activeJobs = (jobs || []).filter((j) => j.status === 'active').length;
  const feed: ActivityItem[] = [
    ...(companies || []).slice(0, 2).map((c) => ({ title: `شركة ${c.name}`, detail: `${c.industry} · ${c.verified ? 'موثقة' : 'قيد التحقق'}`, tone: (c.verified ? 'primary' : 'accent') as ActivityItem['tone'] })),
    ...(jobs || []).slice(0, 2).map((j) => ({ title: `وظيفة ${j.title}`, detail: `${j.applicants} متقدم`, tone: 'neutral' as const })),
  ].slice(0, 4);
  return <RoleShell role="admin">
    <PageHeader eyebrow="إدارة المنصة" title="صورة HiMe AI التشغيلية." description="راقب صحة المنصة، راجع قوائم الانتظار، وتابع جودة التجربة للباحثين والشركات." action={<Link href="/admin/profile" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"><ShieldCheck className="me-1 inline h-4 w-4" />ملفي وصلاحياتي</Link>} />
    <WorkflowGuide role="admin" current="dashboard" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="الباحثون" value={stats.candidates.toLocaleString()} detail="حسابات باحثين مسجلة" icon={Users} /><MetricCard label="الشركات" value={stats.companies.toLocaleString()} detail={`${pendingCompanies} بانتظار التحقق`} icon={Building2} /><MetricCard label="الوظائف" value={stats.jobs.toLocaleString()} detail={`${activeJobs} نشطة الآن`} icon={BriefcaseBusiness} tone="accent" /><MetricCard label="طلبات التقديم" value={stats.applications.toLocaleString()} detail="من جميع الشركات" icon={FileText} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">صحة المنصة</CardTitle><p className="mt-1 text-xs text-muted-foreground">أرقام حية من قاعدة بيانات المنصة</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"><span className="me-1 inline-block h-2 w-2 rounded-full bg-primary" />كل الأنظمة تعمل</span></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[['باحثون مسجلون', stats.candidates.toLocaleString()], ['شركات على المنصة', stats.companies.toLocaleString()], ['طلبات تقديم', stats.applications.toLocaleString()]].map(([label, value]) => <div key={label} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">حسب البيانات الفعلية</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">إجراءات تحتاج انتباهك</CardTitle></CardHeader><CardContent className="space-y-3"><Link href="/admin/companies" className="flex items-center justify-between rounded-xl bg-accent/10 p-3 text-xs"><span><span className="block font-bold">شركات بانتظار التحقق</span><span className="mt-1 block text-muted-foreground">{pendingCompanies > 0 ? `مراجعة ${pendingCompanies} طلبات` : 'لا توجد طلبات معلقة'}</span></span><span className="rounded-full bg-accent px-2 py-1 font-bold text-accent-foreground">{pendingCompanies}</span></Link><Link href="/admin/jobs" className="flex items-center justify-between rounded-xl bg-secondary p-3 text-xs"><span><span className="block font-bold">شركات موثقة</span><span className="mt-1 block text-muted-foreground">من إجمالي {stats.companies} شركة</span></span><span className="rounded-full bg-primary px-2 py-1 font-bold text-primary-foreground">{verifiedCompanies}</span></Link><Link href="/admin/applications" className="flex items-center justify-between rounded-xl border border-border p-3 text-xs"><span><span className="block font-bold">طلبات التقديم</span><span className="mt-1 block text-muted-foreground">إجمالي الطلبات على المنصة</span></span><span className="rounded-full bg-muted px-2 py-1 font-bold">{stats.applications}</span></Link></CardContent></Card></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">آخر الشركات والوظائف</CardTitle><Link href="/admin/companies" className="text-xs font-bold text-primary">إدارة الكل</Link></CardHeader><CardContent className="space-y-3">{(companies || []).slice(0, 3).map((company) => <div key={company.id} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{company.name}</p><p className="mt-1 text-xs text-muted-foreground">{company.industry} · {company.location}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${company.verified ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>{company.verified ? 'موثقة' : 'قيد المراجعة'}</span></div>)}<div className="border-t border-border pt-3 text-xs text-muted-foreground">إجمالي الوظائف النشطة: <span className="font-bold text-foreground">{jobs?.filter((job) => job.status === 'active').length || 0}</span> وظيفة منشورة الآن</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">سجل النشاط</CardTitle></CardHeader><CardContent><ActivityList items={feed} /></CardContent></Card></div>
  </RoleShell>;
}

export function AdminProfilePage() {
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  return <RoleShell role="admin">
    <PageHeader eyebrow="حساب الإدارة" title="ملفي وصلاحياتي." description="إدارة بيانات الحساب، مستوى الوصول، وتفضيلات الإشعارات." action={<Button onClick={() => setSaved(true)}>{saved ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}{saved ? 'تم الحفظ' : 'حفظ التغييرات'}</Button>} />
    <WorkflowGuide role="admin" current="profile" />
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><div className="space-y-6">
      <Card><CardHeader><CardTitle className="text-base">بيانات الحساب</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><Field label="الاسم الكامل" value={user?.name ?? ''} onChange={() => undefined} /><Field label="البريد الإلكتروني" value={user?.email ?? ''} onChange={() => undefined} /><Field label="المسمى الوظيفي" value="مدير المنصة" onChange={() => undefined} /><Field label="المنطقة الزمنية" value="Asia/Riyadh" onChange={() => undefined} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الصلاحيات الحالية</CardTitle></CardHeader><CardContent className="space-y-3">{adminPermissions.map((permission) => <div key={permission.label} className="flex items-center gap-3 rounded-xl border border-border p-4"><div className={`grid h-9 w-9 place-items-center rounded-lg ${permission.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><ShieldCheck className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{permission.label}</p><p className="mt-1 text-xs text-muted-foreground">{permission.detail}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${permission.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{permission.enabled ? 'مفعلة' : 'مقيدة'}</span></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">الأمان</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><button className="rounded-xl border border-border p-4 text-start hover:bg-muted"><p className="text-sm font-bold">تغيير كلمة المرور</p><p className="mt-1 text-xs text-muted-foreground">حدّثها دورياً لحماية الوصول الإداري</p></button><button className="rounded-xl border border-border p-4 text-start hover:bg-muted"><p className="text-sm font-bold">الجلسة الحالية</p><p className="mt-1 text-xs text-muted-foreground">أنت مسجّل الدخول على هذا الجهاز</p></button></CardContent></Card>
    </div><div className="space-y-6"><Card className="bg-sidebar text-sidebar-foreground"><CardContent className="p-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f2c66d] text-lg font-bold text-[#123e43]">{initials(user?.name)}</div><p className="mt-5 text-lg font-bold">{user?.name ?? '—'}</p><p className="mt-1 text-xs text-sidebar-foreground/60">مدير المنصة · وصول إداري</p><div className="mt-6 border-t border-white/10 pt-5 text-xs text-sidebar-foreground/65"><p>البريد الإلكتروني</p><p className="mt-1 font-semibold text-sidebar-foreground">{user?.email ?? '—'}</p></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">الإشعارات</CardTitle></CardHeader><CardContent className="space-y-4 text-xs"><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">تنبيهات المراجعة</span><span className="mt-1 block text-muted-foreground">بلاغات وتحقق الشركات</span></span><input type="checkbox" defaultChecked /></label><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">ملخص يومي</span><span className="mt-1 block text-muted-foreground">إحصاءات المنصة الرئيسية</span></span><input type="checkbox" defaultChecked /></label><label className="flex items-start justify-between gap-3"><span><span className="block font-bold">تنبيهات النظام</span><span className="mt-1 block text-muted-foreground">الصحة والأخطاء الحرجة</span></span><input type="checkbox" defaultChecked /></label></CardContent></Card></div></div>
  </RoleShell>;
}