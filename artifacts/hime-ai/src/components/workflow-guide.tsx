import { Check, ChevronLeft, FileCheck2, FileText, Flag, ListChecks, Search, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

type WorkflowRole = 'seeker' | 'company' | 'admin';

type WorkflowStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const workflows: Record<WorkflowRole, WorkflowStep[]> = {
  seeker: [
    { key: 'profile', title: 'أكمل ملفك', description: 'أضف قصتك ومهاراتك', href: '/seeker/profile', icon: FileText },
    { key: 'cv', title: 'راجع السيرة', description: 'تحقق من المعلومات المستخرجة', href: '/seeker/cv', icon: FileCheck2 },
    { key: 'recommendations', title: 'اكتشف التوصيات', description: 'افهم سبب كل تطابق', href: '/seeker/recommendations', icon: Sparkles },
    { key: 'apply', title: 'قدّم على فرصة', description: 'اتخذ قرارك بوضوح', href: '/jobs', icon: Flag },
    { key: 'applications', title: 'تابع طلباتك', description: 'اعرف أين وصلت', href: '/seeker/applications', icon: ListChecks },
  ],
  company: [
    { key: 'profile', title: 'عرّف شركتك', description: 'ابنِ حضوراً موثوقاً', href: '/company/profile', icon: FileText },
    { key: 'job', title: 'انشر وظيفة', description: 'اكتب دوراً واضحاً', href: '/company/jobs/new', icon: Flag },
    { key: 'candidates', title: 'راجع المرشحين', description: 'قارن الأدلة والتطابق', href: '/company/jobs/j-1/candidates', icon: Users },
    { key: 'review', title: 'ابدأ الحوار', description: 'افتح ملف المرشح', href: '/company/jobs/j-1/candidates/u-8', icon: Search },
    { key: 'manage', title: 'تابع الأداء', description: 'حسّن قرار التوظيف', href: '/company/dashboard', icon: ListChecks },
  ],
  admin: [
    { key: 'dashboard', title: 'راقب المنصة', description: 'ابدأ من المؤشرات العامة', href: '/admin/dashboard', icon: ListChecks },
    { key: 'companies', title: 'تحقق من الشركات', description: 'راجع الطلبات الجديدة', href: '/admin/companies', icon: ShieldCheck },
    { key: 'jobs', title: 'راجع الوظائف', description: 'تحقق من جودة المحتوى', href: '/admin/jobs', icon: FileText },
    { key: 'applications', title: 'تابع الطلبات', description: 'راجع الحالات والبلاغات', href: '/admin/applications', icon: Users },
    { key: 'profile', title: 'أدر صلاحياتك', description: 'راجع الأمان والإشعارات', href: '/admin/profile', icon: ShieldCheck },
  ],
};

export function WorkflowGuide({ role, current }: { role: WorkflowRole; current?: string }) {
  const steps = workflows[role];
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-4 md:p-5" aria-label="مسار العمل" data-testid={`workflow-guide-${role}`}>
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">مسار العمل</p><h2 className="mt-1 text-base font-bold">{role === 'seeker' ? 'من الملف إلى فرصة مفهومة' : role === 'company' ? 'من تعريف الشركة إلى قرار التوظيف' : 'من صحة المنصة إلى الحوكمة'}</h2></div>
        <p className="text-xs text-muted-foreground">كل خطوة تقودك إلى الخطوة التالية</p>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = current === step.key;
          return <Link key={step.key} href={step.href} className={cn('group relative flex min-h-24 flex-col justify-between rounded-xl border p-3 transition-colors', active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/50')} data-testid={`workflow-step-${role}-${step.key}`}>
            <div className="flex items-center justify-between"><span className={cn('grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{active ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} /></div>
            <div className="mt-3"><p className="text-xs font-bold">{step.title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{step.description}</p></div>
            {index < steps.length - 1 && <ChevronLeft className="absolute -start-3 top-9 hidden h-4 w-4 bg-card text-muted-foreground md:block" />}
          </Link>;
        })}
      </div>
    </section>
  );
}