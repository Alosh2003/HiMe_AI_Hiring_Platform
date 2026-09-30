import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowDownLeft, CheckCircle2, CircleAlert, Mail, MapPin, MessageCircle, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeedbackState, LoadingState, PageHeader, ScoreBreakdown } from '@/components/app-kit';
import { RoleShell } from '@/components/role-shell';
import { WorkflowGuide } from '@/components/workflow-guide';
import { demoApi } from '@/services/api/ApiClient';
import { useDemo } from '@/hooks/use-demo';

export function CandidateReviewPage() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const { data, loading, error, reload } = useDemo(() => demoApi.candidates(jobId || 'j-1'), [jobId]);
  const [decision, setDecision] = useState('');
  const candidate = data?.find((item) => item.id === candidateId) || data?.[0];

  if (loading) return <RoleShell role="company"><LoadingState /></RoleShell>;
  if (error || !candidate) return <RoleShell role="company"><FeedbackState error={error || 'المرشح غير موجود'} retry={reload} /></RoleShell>;

  const match = {
    id: candidate.id,
    jobId: jobId || 'j-1',
    score: candidate.score,
    breakdown: candidate.breakdown,
    matchedSkills: candidate.matchedSkills,
    missingSkills: candidate.missingSkills,
    relevantExperience: [],
    relevantProjects: [],
    explanation: 'يتقاطع ملف المرشح مع متطلبات الدور في المهارات والخبرة.',
  };

  return <RoleShell role="company">
    <PageHeader eyebrow="مراجعة المرشح" title={`ملف ${candidate.name}`} description="استخدم هذه الصفحة لبدء حوار منظم، لا لاتخاذ قرار آلي نهائي." action={<Link href={`/company/jobs/${jobId || 'j-1'}/candidates`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"><ArrowDownLeft className="h-4 w-4" />العودة للمرشحين</Link>} />
    <WorkflowGuide role="company" current="review" />
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card><CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center"><div className="grid h-20 w-20 place-items-center rounded-2xl bg-secondary text-2xl font-bold text-primary">{candidate.name.slice(0, 2)}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{candidate.name}</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">مرشح مقترح</span></div><p className="mt-2 text-sm text-muted-foreground">{candidate.headline}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><MapPin className="me-1 inline h-3.5 w-3.5 text-primary" />الرياض، السعودية</span><span><Mail className="me-1 inline h-3.5 w-3.5 text-primary" />sara@example.com</span><span><Phone className="me-1 inline h-3.5 w-3.5 text-primary" />متاح للتواصل</span></div></div><div className="text-center"><p className="text-3xl font-bold text-primary">{candidate.score}%</p><p className="mt-1 text-[11px] text-muted-foreground">التطابق العام</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">تفصيل سبب التطابق</CardTitle></CardHeader><CardContent><ScoreBreakdown match={match} /><p className="mt-6 rounded-xl bg-accent/10 p-4 text-xs leading-6 text-muted-foreground"><CircleAlert className="me-2 inline h-4 w-4 text-accent" />هذه النتيجة تساعد فريقك على بدء المراجعة، ولا تستبدل المقابلة أو الحكم البشري.</p></CardContent></Card>
        <div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">المهارات المطابقة</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{candidate.matchedSkills.map((skill) => <span key={skill.id} className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">{skill.name}</span>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">فجوات تستحق الحوار</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{candidate.missingSkills.map((skill) => <span key={skill.id} className="rounded-lg bg-muted px-3 py-2 text-xs">{skill.name}</span>)}</div></CardContent></Card></div>
        <Card><CardHeader><CardTitle className="text-base">الخطوة التالية</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><Button onClick={() => setDecision('تمت الإضافة إلى القائمة المختصرة')} data-testid="button-shortlist-candidate"><CheckCircle2 className="h-4 w-4" />إضافة للقائمة المختصرة</Button><Button variant="outline" onClick={() => setDecision('يمكنك بدء محادثة مع المرشح')} data-testid="button-message-candidate"><MessageCircle className="h-4 w-4" />بدء محادثة</Button><Button variant="outline" onClick={() => setDecision('تم حفظ المرشح للمراجعة لاحقاً')} data-testid="button-save-candidate"><ShieldCheck className="h-4 w-4" />حفظ للمراجعة</Button></div>{decision && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-center text-xs font-semibold text-primary" role="status" data-testid="status-candidate-decision">{decision}</p>}</CardContent></Card>
      </div>
      <div className="space-y-6"><Card className="bg-secondary/50"><CardHeader><CardTitle className="text-base">الدور المرتبط</CardTitle></CardHeader><CardContent><p className="font-bold">{candidate.job.title}</p><p className="mt-2 text-xs text-muted-foreground">{candidate.job.company.name} · {candidate.job.location}</p><Link href={`/company/jobs/${jobId || 'j-1'}`} className="mt-5 block rounded-lg border border-border bg-background px-3 py-2.5 text-center text-xs font-bold">فتح تفاصيل الوظيفة</Link></CardContent></Card><Card><CardHeader><CardTitle className="text-base">ملخص الملف</CardTitle></CardHeader><CardContent className="space-y-4 text-xs"><div className="flex items-center gap-3"><UserRound className="h-4 w-4 text-primary" /><span>ملف مكتمل بنسبة 89%</span></div><div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-primary" /><span>السيرة الذاتية محللة</span></div><div className="flex items-center gap-3"><MessageCircle className="h-4 w-4 text-primary" /><span>آخر نشاط منذ يومين</span></div></CardContent></Card></div>
    </div>
  </RoleShell>;
}