import { useState } from 'react';
import { Link } from 'wouter';
import {
  Building2, BriefcaseBusiness, Check, CheckCircle2, FileText,
  Search, ShieldCheck, Users, X, AlertCircle, Eye, Ban, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDemo } from '@/hooks/use-demo';
import * as demoApi from '@/services/api/demo-api';
import { FeedbackState, LoadingState, PageHeader, ScoreRing } from '@/components/app-kit';
import { RoleShell } from '@/components/role-shell';
import { WorkflowGuide } from '@/components/workflow-guide';
import type { ApplicationStatus } from '@/types';

const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'تم التقديم',
  reviewing: 'قيد المراجعة',
  shortlisted: 'القائمة المختصرة',
  interview: 'مقابلة',
  rejected: 'غير مناسب حالياً',
  accepted: 'تم القبول',
};

function AdminBadge({ verified }: { verified: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
      verified ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'
    }`}>
      {verified ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {verified ? 'موثقة' : 'قيد المراجعة'}
    </span>
  );
}

export function AdminCompaniesPage() {
  const { data, loading, error, reload } = useDemo(demoApi.listCompanies, []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  const filtered = data.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || c.industry.includes(search);
    const isVerified = c.verified || verifiedIds.includes(c.id);
    const matchFilter = filter === 'all' || (filter === 'verified' && isVerified) || (filter === 'pending' && !isVerified);
    return matchSearch && matchFilter;
  });

  const verify = (id: string) => setVerifiedIds((prev) => [...prev, id]);

  const pendingCount = data.filter((c) => !c.verified && !verifiedIds.includes(c.id)).length;

  return (
    <RoleShell role="admin">
      <PageHeader
        eyebrow="إدارة المنصة"
        title="الشركات"
        description="راجع طلبات التحقق وتابع جودة الشركات المشاركة في المنصة."
        action={
          pendingCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2.5 text-sm font-bold text-accent-foreground">
              <AlertCircle className="h-4 w-4" />
              {pendingCount} شركة بانتظار التحقق
            </span>
          ) : undefined
        }
      />
      <WorkflowGuide role="admin" current="companies" />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ['إجمالي الشركات', data.length, 'text-foreground'],
          ['موثقة', data.filter((c) => c.verified || verifiedIds.includes(c.id)).length + verifiedIds.length > data.filter(c => c.verified).length ? data.filter((c) => c.verified).length + verifiedIds.length : data.filter((c) => c.verified).length, 'text-primary'],
          ['قيد المراجعة', pendingCount, 'text-accent-foreground'],
        ].map(([label, value, color]) => (
          <Card key={label as string}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الشركة أو المجال…"
            className="ps-10"
            data-testid="input-admin-company-search"
          />
        </div>
        <div className="flex gap-2">
          {([['all', 'الكل'], ['verified', 'موثقة'], ['pending', 'قيد المراجعة']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                filter === val ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
              }`}
              data-testid={`button-admin-company-filter-${val}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Company Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            لا توجد شركات تطابق البحث
          </div>
        ) : filtered.map((company) => {
          const isVerified = company.verified || verifiedIds.includes(company.id);
          return (
            <Card key={company.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{company.name}</p>
                    <AdminBadge verified={isVerified} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{company.industry} · {company.location} · {company.website}</p>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{company.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isVerified && (
                    <Button
                      size="sm"
                      onClick={() => verify(company.id)}
                      data-testid={`button-verify-company-${company.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      تحقق
                    </Button>
                  )}
                  <Button variant="outline" size="sm" data-testid={`button-suspend-company-${company.id}`}>
                    <Ban className="h-4 w-4" />
                    تعليق
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </RoleShell>
  );
}

