import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowUpLeft, Check, CheckCircle2, CircleAlert, FileText, Sparkles, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PublicNav } from '@/components/app-kit';
import { ScoreRing } from '@/components/app-kit';
import { useLanguage } from '@/i18n';
import { assessCv as assessCvApi, ApiError, type CvAssessment } from '@/services/api/demo-api';

type Assessment = CvAssessment;

const ASSESS_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
const ASSESS_MAX_BYTES = 10 * 1024 * 1024;

function validateAssessFile(file: File): string {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!ASSESS_EXTENSIONS.includes(ext)) return 'صيغة الملف غير مدعومة. ارفع PDF أو DOCX أو TXT.';
  if (file.size > ASSESS_MAX_BYTES) return 'حجم الملف أكبر من 10MB.';
  return '';
}

const STORAGE_KEY = 'hime_cv_assessment';

function saveAssessment(assessment: Assessment) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...assessment, savedAt: new Date().toISOString() }));
  } catch {
    /* storage unavailable — the session-only view still works */
  }
}

/** Reads a left-over assessment so the dashboard can show it after sign-in. */
export function readSavedAssessment(): Assessment | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Assessment) : null;
  } catch {
    return null;
  }
}

const SCORE_TONE = (score: number) =>
  score >= 80 ? 'text-primary' : score >= 60 ? 'text-accent-foreground' : 'text-destructive';

function ToneBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className={`font-bold ${SCORE_TONE(value)}`}>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-6">
          {tone === 'good'
            ? <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
            : <X className="mt-1 h-4 w-4 shrink-0 text-destructive" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Public CV assessment — deliberately behind no sign-in wall.
 *
 * This is the acquisition funnel: a visitor gets real value from the AI first,
 * then a CTA to sign in for job matches and unlimited re-assessments.
 */
export function AssessPage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [role, setRole] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!role.trim() || !file) return;

    const fileError = validateAssessFile(file);
    if (fileError) {
      setRateLimited(false);
      setError(fileError);
      return;
    }

    setSubmitting(true);
    setRateLimited(false);
    setError('');

    try {
      const assessment = await assessCvApi(file, role.trim());
      saveAssessment(assessment);
      setResult(assessment);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // The free anonymous quota is spent. Say so in Arabic, say when it
        // resets, and offer the account path that removes the limit.
        setRateLimited(true);
        const minutes = typeof err.retryAfter === 'number' ? Math.max(1, Math.ceil(err.retryAfter / 60)) : null;
        setError(
          `وصلت إلى الحد المجاني للتقييم${minutes ? ` — يمكنك المحاولة مجدداً بعد ${minutes} دقيقة` : ''}. أنشئ حساباً مجانياً للحصول على تقييمات بلا حدود.`,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Assessment failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setRole('');
    setError('');
    setRateLimited(false);
  };

  return (
    <div className="grain">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        {!result ? (
          <form onSubmit={submit}>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                تقييم مجاني بدون تسجيل
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                قيّم سيرتك الذاتية مقابل أي وظيفة
              </h1>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                ارفع سيرتك واذكر الوظيفة المستهدفة، وسيخبرك الذكاء الاصطناعي بمدى
                ملاءمتك — وما الذي يمكنك تحسينه.
              </p>
            </div>

            <Card className="mx-auto max-w-2xl">
              <CardContent className="space-y-6 p-6 md:p-8">
                <div>
                  <p className="mb-2 block text-sm font-semibold">الوظيفة المستهدفة</p>
                  <Input
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="مثال: Senior Backend Engineer, مدير منتجات…"
                    maxLength={300}
                    aria-label="الوظيفة المستهدفة"
                    data-testid="input-assess-role"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    اكتب المسمى الوظيفي أو الصق نص الإعلان الوظيفي.
                  </p>
                </div>

                <div>
                  <label
                    onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOver(false);
                      const dropped = event.dataTransfer.files?.[0];
                      if (dropped) setFile(dropped);
                    }}
                    className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                      dragOver ? 'border-primary bg-primary/5'
                        : file ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="sr-only"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      data-testid="input-assess-file"
                      aria-label="رفع السيرة الذاتية"
                    />
                    {file ? (
                      <>
                        <FileText className="h-8 w-8 text-primary" />
                        <p className="mt-3 text-sm font-bold" data-testid="text-assess-file-name">{file.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — اضغط للتغيير</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-semibold">اسحب سيرتك هنا أو اخترها</p>
                        <p className="mt-1 text-xs text-muted-foreground">PDF أو DOCX أو TXT · حتى 10MB</p>
                      </>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="space-y-3 rounded-lg bg-destructive/10 p-4" role="alert" data-testid="error-assess">
                    <p className="text-xs leading-6 text-destructive">{error}</p>
                    {rateLimited && (
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => navigate('/register')}
                        data-testid="link-assess-limit-to-register"
                      >
                        إنشاء حساب مجاني <ArrowUpLeft className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!role.trim() || !file || submitting}
                  data-testid="button-submit-assess"
                >
                  {submitting ? 'جارٍ التقييم…' : 'قيّم سيرتك الآن'}
                  {!submitting && <ArrowUpLeft className="h-4 w-4" />}
                </Button>

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  بإرسالك، أنت توافق على معالجة السيرة لهذا التقييم فقط. لا يتم تخزينها
                  بدون حساب.
                </p>
              </CardContent>
            </Card>
          </form>
        ) : (
          <div className="space-y-8" data-testid="status-assess-result">
            {/* Header + score */}
            <Card className="mx-auto max-w-2xl overflow-hidden">
              <div className="bg-sidebar p-6 text-center text-sidebar-foreground md:p-10">
                <p className="text-xs uppercase tracking-[.2em] text-[#f2c66d]">نتيجة التقييم</p>
                <h2 className="mt-2 text-xl font-bold md:text-2xl">{result.role}</h2>
                <div className="mt-8 flex justify-center">
                  <ScoreRing score={result.overallScore} size="lg" />
                </div>
                <p className="mt-5 text-sm text-sidebar-foreground/70">
                  {result.overallScore >= 80
                    ? 'ملاءمة قوية. ركّز على التحسينات الصغيرة أدناه.'
                    : result.overallScore >= 60
                      ? 'ملاءمة جيدة مع فرص واضحة للتحسين.'
                      : 'هناك فجوات واضحة — التوصيات أدناه هي أولويتك.'}
                </p>
                <Button
                  variant="outline"
                  className="mt-6 border-white/20 bg-transparent text-sidebar-foreground hover:bg-white/10"
                  onClick={reset}
                  data-testid="button-assess-again"
                >
                  تقييم سيرة أخرى
                </Button>
              </div>
            </Card>

            {/* Breakdown */}
            <Card className="mx-auto max-w-2xl">
              <CardHeader><CardTitle className="text-base">التفصيل</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <ToneBar label="المهارات" value={result.breakdown.skills.score} />
                <ToneBar label="الخبرة" value={result.breakdown.experience.score} />
                <ToneBar label="التعليم" value={result.breakdown.education.score} />
                <ToneBar label="العرض والصياغة" value={result.breakdown.presentation.score} />

                {result.breakdown.skills.matched.length > 0 && (
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-bold text-primary">المهارات المتوفرة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.breakdown.skills.matched.map((skill) => (
                        <span key={skill} className="rounded-md bg-background px-2 py-1 text-[11px] font-semibold text-primary">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.breakdown.skills.missing.length > 0 && (
                  <div className="rounded-xl bg-accent/5 p-4">
                    <p className="mb-2 text-xs font-bold text-accent-foreground">المهارات الناقصة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.breakdown.skills.missing.map((skill) => (
                        <span key={skill} className="rounded-md bg-background px-2 py-1 text-[11px] text-accent-foreground">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strengths / gaps */}
            <div className="mx-auto grid max-w-2xl gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" />نقاط القوة</CardTitle></CardHeader>
                <CardContent><BulletList items={result.strengths} tone="good" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleAlert className="h-4 w-4 text-destructive" />الفجوات</CardTitle></CardHeader>
                <CardContent><BulletList items={result.gaps} tone="bad" /></CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <Card className="mx-auto max-w-2xl border-primary/20">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />تحسينات مقترحة</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-6">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="mx-auto max-w-2xl overflow-hidden bg-sidebar text-sidebar-foreground">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <p className="text-lg font-bold">هل تريد رؤية الوظائف التي تطابق ملفك؟</p>
                <p className="max-w-md text-sm leading-6 text-sidebar-foreground/70">
                  سجّل مجاناً لاستكشاف الوظائف المطابقة، وتحسين توصيات التقييم
                  باستمرار، واستقبال الطلبات — كل ذلك في مكان واحد.
                </p>
                <Button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto"
                  data-testid="link-assess-to-register"
                >
                  إنشاء حساب مجاني <ArrowUpLeft className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
