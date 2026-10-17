import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  ArrowUpLeft, ArrowDownLeft, BriefcaseBusiness, Building2, Check,
  CheckCircle2, ChevronDown, CircleAlert, Clock3, FileText,
  HeartHandshake, MapPin, Plus, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, Trash2, Users, X, type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import * as demoApi from '@/services/api/demo-api';
import { useLanguage } from '@/i18n';
import { useDemo } from '@/hooks/use-demo';
import { RoleShell } from '@/components/role-shell';
import { formatDate } from '@/lib/format';
import {
  EmptySearch, FeedbackState, Field, JobCard, LoadingState,
  PageHeader, PublicNav, ScoreBreakdown, ScoreRing
} from '@/components/app-kit';
import { WorkflowGuide } from '@/components/workflow-guide';
import type { ApplicationStatus, MatchResult } from '@/types';

// ─── Public Footer ────────────────────────────────────────────────────────────
function PublicFooter() {
  const { t } = useLanguage();
  return (
    <footer className="bg-sidebar px-4 py-12 text-sidebar-foreground md:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <span className="text-lg font-bold">HiMe <span className="text-[#f2c66d]">AI</span></span>
          <p className="mt-4 max-w-xs text-sm leading-7 text-sidebar-foreground/60">مساحة أكثر وضوحاً للقرارات المهنية المهمة.</p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f2c66d]">المنصة</p>
          <div className="space-y-3 text-sm text-sidebar-foreground/70">
            <Link href="/jobs" className="block hover:text-white" data-testid="link-footer-jobs">{t('navJobs')}</Link>
            <Link href="/about" className="block hover:text-white" data-testid="link-footer-about">{t('navAbout')}</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f2c66d]">للباحثين</p>
          <div className="space-y-3 text-sm text-sidebar-foreground/70">
            <Link href="/register" className="block hover:text-white" data-testid="link-footer-seeker">{t('seeker')}</Link>
            <Link href="/register?role=seeker" className="block hover:text-white" data-testid="link-footer-cv">{t('cv')}</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#f2c66d]">للشركات</p>
          <div className="space-y-3 text-sm text-sidebar-foreground/70">
            <Link href="/register?role=company" className="block hover:text-white" data-testid="link-footer-company">{t('company')}</Link>
            <Link href="/register?role=company" className="block hover:text-white" data-testid="link-footer-post">أضف وظيفة</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-7xl border-t border-sidebar-border pt-5 text-xs text-sidebar-foreground/50">
        © 2025 HiMe AI · قرارك المهني يستحق معلومات أفضل
      </div>
    </footer>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export function HomePage() {
  const { t } = useLanguage();
  return (
    <div className="grain">
      <PublicNav />
      <main>
        {/* Hero */}
        <section className="surface-grid relative overflow-hidden">
          <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-[1.1fr_.9fr] md:px-8 md:py-28">
            <div className="animate-rise">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                <span className="h-2 w-2 rounded-full bg-accent" />{t('homeEyebrow')}
              </p>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.25] tracking-tight text-balance md:text-6xl">{t('homeTitle')}</h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">{t('homeBody')}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 hover:opacity-90" data-testid="link-hero-seeker">
                  {t('seeker')} <ArrowUpLeft className="h-4 w-4" />
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-card px-5 py-3.5 text-sm font-bold text-primary hover:bg-primary/5" data-testid="link-hero-company">
                  {t('company')} <ArrowUpLeft className="h-4 w-4" />
                </Link>
              </div>
              <Link
                href="/assess"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2.5 text-xs font-bold text-accent-foreground hover:bg-accent/20"
                data-testid="link-hero-assess"
              >
                <Sparkles className="h-4 w-4" />
                قيّم سيرتك الآن — بدون تسجيل
              </Link>
              <div className="mt-9 flex items-center gap-6 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />بياناتك ملكك</span>
                <span className="inline-flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-primary" />قرارات أكثر إنصافاً</span>
              </div>
            </div>
            <div className="relative animate-rise delay-2">
              <div className="absolute -inset-10 rounded-full bg-accent/10 blur-3xl" />
              <Card className="relative overflow-hidden border-primary/20 bg-card/90 p-2 shadow-2xl shadow-primary/10">
                <div className="rounded-xl bg-sidebar p-6 text-sidebar-foreground md:p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-sidebar-foreground/60">نتيجة المطابقة</p>
                      <p className="mt-1 text-lg font-bold">مصمم تجربة مستخدم أول</p>
                    </div>
                    <span className="rounded-full bg-[#f2c66d]/15 px-3 py-1.5 text-xs font-bold text-[#f2c66d]">مقترحة لك</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <ScoreRing score={92} size="lg" />
                    <div className="flex-1 space-y-4">
                      {[['المهارات', 94], ['الخبرة', 90], ['السياق العام', 95]].map(([label, score]) => (
                        <div key={label as string}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-sidebar-foreground/70">{label}</span>
                            <span className="font-bold text-[#f2c66d]">{score}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[#f2c66d]" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs leading-6 text-sidebar-foreground/70">«خبرتك في البحث وتصميم الأنظمة تتوافق بقوة مع احتياج الفريق.»</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 py-24 md:px-8">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">{t('how')}</p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">من سيرتك الذاتية إلى خطوة مفهومة.</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[['01', 'ابنِ ملفاً يعكسك', 'أضف خبرتك، مهاراتك، وتفضيلاتك. لا تحتاج إلى أن تكون خبيراً في كتابة السير الذاتية.'], ['02', 'دع الذكاء يرتّب الصورة', 'نحلل التقاطع بين ملفك واحتياجات الدور، ونشرح لك عناصر القوة والفجوات.'], ['03', 'اتخذ قرارك بثقة', 'استكشف الفرص، تقدّم، وتابع مسارك من مساحة واحدة دون ضجيج.']].map(([num, title, body]) => (
              <div key={num} className="rounded-2xl border border-border bg-card p-6">
                <span className="font-mono text-sm text-accent">{num}</span>
                <h3 className="mt-12 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="bg-secondary/50 px-4 py-24 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">{t('features')}</p>
                <h2 className="max-w-xl text-3xl font-bold tracking-tight md:text-4xl">تقنية تعمل بهدوء، في اللحظة التي تحتاجها.</h2>
              </div>
              <Link href="/about" className="text-sm font-bold text-primary" data-testid="link-home-about">{t('navAbout')} <ArrowUpLeft className="inline h-4 w-4" /></Link>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-12">
              <Card className="md:col-span-7 bg-sidebar text-sidebar-foreground">
                <CardContent className="p-7 md:p-9">
                  <Sparkles className="h-7 w-7 text-[#f2c66d]" />
                  <h3 className="mt-12 text-2xl font-bold">مطابقة تشرح نفسها</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-sidebar-foreground/70">لا نرمي رقماً مجرداً. ترى كيف تجمّعت النتيجة، ما الذي يطابقك، وما الذي يستحق التطوير.</p>
                </CardContent>
              </Card>
              <Card className="md:col-span-5">
                <CardContent className="p-7 md:p-9">
                  <Target className="h-7 w-7 text-primary" />
                  <h3 className="mt-12 text-xl font-bold">وجهة واحدة لمسارك</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">من أول رفع السيرة إلى متابعة طلباتك، كل خطوة في مكان واضح.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-7xl px-4 py-24 md:px-8">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">لست رقماً</p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">وظيفة مناسبة تبدأ بفهم أفضل.</h2>
              <p className="mt-5 leading-8 text-muted-foreground">نصمم HiMe AI للناس خلف الملفات الشخصية.</p>
              <Link href="/jobs" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-primary" data-testid="link-home-jobs">{t('navJobs')} <ArrowUpLeft className="h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-primary p-6 text-primary-foreground">
                <p className="text-4xl font-bold">92%</p>
                <p className="mt-2 text-xs opacity-75">مثال على تطابق قابل للفهم</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-4xl font-bold text-accent">6</p>
                <p className="mt-2 text-xs text-muted-foreground">أبعاد نستخدمها في الشرح</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-accent/15 p-6">
                <p className="text-sm font-bold">دعم قرار، لا قرار نهائي</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">الذكاء الاصطناعي يساعدك على رؤية الصورة، وأنت صاحب القرار.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

// ─── Jobs Page ────────────────────────────────────────────────────────────────
export function JobsPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [contract, setContract] = useState('');
  const { data, loading, error, reload } = useDemo(
    () => demoApi.listJobs({ search, industry, contract }),
    [search, industry, contract],
  );
  const jobs = data || [];
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <PageHeader
          eyebrow="سوق الفرص"
          title="ابحث عن الدور الذي يليق بخطوتك."
          description="فرص منتقاة مع سياق واضح، لا قوائم لا تنتهي."
        />
        <div className="mb-8 grid gap-3 rounded-2xl border border-border bg-card p-3 md:grid-cols-[1fr_180px_160px_auto]">
          <label className="relative">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="h-10 ps-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} data-testid="input-job-search" />
          </label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-industry">
            <option value="">كل الصناعات</option>
            <option>تقنية المعلومات</option>
            <option>التقنية المالية</option>
            <option>الاستشارات</option>
          </select>
          <select value={contract} onChange={(e) => setContract(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="select-contract">
            <option value="">كل العقود</option>
            <option value="full-time">دوام كامل</option>
            <option value="contract">عقد مستقل</option>
          </select>
          <Button variant="secondary" onClick={() => { setSearch(''); setIndustry(''); setContract(''); }} data-testid="button-reset-filters">
            <SlidersHorizontal className="h-4 w-4" />إعادة ضبط
          </Button>
        </div>
        {loading ? <LoadingState /> : error ? <FeedbackState error={error} retry={reload} /> : jobs.length === 0 ? (
          <EmptySearch onClear={() => { setSearch(''); setIndustry(''); setContract(''); }} />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{jobs.length} فرص متاحة</span>
              <button className="inline-flex items-center gap-1" data-testid="button-sort-jobs">الأحدث <ChevronDown className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
          </>
        )}
      </main>
    </>
  );
}

// ─── About Page ───────────────────────────────────────────────────────────────
export function AboutPage() {
  return (
    <>
      <PublicNav />
      <main>
        <section className="bg-sidebar px-4 py-24 text-sidebar-foreground md:px-8 md:py-32">
          <div className="mx-auto max-w-5xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[.22em] text-[#f2c66d]">قصة HiMe AI</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">نؤمن أن أفضل قرار مهني يبدأ من رؤية الإنسان كاملاً.</h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-sidebar-foreground/65">التوظيف لا يحتاج مزيداً من الضجيج. يحتاج لغة مشتركة بين الطموح والاحتياج.</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-20 md:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              ['01', 'primary', 'وضوح قبل السرعة', 'نفضل نتيجة مفهومة على قائمة طويلة لا تساعدك على الاختيار.'],
              ['02', 'accent', 'الذكاء مع الإنسان', 'المطابقة دعم لاتخاذ القرار، وليست بديلاً عن الحكم البشري أو الحوار.'],
              ['03', 'primary', 'سياق عربي أصيل', 'نبني لغة وتجربة تحترم تفاصيل العمل في منطقتنا، من المصطلح إلى التوقع.']
            ].map(([num, color, title, body]) => (
              <div key={num} className="rounded-2xl border border-border bg-card p-6">
                <p className={`text-4xl font-bold text-${color}`}>{num}</p>
                <h2 className="mt-5 font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

// ─── Recommendations Page ─────────────────────────────────────────────────────
const fallbackJobTitles: Record<string, string> = { 'j-1': 'مصمم تجربة مستخدم أول', 'j-2': 'مدير منتج — منصات الذكاء الاصطناعي', 'j-3': 'مهندس واجهات أمامية' };

function RecommendationCard({ match }: { match: MatchResult }) {
  const jobId = match.jobId;
  const [matchedOpen, setMatchedOpen] = useState(true);
  const [gapsOpen, setGapsOpen] = useState(true);
  const [coach, setCoach] = useState<demoApi.MatchCoach | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [adding, setAdding] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  const runCoach = async () => {
    if (coachBusy) return;
    if (coach) { setCoach(null); return; }
    setCoachBusy(true);
    setCoachError('');
    try {
      setCoach(await demoApi.matchCoach(jobId));
    } catch (err) {
      // Honest failure — the score and chips above stay usable regardless.
      setCoachError(
        err instanceof demoApi.ApiError && err.detail
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'تعذر الوصول إلى مساعد التطوير الذكي الآن — حاول مرة أخرى لاحقاً.',
      );
    } finally {
      setCoachBusy(false);
    }
  };

  const addSkill = async (skill: string) => {
    setAdding(skill);
    setCoachError('');
    try {
      await demoApi.addProfileSkill(skill);
      setAdded((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'تعذر إضافة المهارة إلى ملفك — أضفها يدوياً من صفحة الملف.');
    } finally {
      setAdding('');
    }
  };

  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-[180px_1fr_1fr] md:items-center">
        <div className="flex items-center gap-4 md:block">
          <ScoreRing score={match.score} />
          <div className="md:mt-3">
            <p className="font-bold">{match.jobTitle || fallbackJobTitles[jobId] || 'وظيفة مقترحة'}</p>
            <p className="mt-1 text-xs text-muted-foreground">توصية مبنية على ملفك</p>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">تفصيل التطابق</p>
          <ScoreBreakdown match={match} />
          {match.explanation && (
            <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-xs leading-6 text-muted-foreground" data-testid={`explanation-${match.id}`}>{match.explanation}</p>
          )}
        </div>
        <div>
          {/* Both section headers are real toggles — collapse to scan, expand to review. */}
          <button
            type="button"
            onClick={() => setMatchedOpen((v) => !v)}
            aria-expanded={matchedOpen}
            className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"
            data-testid={`button-toggle-matched-${jobId}`}
          >
            ماذا تطابق؟
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px]">{match.matchedSkills.length}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${matchedOpen ? 'rotate-180' : ''}`} />
          </button>
          {matchedOpen && (
            <div className="flex flex-wrap gap-2" data-testid={`list-matched-${jobId}`}>
              {match.matchedSkills.length === 0 && (
                <span className="text-[11px] text-muted-foreground">لا توجد مهارات مطابقة بعد.</span>
              )}
              {match.matchedSkills.map((skill) => (
                <span key={skill.id} className="rounded-md bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary">{skill.name}</span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setGapsOpen((v) => !v)}
            aria-expanded={gapsOpen}
            className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
            data-testid={`button-toggle-gaps-${jobId}`}
          >
            فجوات تستحق النظر
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{match.missingSkills.length}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${gapsOpen ? 'rotate-180' : ''}`} />
          </button>
          {gapsOpen && (
            <div className="flex flex-wrap gap-2" data-testid={`list-gaps-${jobId}`}>
              {match.missingSkills.length === 0 && (
                <span className="text-[11px] text-muted-foreground">لا فجوات — ملفك يغطي المهارات المطلوبة.</span>
              )}
              {match.missingSkills.map((skill) => (
                <span key={skill.id} className="rounded-md bg-muted px-2.5 py-1.5 text-[11px]">{skill.name}</span>
              ))}
            </div>
          )}

          {/* The AI plan: how to close each gap on the profile/CV. */}
          <Button
            onClick={runCoach}
            disabled={coachBusy}
            data-testid={`button-coach-${jobId}`}
            className="group mt-5 h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-[0_10px_28px_-10px_hsl(var(--primary)/0.65)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-10px_hsl(var(--primary)/0.8)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-70"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/20">
              <Sparkles className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 ${coachBusy ? 'animate-pulse' : ''}`} />
            </span>
            <span>{coachBusy ? 'جارٍ تحضير الخطة…' : coach ? 'إخفاء خطة التحسين' : 'كيف أرتفع مطابقتي؟'}</span>
          </Button>

          {coachError && (
            <p className="mt-3 text-xs text-destructive" role="alert" data-testid={`error-coach-${jobId}`}>{coachError}</p>
          )}

          {coach && (
            <div className="mt-4 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid={`panel-coach-${jobId}`}>
              <p className="text-xs font-semibold leading-6">{coach.summary}</p>

              {coach.gaps.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">أغِل الفجوات في ملفك وسيرتك</p>
                  <ul className="space-y-3">
                    {coach.gaps.map((gap, index) => (
                      <li key={gap.skill} className="rounded-lg bg-background/80 p-3" data-testid={`coach-gap-${jobId}-${index}`}>
                        <p className="text-xs font-bold">{gap.skill}</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{gap.advice}</p>
                        <p className="mt-1.5 text-[11px] leading-5 text-foreground/80">
                          <span className="font-bold text-primary">نصيحة للسيرة الذاتية:</span> {gap.cvTip}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => addSkill(gap.skill)}
                            disabled={added.includes(gap.skill) || adding === gap.skill}
                            className="text-[11px] font-bold text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
                            data-testid={`button-add-skill-${jobId}-${index}`}
                          >
                            {added.includes(gap.skill) ? '✓ أضيفت إلى ملفك' : adding === gap.skill ? 'جارٍ الإضافة…' : 'أضفها إلى ملفي'}
                          </button>
                          <Link
                            href="/seeker/cv"
                            className="text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                            data-testid={`link-update-cv-${jobId}-${index}`}
                          >
                            حدّث سيرتك الذاتية
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {coach.showcase.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">برز مهاراتك المطابقة</p>
                  <ul className="space-y-2">
                    {coach.showcase.map((item) => (
                      <li key={item.skill} className="rounded-lg bg-background/80 p-3 text-[11px] leading-5">
                        <span className="font-bold text-primary">{item.skill}:</span> {item.cvTip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] leading-5 text-muted-foreground">
                الإضافة إلى الملف بضغطة واحدة؛ أما السيرة الذاتية فتبقى تحت مراجعتك قبل أي إرسال.
              </p>
            </div>
          )}

          <Link href={`/jobs/${jobId}`} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary" data-testid={`link-recommendation-${match.id}`}>
            عرض الوظيفة <ArrowUpLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecommendationsPage() {
  const { data: matches, loading, error, reload } = useDemo(demoApi.recommendations, []);
  if (loading) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  if (error || !matches) return <RoleShell role="seeker"><FeedbackState error={error} retry={reload} /></RoleShell>;
  return (
    <RoleShell role="seeker">
      <PageHeader eyebrow="الذكاء في خدمتك" title="توصيات لها سبب." description="كل نتيجة هنا قابلة للفهم والمراجعة — وليست حكماً نهائياً على ملاءمتك." />
      <WorkflowGuide role="seeker" current="recommendations" />
      <div className="space-y-5">
        {matches.map((match) => (
          <RecommendationCard key={match.id} match={match} />
        ))}
      </div>
      <p className="mt-6 rounded-xl bg-accent/10 p-4 text-xs leading-6 text-muted-foreground">
        <CircleAlert className="me-2 inline h-4 w-4 text-accent" />النتائج دعم لاتخاذ القرار وليست قرار توظيف نهائي.
      </p>
    </RoleShell>
  );
}

// ─── Applications Page ────────────────────────────────────────────────────────
const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'تم التقديم',
  reviewing: 'قيد المراجعة',
  shortlisted: 'القائمة المختصرة',
  interview: 'مقابلة',
  rejected: 'غير مناسب حالياً',
  accepted: 'تم القبول',
};

const statusColors: Record<ApplicationStatus, string> = {
  applied: 'bg-muted text-muted-foreground',
  reviewing: 'bg-accent/15 text-accent-foreground',
  shortlisted: 'bg-primary/10 text-primary',
  interview: 'bg-[#f2c66d]/20 text-[#7a5f00]',
  rejected: 'bg-destructive/10 text-destructive',
  accepted: 'bg-primary text-primary-foreground',
};

export function ApplicationsPage() {
  const { data, loading, error, reload } = useDemo(demoApi.applications, []);
  if (loading) return <RoleShell role="seeker"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="seeker"><FeedbackState error={error} retry={reload} /></RoleShell>;
  return (
    <RoleShell role="seeker">
      <PageHeader
        eyebrow="رحلتك"
        title="طلبات التقديم"
        description="مكان واحد لتعرف أين وصلت كل فرصة."
      />
      <WorkflowGuide role="seeker" current="applications" />
      {data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">لم تقدّم على أي وظيفة بعد</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm font-bold text-primary">استكشف الوظائف <ArrowUpLeft className="inline h-4 w-4" /></Link>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden grid-cols-[1.6fr_1fr_.8fr_.7fr] gap-4 border-b border-border px-6 py-4 text-xs font-bold text-muted-foreground md:grid">
              <span>الوظيفة</span><span>الشركة</span><span>تاريخ التقديم</span><span>الحالة</span>
            </div>
            {data.map((item) => (
              <div key={item.id} className="grid gap-3 border-b border-border px-5 py-5 last:border-0 md:grid-cols-[1.6fr_1fr_.8fr_.7fr] md:items-center md:px-6">
                <div>
                  <Link href={`/jobs/${item.job.id}`} className="text-sm font-bold hover:text-primary" data-testid={`link-application-job-${item.id}`}>{item.job.title}</Link>
                  <p className="mt-1 text-xs text-muted-foreground md:hidden">{item.job.company.name} · {formatDate(item.appliedAt)}</p>
                </div>
                <p className="hidden text-xs text-muted-foreground md:block">{item.job.company.name}</p>
                <p className="hidden text-xs text-muted-foreground md:block">{formatDate(item.appliedAt)}</p>
                <div className="flex items-center gap-2">
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColors[item.status]}`} data-testid={`status-application-${item.id}`}>
                    {statusLabels[item.status]}
                  </span>
                  <span className="text-xs font-bold text-primary">{item.matchScore != null ? `${item.matchScore}%` : '—'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </RoleShell>
  );
}

// ─── Company Jobs Page ────────────────────────────────────────────────────────
export function CompanyJobsPage() {
  const { data, loading, error, reload } = useDemo(demoApi.getCompanyJobs, []);
  // Real funnel stats; "متوسط التطابق 88%" used to be a hardcoded string.
  const { data: rawFunnel } = useDemo(demoApi.companyFunnel, []);
  const funnel = typeof rawFunnel === 'function' ? null : rawFunnel;
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  if (loading) return <RoleShell role="company"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="company"><FeedbackState error={error} retry={reload} /></RoleShell>;
  const filtered = filter === 'all' ? data : data.filter((j) => j.status === filter);
  return (
    <RoleShell role="company">
      <PageHeader
        eyebrow="إدارة الفرص"
        title="وظائفك في مكان واحد."
        description="تابع أداء كل فرصة وافتح قائمة المرشحين الأقرب."
        action={
          <Link href="/company/jobs/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-jobs-add">
            <Plus className="h-4 w-4" />إضافة وظيفة
          </Link>
        }
      />
      <WorkflowGuide role="company" current="manage" />

      {/* Quick stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {([
          ['الوظائف النشطة', data.filter(j => j.status === 'active').length, BriefcaseBusiness],
          ['إجمالي المتقدمين', funnel?.totals.total ?? data.reduce((s, j) => s + j.applicants, 0), Users],
          ['متوسط التطابق', funnel?.totals.avgMatch != null ? `${funnel.totals.avgMatch}%` : '—', Target]
        ] as const).map(([label, value, Icon]) => (
          <Card key={label as string}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        {([['all', 'الكل'], ['active', 'نشطة'], ['paused', 'متوقفة']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              filter === val ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
            }`}
            data-testid={`button-jobs-filter-${val}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <BriefcaseBusiness className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">لا توجد وظائف في هذه الفئة</p>
          <Link href="/company/jobs/new" className="mt-4 inline-block text-sm font-bold text-primary">إضافة وظيفة جديدة</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <Card key={job.id} className="group">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <Link href={`/company/jobs/${job.id}`} className="font-bold hover:text-primary" data-testid={`link-company-job-${job.id}`}>{job.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job.applicants} متقدم</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{job.postedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    job.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {job.status === 'active' ? 'نشطة' : 'متوقفة'}
                  </span>
                  <Link href={`/company/jobs/${job.id}/candidates`} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted" data-testid={`link-job-candidates-${job.id}`}>
                    المرشحون
                  </Link>
                  <Link href={`/company/jobs/${job.id}`} className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold" data-testid={`link-manage-job-${job.id}`}>
                    إدارة
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </RoleShell>
  );
}

// ─── New Job Page (Multi-Step Form) ───────────────────────────────────────────
/** Today (or today+N) as the yyyy-mm-dd an <input type="date"> speaks. */
const isoDate = (daysFromNow = 0) =>
  new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

export function NewJobPage() {
  const [, setLocation] = useLocation();
  // Posting requires a verified company. The gate below explains that before
  // the form is ever shown; the API enforces the same rule server-side.
  const { data: company, loading: companyLoading } = useDemo(demoApi.company, []);
  const companyBlocked = !companyLoading && (!company || company.verificationStatus !== 'verified');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
    industry: 'تقنية المعلومات',
    location: 'الرياض، السعودية',
    contract: 'full-time' as 'full-time' | 'part-time' | 'contract' | 'internship',
    experience: 'mid' as 'entry' | 'mid' | 'senior' | 'lead',
    // Two weeks out by default — a past date can never be the pre-filled value.
    deadline: isoDate(14),
    salary: '',
    skills: [] as string[],
    newSkill: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // AI draft: paste an ad (or name a role) and the wizard fills for review.
  const [aiAd, setAiAd] = useState('');
  const [aiPosition, setAiPosition] = useState('');
  const [aiYears, setAiYears] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDone, setAiDone] = useState(false);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const runAiDraft = async () => {
    setAiBusy(true);
    setAiError('');
    setAiDone(false);
    try {
      const years = Number(aiYears);
      const draft = await demoApi.parseJobAd({
        adText: aiAd.trim() || undefined,
        position: aiPosition.trim() || undefined,
        experienceYears: aiYears.trim() !== '' && Number.isFinite(years) ? years : undefined,
      });
      setForm((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        description: draft.description || prev.description,
        industry: draft.industry || prev.industry,
        location: draft.location || prev.location,
        contract: draft.contractType || prev.contract,
        experience: draft.experienceLevel || prev.experience,
        salary: draft.salaryMin != null ? String(draft.salaryMin) : prev.salary,
        skills: draft.requiredSkills.length ? draft.requiredSkills : prev.skills,
      }));
      setStep(1);
      setAiDone(true);
    } catch (err) {
      // Honest failure — the company always sees why the draft did not arrive.
      setAiError(
        err instanceof demoApi.ApiError && err.detail
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'تعذر الوصول إلى الذكاء الاصطناعي الآن — أكمل الحقول يدوياً.',
      );
    } finally {
      setAiBusy(false);
    }
  };

  const addSkill = () => {
    if (!form.newSkill.trim()) return;
    update('skills', [...form.skills, form.newSkill.trim()]);
    update('newSkill', '');
  };

  const removeSkill = (skill: string) => update('skills', form.skills.filter((s) => s !== skill));

  const handleSubmit = async () => {
    setSubmitError('');
    try {
      await demoApi.createJob({
        title: form.title,
        description: form.description,
        industry: form.industry,
        location: form.location,
        contract: form.contract,
        experience: form.experience,
        deadline: form.deadline,
        salary: form.salary,
        requiredSkills: form.skills.map((name, i) => ({ id: `s-${i}`, name, category: 'professional' })),
        preferredSkills: [],
      });
      setSubmitted(true);
      setTimeout(() => setLocation('/company/jobs'), 1500);
    } catch (err) {
      // The API refuses unverified companies with 403; surface that instead
      // of hanging on the submitting state.
      if (err instanceof demoApi.ApiError && err.status === 403) {
        setSubmitError('نشر الوظائف يتطلب توثيق الشركة أولاً. أكمل ملف الشركة واطلب التحقق.');
      } else if (err instanceof demoApi.ApiError && err.status === 400) {
        // The server rejects with a raw "Invalid input" — say what to check.
        setSubmitError('بيانات الوظيفة غير صالحة — تأكد من العنوان والوصف، وأن الراتب أرقام فقط، والموعد النهائي ليس في الماضي.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'تعذر نشر الوظيفة. حاول مرة أخرى.');
      }
    }
  };

  const steps = ['المعلومات الأساسية', 'التفاصيل والمهارات', 'الراتب والنشر'];

  if (companyLoading) {
    return <RoleShell role="company"><LoadingState /></RoleShell>;
  }

  if (companyBlocked) {
    return (
      <RoleShell role="company">
        <PageHeader
          eyebrow="فرصة جديدة"
          title="اكتب الدور الذي تريد أن ينضم إليه."
          description="الوصف الواضح يجذب الأشخاص المناسبين ويجعل المطابقة أدق."
        />
        <div className="mx-auto max-w-xl" data-testid="card-job-post-blocked">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent-foreground">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <p className="text-lg font-bold">نشر الوظائف يتطلب توثيق الشركة</p>
              <p className="text-sm leading-7 text-muted-foreground">
                {company?.verificationStatus === 'pending'
                  ? 'طلب التحقق الخاص بك قيد المراجعة لدى إدارة المنصة. ستتمكن من نشر الوظائف فور اعتمادك.'
                  : 'أكمل بيانات الشركة ثم أرسل طلب التحقق. ستتمكن من نشر الوظائف فور اعتمادك من إدارة المنصة.'}
              </p>
              <Link
                href="/company/profile"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
                data-testid="link-job-blocked-to-profile"
              >
                إكمال ملف الشركة <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role="company">
      <PageHeader
        eyebrow="فرصة جديدة"
        title="اكتب الدور الذي تريد أن ينضم إليه."
        description="الوصف الواضح يجذب الأشخاص المناسبين ويجعل المطابقة أدق."
      />
      <WorkflowGuide role="company" current="job" />

      {/* Step Indicator */}
      {/* AI draft: paste a ready-made ad or just name the role — the wizard
          fills for review. Nothing is published until the company says so. */}
      {!submitted && (
        <Card className="mb-6" data-testid="card-ai-draft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> مسودة سريعة بالذكاء الاصطناعي
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              ألصق إعلان وظيفة جاهز أو حدّد المسمى وسنوات الخبرة فقط — يستخرج النظام المهارات والوصف والراتب واملأ الخطوات الثلاث لتراجعها قبل النشر.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={aiAd}
              onChange={(e) => setAiAd(e.target.value)}
              rows={5}
              placeholder="ألصق نص إعلان الوظيفة هنا…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6"
              data-testid="textarea-job-ad"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">أو اكتب المسمى الوظيفي
                <Input
                  value={aiPosition}
                  onChange={(e) => setAiPosition(e.target.value)}
                  placeholder="مثال: محلل بيانات"
                  className="mt-2"
                  data-testid="input-ai-position"
                />
              </label>
              <label className="text-sm font-semibold">سنوات الخبرة المطلوبة (اختياري)
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={aiYears}
                  onChange={(e) => setAiYears(e.target.value)}
                  placeholder="مثال: 3"
                  className="mt-2"
                  data-testid="input-ai-years"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={runAiDraft}
                disabled={aiBusy || (!aiAd.trim() && !aiPosition.trim())}
                data-testid="button-ai-draft"
              >
                <Sparkles className="h-4 w-4" /> {aiBusy ? 'جارٍ الاستخراج…' : 'املأ المسودة'}
              </Button>
              {aiDone && (
                <p className="text-sm font-semibold text-primary" data-testid="status-ai-draft">
                  تم ملء الخطوات الثلاث — راجعها ثم انشر.
                </p>
              )}
              {aiError && (
                <p className="text-sm text-destructive" role="alert" data-testid="error-ai-draft">{aiError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-8 flex items-center gap-2">
        {steps.map((label, index) => {
          const num = index + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={num} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/10 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="h-4 w-4" /> : num}
              </div>
              <span className={`hidden text-xs font-semibold sm:block ${
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
              }`}>{label}</span>
              {index < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
            </div>
          );
        })}
      </div>

      {submitted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold">تم نشر الوظيفة بنجاح!</h2>
            <p className="text-sm text-muted-foreground">جارٍ الانتقال إلى صفحة الوظائف…</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Step 1 */}
          {step === 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">المعلومات الأساسية</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="المسمى الوظيفي" value={form.title} onChange={(v) => update('title', v)} placeholder="مثال: مدير منتج أول" />
                </div>
                <label className="text-sm font-semibold">المجال
                  <select value={form.industry} onChange={(e) => update('industry', e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-job-industry">
                    <option>تقنية المعلومات</option>
                    <option>التقنية المالية</option>
                    <option>التسويق</option>
                    <option>الاستشارات</option>
                  </select>
                </label>
                <Field label="الموقع" value={form.location} onChange={(v) => update('location', v)} placeholder="المدينة أو عن بعد" />
                <label className="text-sm font-semibold">نوع العقد
                  <select value={form.contract} onChange={(e) => update('contract', e.target.value as typeof form.contract)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-job-contract">
                    <option value="full-time">دوام كامل</option>
                    <option value="part-time">دوام جزئي</option>
                    <option value="contract">عقد مستقل</option>
                    <option value="internship">تدريب</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">مستوى الخبرة
                  <select value={form.experience} onChange={(e) => update('experience', e.target.value as typeof form.experience)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-job-experience">
                    <option value="entry">مبتدئ</option>
                    <option value="mid">متوسط</option>
                    <option value="senior">خبير</option>
                    <option value="lead">قيادي</option>
                  </select>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <Card>
              <CardHeader><CardTitle className="text-base">التفاصيل والمهارات</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <Field label="وصف الوظيفة" value={form.description} onChange={(v) => update('description', v)} placeholder="ما الذي سيقوم به الشخص؟ وما الذي سيجعل هذه الفرصة مميزة؟" multiline />
                <div>
                  <p className="mb-3 text-sm font-semibold">المهارات المطلوبة</p>
                  <div className="flex flex-wrap gap-2">
                    {form.skills.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                        {skill}
                        <button onClick={() => removeSkill(skill)} aria-label={`إزالة ${skill}`} data-testid={`button-remove-skill-${skill}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex max-w-md gap-2">
                    <Input
                      value={form.newSkill}
                      onChange={(e) => update('newSkill', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      placeholder="أضف مهارة واضغط Enter"
                      data-testid="input-new-skill"
                    />
                    <Button type="button" variant="outline" onClick={addSkill} data-testid="button-add-skill">
                      <Plus className="h-4 w-4" />إضافة
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">الراتب والموعد</CardTitle></CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2">
                  <Field label="نطاق الراتب" value={form.salary} onChange={(v) => update('salary', v)} placeholder="مثال: 18,000 – 24,000 ر.س" />
                  <div>
                    <label className="block text-sm font-semibold">آخر موعد للتقديم
                      <input type="date" value={form.deadline} min={isoDate(0)} onChange={(e) => update('deadline', e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="input-job-deadline" />
                    </label>
                  </div>
                </CardContent>
              </Card>
              {/* Preview */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader><CardTitle className="text-base text-primary">معاينة الوظيفة</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-lg font-bold">{form.title || 'عنوان الوظيفة'}</p>
                  <p className="text-muted-foreground">{form.industry} · {form.location}</p>
                  <p className="text-muted-foreground">{form.salary || 'الراتب يحدد عند المقابلة'}</p>
                  {form.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {form.skills.map((s) => <span key={s} className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{s}</span>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} data-testid="button-prev-step">
                  الخطوة السابقة
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Link href="/company/jobs" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold" data-testid="link-cancel-job">إلغاء</Link>
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !form.title} data-testid="button-next-step">
                  الخطوة التالية
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!form.title || !form.description} data-testid="button-publish-job">
                  <CheckCircle2 className="h-4 w-4" />نشر الوظيفة
                </Button>
              )}
              {submitError && (
                <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert" data-testid="error-publish-job">
                  {submitError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleShell>
  );
}

// ─── Company Job Detail Page ───────────────────────────────────────────────────
export function CompanyJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, loading, error, reload } = useDemo(() => demoApi.getJob(id || ''), [id]);
  const { data: candidates } = useDemo(() => demoApi.candidates(id || 'j-1'), [id]);
  const [, setLocation] = useLocation();
  const [deleted, setDeleted] = useState(false);
  const [paused, setPaused] = useState(false);

  if (loading || !job) return <RoleShell role="company"><LoadingState /></RoleShell>;
  if (error) return <RoleShell role="company"><FeedbackState error={error} retry={reload} /></RoleShell>;

  return (
    <RoleShell role="company">
      <PageHeader
        eyebrow="إدارة الوظيفة"
        title={job.title}
        description={`${job.location} · ${job.applicants} متقدم · ${job.postedAt}`}
        action={
          <div className="flex gap-2">
            <Link href={`/company/jobs/${job.id}/candidates`} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="link-detail-candidates">
              <Users className="me-1 inline h-4 w-4" />عرض المرشحين
            </Link>
            <Button variant="outline" onClick={() => setPaused(!paused)} data-testid="button-toggle-job">
              {paused ? 'تفعيل' : 'إيقاف'}
            </Button>
            <Button variant="outline" onClick={async () => { await demoApi.deleteJob(job.id); setDeleted(true); setLocation('/company/jobs'); }} data-testid="button-delete-job">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <WorkflowGuide role="company" current="manage" />

      {deleted ? <FeedbackState /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {/* Funnel Stats */}
            <div className="grid gap-3 sm:grid-cols-4">
              {[['جديد', 42], ['مراجعة', 28], ['مختصر', 11], ['مقابلة', 5]].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="prose prose-sm max-w-none p-6">
                <h2>عن الدور</h2>
                <p>{job.description}</p>
                <h2>المهارات المطلوبة</h2>
                <div className="not-prose flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill) => (
                    <span key={skill.id} className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{skill.name}</span>
                  ))}
                </div>
                <h2>المهارات المفضلة</h2>
                <div className="not-prose flex flex-wrap gap-2">
                  {job.preferredSkills.map((skill) => (
                    <span key={skill.id} className="rounded-md bg-muted px-3 py-1.5 text-xs">{skill.name}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Candidates Preview */}
            {candidates && candidates.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">أفضل المرشحين</CardTitle>
                  <Link href={`/company/jobs/${job.id}/candidates`} className="text-xs font-bold text-primary">عرض الكل</Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {candidates.slice(0, 3).map((candidate) => (
                    <Link key={candidate.id} href={`/company/jobs/${job.id}/candidates/${candidate.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted" data-testid={`link-top-candidate-${candidate.id}`}>
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-bold text-primary">{candidate.name.slice(0, 2)}</div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.headline}</p>
                      </div>
                      <span className="text-lg font-bold text-primary">{candidate.score}%</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">حالة النشر</p>
                <div className={`mt-2 flex items-center gap-2 text-sm font-bold ${paused ? 'text-muted-foreground' : 'text-primary'}`}>
                  <span className={`h-2 w-2 rounded-full ${paused ? 'bg-muted-foreground' : 'bg-primary'}`} />
                  {paused ? 'متوقفة' : 'نشطة'}
                </div>
                <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">التقديمات</span><span className="font-bold">{job.applicants}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">آخر موعد</span><span>{job.deadline}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الراتب</span><span>{job.salary || 'يحدد لاحقاً'}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </RoleShell>
  );
}

// ─── Candidates Page ──────────────────────────────────────────────────────────
export function CandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useDemo(() => demoApi.candidates(id || 'j-1'), [id]);
  const { data: job } = useDemo(() => demoApi.getJob(id || 'j-1'), [id]);
  const [sort, setSort] = useState<'score' | 'name'>('score');
  const [statusFilter, setStatusFilter] = useState('all');

  const candidates = useMemo(() => {
    let list = [...(data || [])];
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    return list.sort((a, b) => sort === 'score' ? b.score - a.score : a.name.localeCompare(b.name));
  }, [data, sort, statusFilter]);

  if (loading) return <RoleShell role="company"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="company"><FeedbackState error={error} retry={reload} /></RoleShell>;

  return (
    <RoleShell role="company">
      <PageHeader
        eyebrow="ذكاء التوظيف"
        title={job ? `مرشحو: ${job.title}` : 'المرشحون الأقرب للدور.'}
        description="ترتيب يساعدك على بدء الحوار — لا يستبدل المقابلة أو التقييم البشري."
        action={
          <div className="flex gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value as 'score' | 'name')} className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold" data-testid="select-candidate-sort">
              <option value="score">الأعلى تطابقاً</option>
              <option value="name">الاسم</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold" data-testid="select-candidate-status">
              <option value="all">كل الحالات</option>
              <option value="shortlisted">مختصر</option>
              <option value="reviewing">قيد المراجعة</option>
              <option value="interview">مقابلة</option>
            </select>
          </div>
        }
      />
      <WorkflowGuide role="company" current="candidates" />

      {/* Summary row — only meaningful once there is at least one candidate */}
      {data.length > 0 && (
        <div className="mb-5 flex gap-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <span className="text-muted-foreground">{data.length} مرشح</span>
          <span className="text-primary font-semibold">أعلى تطابق: {Math.max(...data.map(c => c.score))}%</span>
          <span className="text-muted-foreground">متوسط: {Math.round(data.reduce((s, c) => s + c.score, 0) / data.length)}%</span>
        </div>
      )}

      <div className="space-y-4">
        {candidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardContent className="grid gap-6 p-5 md:grid-cols-[1.15fr_1fr_1fr] md:items-center">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary font-bold text-primary">
                  {candidate.name.slice(0, 2)}
                </div>
                <div>
                  <Link href={`/company/jobs/${id}/candidates/${candidate.id}`} className="font-bold hover:text-primary" data-testid={`link-candidate-${candidate.id}`}>
                    {candidate.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">{candidate.headline}</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${
                    candidate.status === 'shortlisted' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'
                  }`}>
                    {statusLabels[candidate.status as ApplicationStatus]}
                  </span>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">التطابق العام</span>
                  <span className="text-lg font-bold text-primary">{candidate.score}%</span>
                </div>
                <ScoreBreakdown match={{
                  id: candidate.id, jobId: id || '',
                  score: candidate.score, breakdown: candidate.breakdown,
                  matchedSkills: candidate.matchedSkills, missingSkills: candidate.missingSkills,
                  relevantExperience: [], relevantProjects: [], explanation: '',
                }} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-primary">المهارات المطابقة</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.matchedSkills.map((skill: import('@/types').Skill) => (
                    <span key={skill.id} className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">{skill.name}</span>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-xs font-bold text-muted-foreground">فجوات</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.missingSkills.map((skill: import('@/types').Skill) => (
                    <span key={skill.id} className="rounded bg-muted px-2 py-1 text-[10px]">{skill.name}</span>
                  ))}
                </div>
                <Link href={`/company/jobs/${id}/candidates/${candidate.id}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary" data-testid={`link-review-candidate-${candidate.id}`}>
                  مراجعة الملف <ArrowUpLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 rounded-xl bg-accent/10 p-4 text-xs leading-6 text-muted-foreground">
        <CircleAlert className="me-2 inline h-4 w-4 text-accent" />
        نتائج HiMe AI دعم لاتخاذ القرار وليست قرار توظيف نهائي.
      </p>
    </RoleShell>
  );
}