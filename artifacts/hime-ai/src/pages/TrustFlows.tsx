import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowDownLeft, ArrowUpLeft, BriefcaseBusiness, Check, CheckCircle2, CircleAlert, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/i18n';
import { useDemo } from '@/hooks/use-demo';
import { DashboardLayout } from '@/layouts';
import { useAuth } from '@/contexts/auth-context';
import { resolvePostAuthRedirect, readNextParam, resolveRegistrationRedirect, roleHome } from '@/lib/routes';
import { login, register, getJob, apply as applyToJob, getProfile, uploadCv, forgotPassword, resetPassword, verifyEmail, resendVerification } from '@/services/api/demo-api';
import { validateCvFile, validateLogin, validateRegistration } from '@/services/validation';
import { FeedbackState, LoadingState, PublicNav } from '@/components/app-kit';
import { BrandMark, BrandPattern } from '@/components/brand-pattern';
import { WorkflowGuide } from '@/components/workflow-guide';

const DEMO_ACCOUNTS = {
  seeker: { email: 'seeker@hime.ai', label: 'باحث عن عمل' },
  company: { email: 'company@hime.ai', label: 'شركة' },
  admin: { email: 'admin@hime.ai', label: 'إدارة' },
} as const;

function AuthFrame({ title, subtitle, side, children }: { title: string; subtitle: string; side: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[.9fr_1.1fr]">
      <div className="relative isolate hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <BrandPattern className="-z-10 text-[#f2c66d] opacity-[0.13]" />
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight" data-testid="link-trust-auth-logo">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2c66d] text-[#123e43]"><BrandMark className="h-[18px] w-[18px]" /></span>
          <span className="text-lg">HiMe <span className="text-[#f2c66d]">AI</span></span>
        </Link>
        <div>
          <p className="mb-5 text-xs uppercase tracking-[.2em] text-[#f2c66d]">HiMe AI</p>
          <h1 className="max-w-md text-4xl font-bold leading-tight">{side}</h1>
          <div className="mt-8 flex gap-3 text-sm text-sidebar-foreground/60"><ShieldCheck className="h-5 w-5 text-[#f2c66d]" />قرارات مهنية أكثر وعياً</div>
        </div>
        <p className="text-xs text-sidebar-foreground/50">بياناتك محفوظة بأمان، ونستخدم الذكاء الاصطناعي لمساعدتك على اتخاذ قرار أوضح.</p>
      </div>
      <div className="flex flex-col p-5 md:p-10">
        <div className="mb-16 flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden" data-testid="link-trust-auth-mobile-logo"><span className="font-bold">HiMe <span className="text-accent">AI</span></span></Link>
          <Link href="/jobs" className="text-xs font-semibold text-muted-foreground" data-testid="link-trust-auth-jobs">استكشف الوظائف <ArrowUpLeft className="inline h-3 w-3" /></Link>
        </div>
        <div className="mx-auto w-full max-w-md">
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-xs text-muted-foreground">بالاستمرار، أنت توافق على سياسة الخصوصية وشروط الاستخدام.</p>
        </div>
      </div>
    </div>
  );
}

function FieldWithError({ label, value, onChange, type = 'text', placeholder, error, testId, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; error?: string; testId: string; autoComplete?: string }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-2 block">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${testId}-error` : undefined} data-testid={testId} />
      {error && <span id={`${testId}-error`} className="mt-1.5 block text-xs font-normal text-destructive" role="alert">{error}</span>}
    </label>
  );
}