export function AdminCandidatesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const candidates = [
    { id: 'u-1', name: 'ليان العتيبي', email: 'layan@example.com', headline: 'مصمم منتجات', completion: 82, cvStatus: 'محللة', applications: 2, status: 'active' as const },
    { id: 'u-8', name: 'سارة الحربي', email: 'sara@example.com', headline: 'Product Designer', completion: 89, cvStatus: 'محللة', applications: 4, status: 'active' as const },
    { id: 'u-9', name: 'عمر الغامدي', email: 'omar@example.com', headline: 'UX Researcher', completion: 73, cvStatus: 'محللة', applications: 1, status: 'active' as const },
  ];

  const filtered = candidates.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || c.headline.includes(search);
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <RoleShell role="admin">
      <PageHeader
        eyebrow="إدارة المنصة"
        title="الباحثون عن عمل"
        description="تابع نشاط الباحثين وجودة ملفاتهم وحالة التحقق."
      />
      <WorkflowGuide role="admin" current="dashboard" />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {([
          ['إجمالي الباحثين', '1,248', Building2],
          ['ملفات محللة', '1,043', FileText],
          ['نشطون هذا الأسبوع', '384', Users],
        ] as [string, string, React.ComponentType<{ className?: string }>][]).map(([label, value, Icon]) => (
          <Card key={label as string}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                {Icon && (() => { const I = Icon as React.ComponentType<{ className?: string }>; return <I className="h-5 w-5" />; })()}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{String(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الباحث أو التخصص…"
            className="ps-10"
            data-testid="input-admin-candidate-search"
          />
        </div>
        <div className="flex gap-2">
          {([['all', 'الكل'], ['active', 'نشط'], ['suspended', 'موقوف']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                filter === val ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
              }`}
              data-testid={`button-admin-candidate-filter-${val}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                {['الباحث', 'التخصص', 'اكتمال الملف', 'السيرة', 'التقديمات', 'الإجراءات'].map((h) => (
                  <th key={h} className="px-5 py-4 text-start text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((candidate) => (
                <tr key={candidate.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {candidate.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{candidate.headline}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${candidate.completion}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{candidate.completion}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">{candidate.cvStatus}</span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm font-bold">{candidate.applications}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="عرض" data-testid={`button-admin-view-candidate-${candidate.id}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="تعليق" data-testid={`button-admin-suspend-candidate-${candidate.id}`}>
                        <Ban className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </RoleShell>
  );
}

export function AdminJobsPage() {
  const { data, loading, error, reload } = useDemo(() => demoApi.listJobs(), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  const filtered = data.filter((j) => {
    const matchSearch = !search || j.title.includes(search) || j.company.name.includes(search);
    const matchFilter = filter === 'all' || j.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <RoleShell role="admin">
      <PageHeader
        eyebrow="إدارة المنصة"
        title="الوظائف"
        description="راجع جودة الوظائف المنشورة وتابع حالتها على المنصة."
      />
      <WorkflowGuide role="admin" current="jobs" />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['إجمالي الوظائف', data.length],
          ['نشطة', data.filter((j) => j.status === 'active').length],
          ['متوقفة', data.filter((j) => j.status === 'paused').length],
          ['إجمالي المتقدمين', data.reduce((sum, j) => sum + j.applicants, 0)],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-bold text-primary">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بعنوان الوظيفة أو الشركة…"
            className="ps-10"
            data-testid="input-admin-job-search"
          />
        </div>
        <div className="flex gap-2">
          {([['all', 'الكل'], ['active', 'نشطة'], ['paused', 'متوقفة']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                filter === val ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
              }`}
              data-testid={`button-admin-job-filter-${val}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                {['الوظيفة', 'الشركة', 'المجال', 'المتقدمون', 'آخر موعد', 'الحالة', 'إجراءات'].map((h) => (
                  <th key={h} className="px-5 py-4 text-start text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4 font-semibold">{job.title}</td>
                  <td className="px-5 py-4 text-muted-foreground">{job.company.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{job.industry}</td>
                  <td className="px-5 py-4 text-center font-bold">{job.applicants}</td>
                  <td className="px-5 py-4 text-muted-foreground">{job.deadline}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      job.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {job.status === 'active' ? 'نشطة' : 'متوقفة'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="عرض" data-testid={`button-admin-view-job-${job.id}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10" aria-label="حذف" data-testid={`button-admin-delete-job-${job.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </RoleShell>
  );
}

export function AdminApplicationsPage() {
  const { data, loading, error, reload } = useDemo(demoApi.applications, []);
  const [tab, setTab] = useState<'all' | 'reports'>('all');

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  return (
    <RoleShell role="admin">
      <PageHeader
        eyebrow="إدارة المنصة"
        title="طلبات التقديم"
        description="تابع حالة طلبات التقديم وتعامل مع البلاغات."
        action={
          <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm font-bold">
            <FileText className="h-4 w-4 text-primary" />
            {data.length} طلب مسجل
          </span>
        }
      />
      <WorkflowGuide role="admin" current="applications" />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['إجمالي الطلبات', 3820],
          ['قيد المراجعة', 1240],
          ['القائمة المختصرة', 384],
          ['بلاغات مفتوحة', 2],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-bold text-primary">{(value as number).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {([['all', 'كل الطلبات'], ['reports', 'البلاغات']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
              tab === val ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
            }`}
            data-testid={`button-admin-applications-tab-${val}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'reports' ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertCircle className="mx-auto mb-3 h-8 w-8" />
            <p className="font-semibold">2 بلاغ مفتوح</p>
            <p className="mt-2 text-sm">بلاغات تحتاج مراجعة يدوية من فريق الإدارة.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  {['الوظيفة', 'الباحث', 'نتيجة التطابق', 'تاريخ التقديم', 'الحالة', 'إجراءات'].map((h) => (
                    <th key={h} className="px-5 py-4 text-start text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4 font-semibold">
                      <Link href={`/jobs/${item.job.id}`} className="hover:text-primary">{item.job.title}</Link>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">ليان العتيبي</td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-primary">{item.matchScore}%</span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{item.appliedAt}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent-foreground">
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="عرض" data-testid={`button-admin-view-application-${item.id}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </RoleShell>
  );
}
