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
import type { AdminCompany, VerificationStatus } from '@/services/api/demo-api';
import { FeedbackState, LoadingState, PageHeader, ScoreRing } from '@/components/app-kit';
import { RoleShell } from '@/components/role-shell';
import { WorkflowGuide } from '@/components/workflow-guide';
import { formatDate } from '@/lib/format';
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
  const { data, loading, error, reload } = useDemo(() => demoApi.listCompaniesForReview(), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  const statusOf = (c: AdminCompany): VerificationStatus => c.verificationStatus ?? (c.verified ? 'verified' : 'draft');

  const filtered = data.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || (c.industry || '').includes(search);
    const matchFilter = filter === 'all' || statusOf(c) === filter;
    return matchSearch && matchFilter;
  });

  const approve = async (id: string) => {
    setBusyId(id);
    setActionError('');
    try {
      await demoApi.approveCompany(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر اعتماد الشركة');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    if (reason.trim().length < 5) {
      setActionError('سبب الرفض مطلوب (5 أحرف على الأقل)');
      return;
    }
    setBusyId(id);
    setActionError('');
    try {
      await demoApi.rejectCompany(id, reason.trim());
      setRejectingId(null);
      setReason('');
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر رفض الطلب');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = data.filter((c) => statusOf(c) === 'pending').length;
  const verifiedCount = data.filter((c) => statusOf(c) === 'verified').length;

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

      {actionError && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive" role="alert" data-testid="error-admin-company-action">{actionError}</p>}

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {([
          ['إجمالي الشركات', data.length, 'text-foreground'],
          ['موثقة', verifiedCount, 'text-primary'],
          ['قيد المراجعة', pendingCount, 'text-accent-foreground'],
          ['مرفوضة', data.filter((c) => statusOf(c) === 'rejected').length, 'text-destructive'],
        ] as const).map(([label, value, color]) => (
          <Card key={label}>
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
          {([['all', 'الكل'], ['pending', 'قيد المراجعة'], ['verified', 'موثقة'], ['rejected', 'مرفوضة']] as const).map(([val, label]) => (
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
          const status = statusOf(company);
          const isPending = status === 'pending';
          return (
            <Card key={company.id} data-testid={`card-company-${company.id}`}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{company.name}</p>
                    <AdminBadge verified={status === 'verified'} />
                    {status === 'pending' && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">بانتظار القرار</span>}
                    {status === 'rejected' && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">مرفوضة</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{company.industry} · {company.location}{company.website ? ` · ${company.website}` : ''}</p>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{company.description}</p>
                  {company.contact && (
                    <p className="mt-2 text-[11px] text-muted-foreground" data-testid={`company-contact-${company.id}`}>
                      مسؤول الحساب: {company.contact.name} — {company.contact.email}
                    </p>
                  )}
                  {company.verificationNote && (
                    <p className="mt-2 rounded-lg bg-destructive/5 p-2 text-[11px] text-destructive">سبب الرفض: {company.verificationNote}</p>
                  )}

                  {isPending && (
                    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4" data-testid={`reject-panel-${company.id}`}>
                      {rejectingId === company.id ? (
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold" htmlFor={`reason-${company.id}`}>سبب الرفض</label>
                          <textarea
                            id={`reason-${company.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="اشرح ما الذي يحتاج إلى تصحيح…"
                            className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                            data-testid={`input-reject-reason-${company.id}`}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setReason(''); }} data-testid={`button-cancel-reject-${company.id}`}>إلغاء</Button>
                            <Button size="sm" variant="destructive" onClick={() => reject(company.id)} disabled={busyId === company.id} data-testid={`button-confirm-reject-${company.id}`}>
                              تأكيد الرفض
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approve(company.id)} disabled={busyId === company.id} data-testid={`button-verify-company-${company.id}`}>
                            <CheckCircle2 className="h-4 w-4" />
                            {busyId === company.id ? 'جارٍ…' : 'اعتماد'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectingId(company.id); setReason(''); setActionError(''); }} data-testid={`button-reject-company-${company.id}`}>
                            <Ban className="h-4 w-4" />
                            رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
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
  // Every seeker account from GET /admin/candidates — this page previously
  // rendered three hardcoded rows and invented totals (1,248 / 1,043 / 384).
  const { data, loading, error, reload } = useDemo(demoApi.adminCandidates, []);

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  const rows = data.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    headline: c.headline || '—',
    completion: c.completion,
    cvStatus: c.cvStatus === 'analyzed' ? 'محللة' : 'بانتظار الرفع',
    status: (c.isActive ? 'active' : 'suspended') as 'active' | 'suspended',
    applications: c.applications,
  }));

  const filtered = rows.filter((c) => {
    const matchSearch = !search || c.name.includes(search) || c.headline.includes(search);
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });
  const analyzedCount = data.filter((c) => c.cvStatus === 'analyzed').length;
  const activeCount = data.filter((c) => c.isActive).length;

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
          ['إجمالي الباحثين', data.length.toLocaleString(), Building2],
          ['ملفات محللة', analyzedCount.toLocaleString(), FileText],
          ['حسابات نشطة', activeCount.toLocaleString(), Users],
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
  // GET /admin/applications (platform-wide, joined with candidate names).
  // The old version called the seeker-scoped /applications/my — an admin
  // token got a 403, so the page only ever worked in demo mode.
  const { data, loading, error, reload } = useDemo(demoApi.adminApplications, []);
  const [tab, setTab] = useState<'all' | 'reports'>('all');

  if (loading) return <RoleShell role="admin"><LoadingState /></RoleShell>;
  if (error || !data) return <RoleShell role="admin"><FeedbackState error={error} retry={reload} /></RoleShell>;

  // Counts derived from the loaded rows — the old cards were hardcoded.
  const reviewingCount = data.filter((item) => item.status === 'reviewing').length;
  const shortlistedCount = data.filter((item) => item.status === 'shortlisted').length;
  const interviewCount = data.filter((item) => item.status === 'interview').length;

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
          ['إجمالي الطلبات', data.length],
          ['قيد المراجعة', reviewingCount],
          ['القائمة المختصرة', shortlistedCount],
          ['مقابلات', interviewCount],
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
            <p className="font-semibold">لا توجد بلاغات مفتوحة</p>
            <p className="mt-2 text-sm">إذا أُضيف نظام البلاغات مستقبلاً، ستظهر هنا للمراجعة اليدوية.</p>
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
                    <td className="px-5 py-4 text-muted-foreground">{item.candidateName}</td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-primary">{item.matchScore != null ? `${item.matchScore}%` : '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(item.appliedAt)}</td>
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