export function LoginPage() {
  const { t } = useLanguage();
  const { login: performLogin } = useAuth();
  const [, navigate] = useLocation();
  // Capture ?next= before the router rewrites the query string.
  const [nextParam] = useState(() => readNextParam(window.location.search));
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<ReturnType<typeof validateLogin>>({});
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<'seeker' | 'company' | 'admin'>('seeker');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotState, setForgotState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [forgotMessage, setForgotMessage] = useState('');

  const sendForgot = async () => {
    setForgotState('sending');
    try {
      const res = await forgotPassword(forgotEmail);
      setForgotMessage(res.message || 'إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة التعيين.');
      setForgotState('sent');
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'تعذر إرسال الطلب. حاول مرة أخرى.');
      setForgotState('error');
    }
  };

  // Functional update: a stale `values` closure can otherwise drop a sibling
  // field when two updates land in the same React batch.
  const field = (key: string) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await performLogin(values.email, values.password);
      // performLogin persists synchronously via AuthProvider.
      const signedIn = JSON.parse(localStorage.getItem('hime_ai_user') || '{}');
      navigate(resolvePostAuthRedirect(signedIn.role, nextParam));
    } catch (err) {
      setErrors({ password: err instanceof Error ? err.message : 'Login failed' });
    } finally {
      setPending(false);
    }
  };

  const fillDemo = (value: 'seeker' | 'company' | 'admin') => {
    setRole(value);
    setValues({ email: DEMO_ACCOUNTS[value].email, password: 'password123' });
    setErrors({});
  };

  return (
    <AuthFrame title="مرحباً بعودتك" subtitle="مساحتك المهنية، كما تركتها." side="رؤيتك المهنية تستحق مساحة واضحة.">
      <form onSubmit={submit} noValidate className="space-y-5" aria-label="تسجيل الدخول">
        <FieldWithError label="البريد الإلكتروني" value={values.email} onChange={(email) => field('email')(email)} type="email" placeholder="name@example.com" autoComplete="email" error={errors.email} testId="input-login-email" />
        <FieldWithError label="كلمة المرور" value={values.password} onChange={(password) => field('password')(password)} type="password" placeholder="8 أحرف على الأقل" autoComplete="current-password" error={errors.password} testId="input-login-password" />
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-remember" /> تذكرني</label>
          <button type="button" className="font-bold text-primary" data-testid="button-forgot-password" onClick={() => setForgotOpen((prev) => !prev)} aria-expanded={forgotOpen}>نسيت كلمة المرور؟</button>
        </div>

        {forgotOpen && (
          <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4" data-testid="panel-forgot-password">
            {forgotState !== 'sent' ? (
              <>
                <p className="text-xs text-muted-foreground">أدخل بريدك وسنرسل رابط إعادة التعيين.</p>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  data-testid="input-forgot-email"
                />
                <Button type="button" onClick={sendForgot} disabled={forgotState === 'sending' || !forgotEmail.includes('@')} data-testid="button-submit-forgot">
                  {forgotState === 'sending' ? 'جارٍ الإرسال…' : 'إرسال رابط إعادة التعيين'}
                </Button>
              </>
            ) : (
              <p className="text-xs font-semibold text-primary" role="status" data-testid="status-forgot-sent">{forgotMessage}</p>
            )}
            {forgotState === 'error' && (
              <p className="text-xs text-destructive" role="alert" data-testid="error-forgot">{forgotMessage}</p>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold">حساب تجريبي جاهز</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DEMO_ACCOUNTS) as Array<'seeker' | 'company' | 'admin'>).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => fillDemo(value)}
                className={`rounded-lg border p-2 text-xs font-semibold ${role === value ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                aria-pressed={role === value}
                data-testid={`button-login-role-${value}`}
              >
                {DEMO_ACCOUNTS[value].label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={pending} data-testid="button-submit-login">
          {pending ? 'جارٍ التحقق…' : t('signIn')}
        </Button>

        <p className="text-center text-sm text-muted-foreground" data-testid="text-login-register-prompt">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-bold text-primary hover:underline" data-testid="link-register-from-login">
            أنشئ حساباً جديداً
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register: performRegister } = useAuth();
  const [, navigate] = useLocation();
  const initialRole = new URLSearchParams(window.location.search).get('role') === 'company' ? 'company' : 'seeker';
  const [values, setValues] = useState({ name: '', email: '', password: '', role: initialRole as 'seeker' | 'company', termsAccepted: false });
  const [errors, setErrors] = useState<ReturnType<typeof validateRegistration>>({});
  const [pending, setPending] = useState(false);

  // Functional update: a stale `values` closure can otherwise drop a sibling
  // field when two updates land in the same React batch.
  const field = (key: string) => (value: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      const result = await performRegister(values.name, values.email, values.password, values.role);
      // First-time accounts drop into onboarding: seeker -> upload CV,
      // company -> fill in company details.
      navigate(resolveRegistrationRedirect(values.role, result.onboarding !== false));
    } catch (err) {
      setErrors({ email: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFrame title="ابدأ من مكانك" subtitle="أنشئ مساحة تساعدك على الخطوة التالية." side="سواء كنت تبحث عن فرصة أو عن الشخص المناسب، ابدأ بمعلومة أوضح.">
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="إنشاء حساب">
        <FieldWithError label="الاسم الكامل" value={values.name} onChange={(name) => field('name')(name)} placeholder="اكتب اسمك" autoComplete="name" error={errors.name} testId="input-register-name" />
        <FieldWithError label="البريد الإلكتروني" value={values.email} onChange={(email) => field('email')(email)} type="email" placeholder="name@example.com" autoComplete="email" error={errors.email} testId="input-register-email" />
        <FieldWithError label="كلمة المرور" value={values.password} onChange={(password) => field('password')(password)} type="password" placeholder="8 أحرف على الأقل" autoComplete="new-password" error={errors.password} testId="input-register-password" />
        <div>
          <p className="mb-2 text-sm font-semibold">نوع الحساب</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => field('role')('seeker')} className={`rounded-lg border p-3 text-sm font-semibold ${values.role === 'seeker' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`} aria-pressed={values.role === 'seeker'} data-testid="button-role-seeker">باحث عن عمل</button>
            <button type="button" onClick={() => field('role')('company')} className={`rounded-lg border p-3 text-sm font-semibold ${values.role === 'company' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`} aria-pressed={values.role === 'company'} data-testid="button-role-company">شركة</button>
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <input type="checkbox" checked={values.termsAccepted} onChange={(event) => field('termsAccepted')(event.target.checked)} aria-invalid={Boolean(errors.termsAccepted)} data-testid="checkbox-terms" />
          <span>أوافق على شروط الاستخدام وسياسة الخصوصية.</span>
        </label>
        {errors.termsAccepted && <p className="text-xs text-destructive" role="alert" data-testid="error-register-terms">{errors.termsAccepted}</p>}
        <Button type="submit" className="w-full" disabled={pending} data-testid="button-submit-register">
          {pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </Button>

        <p className="text-center text-sm text-muted-foreground" data-testid="text-register-login-prompt">
          لديك حساب بالفعل،{' '}
          <Link href="/login" className="font-bold text-primary hover:underline" data-testid="link-login-from-register">
            قم بتسجيل الدخول
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: job, loading, error, reload } = useDemo(() => getJob(id || ''), [id]);
  const [applyState, setApplyState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const apply = async () => {
    if (!job) return;
    setApplyState('submitting');
    try {
      await applyToJob(job.id);
      setApplyState('success');
    } catch {
      setApplyState('error');
    }
  };

  if (loading) return <><PublicNav /><main className="mx-auto max-w-5xl px-4 py-16"><LoadingState /></main></>;
  if (error || !job) return <><PublicNav /><main className="mx-auto max-w-5xl px-4 py-16"><FeedbackState error={error || 'الوظيفة غير موجودة'} retry={reload} /></main></>;

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-16">
        <Link href="/jobs" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground" data-testid="link-back-jobs"><ArrowDownLeft className="h-4 w-4" />العودة للوظائف</Link>
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-8 flex gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"><BriefcaseBusiness className="h-7 w-7" /></div><div><h1 className="text-3xl font-bold">{job.title}</h1><p className="mt-2 text-muted-foreground">{job.company.name} · {job.location}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs">{job.experience}</span><span className="rounded-full bg-muted px-3 py-1 text-xs">{job.contract}</span><span className="rounded-full bg-muted px-3 py-1 text-xs">{job.industry}</span></div></div></div>
            <section className="prose prose-sm max-w-none"><h2>عن الدور</h2><p>{job.description}</p><h2>المهارات المطلوبة</h2><div className="not-prose flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <span key={skill.id} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">{skill.name}</span>)}</div><h2>المهارات المفضلة</h2><div className="not-prose flex flex-wrap gap-2">{job.preferredSkills.map((skill) => <span key={skill.id} className="rounded-lg bg-muted px-3 py-2 text-xs">{skill.name}</span>)}</div><h2>المؤهلات</h2><p>{job.education}</p></section>
          </div>
          <aside><Card className="sticky top-24"><CardContent className="p-6"><p className="text-xs text-muted-foreground">النطاق المتوقع</p><p className="mt-1 text-lg font-bold">{job.salary}</p><div className="my-5 space-y-3 border-y border-border py-5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">آخر موعد</span><span>{job.deadline}</span></div><div className="flex justify-between"><span className="text-muted-foreground">المتقدمون</span><span>{job.applicants}</span></div></div>{applyState === 'success' ? <div className="rounded-lg bg-primary/10 p-3 text-center text-sm font-semibold text-primary" data-testid="status-application-success" role="status"><CheckCircle2 className="mx-auto mb-1 h-5 w-5" />تم إرسال طلبك بنجاح</div> : <><Button className="w-full" onClick={apply} disabled={applyState === 'submitting'} data-testid="button-apply-job">{applyState === 'submitting' ? 'جارٍ إرسال الطلب…' : t('apply')} <ArrowUpLeft className="h-4 w-4" /></Button>{applyState === 'error' && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-center text-xs text-destructive" data-testid="error-application" role="alert">تعذر إرسال الطلب حالياً. حاول مرة أخرى.</p>}</>}<p className="mt-3 text-center text-[11px] text-muted-foreground">سيتم ربط التقديم بحسابك عند تسجيل الدخول.</p></CardContent></Card></aside>
        </div>
      </main>
    </>
  );
}

export function SeekerCvPage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { data: profile, loading } = useDemo(getProfile, []);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [extracted, setExtracted] = useState<{
    headline?: string;
    summary?: string;
    skills?: string[];
    experiences?: unknown[];
    education?: unknown[];
    projects?: unknown[];
  } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [parseWarning, setParseWarning] = useState('');

  const upload = async (file?: File) => {
    const validationError = validateCvFile(file);
    setUploadError(validationError);
    setParseWarning('');
    setUploaded(false);
    if (validationError || !file) return;

    setUploading(true);
    try {
      const result = await uploadCv(file);
      setUploaded(true);
      // Show what the model actually pulled out of THIS file — and say so
      // when it could not be read instead of silently falling back to older
      // data that may not match the document at all.
      const res = result as { cvParsedData?: typeof extracted; parsed?: boolean; parseError?: string };
      if (res.cvParsedData && (res.parsed ?? true)) {
        setExtracted(res.cvParsedData);
      } else {
        setExtracted(null);
        setParseWarning(res.parseError || 'تعذر تحليل هذا الملف نصياً — تأكد أن السيرة نصية وليست صورة ممسوحة ضوئياً.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'تعذر رفع السيرة الذاتية حالياً. حاول مرة أخرى.');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !profile) return <DashboardLayout role="seeker"><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout role="seeker">
      <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-primary">السيرة الذاتية</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">حوّل سيرتك إلى صورة قابلة للفهم.</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">نستخرج المعلومات لتراجعها، لا لنقرر بدلاً عنك.</p></div>
      <WorkflowGuide role="seeker" current="cv" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card><CardContent className="p-6 md:p-8">
            <label className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed ${uploading ? 'border-accent bg-accent/5' : uploadError ? 'border-destructive bg-destructive/5' : 'border-primary/30 bg-primary/5'} p-8 text-center`}>
              <input type="file" accept=".pdf,.docx" className="sr-only" onChange={(event) => upload(event.target.files?.[0])} data-testid="input-cv-upload" aria-label="رفع السيرة الذاتية" />
              <UploadCloud className="h-9 w-9 text-primary" />
              <p className="mt-4 font-bold">{uploading ? 'جارٍ تحليل السيرة…' : uploaded ? 'تم تحديث السيرة الذاتية' : 'اسحب ملفك هنا أو اختره'}</p>
              <p className="mt-2 text-xs text-muted-foreground">PDF أو DOCX · حتى 10MB</p>
              {uploading && <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-muted" data-testid="status-cv-uploading"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div>}
            </label>
            {uploadError && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" data-testid="error-cv-upload" role="alert">{uploadError}</p>}
            {uploaded && <div className="mt-3 space-y-3 rounded-lg bg-primary/10 p-4" data-testid="status-cv-success" role="status">
              <p className="text-xs font-semibold text-primary">تم رفع الملف واستخراج المعلومات تلقائياً.</p>
              <Button className="w-full" onClick={() => navigate('/seeker/profile')} data-testid="button-continue-profile">
                متابعة إكمال بقية المعلومات <ArrowUpLeft className="h-4 w-4" />
              </Button>
            </div>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />AI extracted profile</CardTitle></CardHeader><CardContent><div className="rounded-xl bg-secondary/60 p-5"><div className="flex items-center justify-between"><span className="text-sm font-bold">{extracted?.headline || profile.headline || 'لم يُستخرج بعد'}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">مستخرج</span></div><p className="mt-3 text-xs leading-6 text-muted-foreground">{extracted?.summary || profile.summary || 'ارفع سيرتك ليستخرج النظام ملخصاً مهنياً تراجعه بنفسك.'}</p><div className="mt-4 flex flex-wrap gap-2">{(extracted?.skills?.length ? extracted.skills : profile.skills.map((s) => s.name)).map((name, i) => <span key={`${name}-${i}`} className="rounded-md bg-background px-2 py-1 text-[11px]">{name}</span>)}</div>
                  {extracted && (extracted.experiences?.length || extracted.education?.length || extracted.projects?.length) ? (
                    <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground" data-testid="text-cv-extract-counts">
                      من الملف كاملاً: {extracted.experiences?.length ?? 0} خبرة عمل · {extracted.education?.length ?? 0} مؤهل دراسي · {extracted.projects?.length ?? 0} مشروع
                    </p>
                  ) : null}
                </div>
                {parseWarning && (
                  <p className="mt-3 rounded-lg bg-accent/10 p-3 text-xs leading-6 text-accent-foreground" role="alert" data-testid="warning-cv-parse">{parseWarning}</p>
                )}
                <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t('review')} {t('decision')}</p></CardContent></Card>
        </div>
        <Card className="h-fit"><CardHeader><CardTitle className="text-base">حالة الملف</CardTitle></CardHeader><CardContent><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-sm font-bold">تم التحليل</p><p className="text-xs text-muted-foreground">آخر تحديث: اليوم</p></div></div><div className="mt-6 space-y-3 text-xs"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />المعلومات الأساسية</div><div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />الخبرة والمهارات</div><div className="flex items-center gap-2 text-muted-foreground"><span className="h-4 w-4 rounded-full border border-border" />مراجعة واعتماد</div></div></CardContent></Card>
      </div>
    </DashboardLayout>
  );
}

// ─── Password reset ──────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setState('saving');
    try {
      await resetPassword(token, password);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور. اطلب رابطاً جديداً.');
      setState('idle');
    }
  };

  if (!token) {
    return (
      <AuthFrame title="رابط غير صالح" subtitle="رابط إعادة التعيين ناقص أو منتهي." side="أمان حسابك يبدأ من روابط لا تتسرّب.">
        <p className="text-sm text-muted-foreground" data-testid="error-reset-no-token">
          افتح الرابط الذي وصلك بالبريد، أو اطلب رابطاً جديداً من صفحة تسجيل الدخول.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/login')} data-testid="button-reset-to-login">العودة لتسجيل الدخول</Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="تعيين كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية لم تستخدمها من قبل." side="كلمة مرور جديدة، حساب أكثر أماناً.">
      {state === 'done' ? (
        <div role="status" data-testid="status-reset-success">
          <p className="text-sm font-semibold text-primary">تم تحديث كلمة المرور.</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')} data-testid="button-reset-to-login">تسجيل الدخول</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <FieldWithError label="كلمة المرور الجديدة" value={password} onChange={setPassword} type="password" placeholder="8 أحرف على الأقل" autoComplete="new-password" error={undefined} testId="input-reset-password" />
          <FieldWithError label="تأكيد كلمة المرور" value={confirm} onChange={setConfirm} type="password" placeholder="أعد كتابتها" autoComplete="new-password" error={undefined} testId="input-reset-confirm" />
          {error && <p className="text-xs text-destructive" role="alert" data-testid="error-reset">{error}</p>}
          <Button type="submit" className="w-full" disabled={state === 'saving'} data-testid="button-submit-reset">
            {state === 'saving' ? 'جارٍ الحفظ…' : 'تعيين كلمة المرور'}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}

// ─── Email verification ──────────────────────────────────────────────────

export function VerifyEmailPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [state, setState] = useState<'verifying' | 'done' | 'error'>(token ? 'verifying' : 'error');
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setState('done'))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر تأكيد البريد.');
        setState('error');
      });
  }, [token]);

  const resend = async () => {
    setResendState('sending');
    try {
      await resendVerification(resendEmail);
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  return (
    <AuthFrame title="تأكيد البريد الإلكتروني" subtitle="لحماية حسابك، نتأكد أن البريد يعود لك." side="بريد مؤكد يعني وصولاً آمناً لكل قراراتك.">
      {state === 'verifying' && <p className="text-sm text-muted-foreground" role="status" data-testid="status-verifying">جارٍ التحقق…</p>}
      {state === 'done' && (
        <div role="status" data-testid="status-verify-success">
          <p className="text-sm font-semibold text-primary">تم تأكيد بريدك بنجاح.</p>
          <p className="mt-2 text-xs text-muted-foreground">يمكنك الآن إكمال بيانات الشركة وطلب التحقق.</p>
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert" data-testid="error-verify">{error || 'الرابط ناقص أو منتهي الصلاحية.'}</p>
          <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs text-muted-foreground">أدخل بريدك لإرسال رابط تأكيد جديد.</p>
            <Input type="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} placeholder="name@example.com" data-testid="input-resend-email" />
            <Button type="button" onClick={resend} disabled={resendState === 'sending' || !resendEmail.includes('@')} data-testid="button-submit-resend">
              {resendState === 'sending' ? 'جارٍ الإرسال…' : 'إرسال رابط جديد'}
            </Button>
            {resendState === 'sent' && <p className="text-xs font-semibold text-primary" role="status" data-testid="status-resend-sent">إذا كان البريد بانتظر التأكيد فسيصلك رابط جديد.</p>}
          </div>
        </div>
      )}
    </AuthFrame>
  );
}