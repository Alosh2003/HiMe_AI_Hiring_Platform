import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Bell, BriefcaseBusiness, Building2, FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { LanguageSwitch, Logo } from '@/components/app-kit';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export type PortalRole = 'seeker' | 'company' | 'admin';

const roleContent = {
  seeker: {
    account: 'حساب الباحث عن عمل',
    name: 'ليان العتيبي',
    greeting: 'مساحتك المهنية',
    links: [
      ['/seeker/dashboard', LayoutDashboard, 'لوحة التحكم'],
      ['/seeker/profile', Users, 'الملف المهني'],
      ['/seeker/cv', FileText, 'السيرة الذاتية'],
      ['/seeker/recommendations', Sparkles, 'التوصيات الذكية'],
      ['/seeker/applications', BriefcaseBusiness, 'طلبات التقديم'],
    ],
  },
  company: {
    account: 'حساب الشركة',
    name: 'مِداد للتقنية',
    greeting: 'مركز التوظيف',
    links: [
      ['/company/dashboard', LayoutDashboard, 'لوحة التحكم'],
      ['/company/profile', Building2, 'ملف الشركة'],
      ['/company/jobs', BriefcaseBusiness, 'الوظائف'],
      ['/company/jobs/new', Plus, 'إضافة وظيفة'],
    ],
  },
  admin: {
    account: 'حساب إدارة المنصة',
    name: 'سلمان القحطاني',
    greeting: 'مركز إدارة HiMe AI',
    links: [
      ['/admin/dashboard', LayoutDashboard, 'نظرة عامة'],
      ['/admin/profile', ShieldCheck, 'ملفي وصلاحياتي'],
      ['/admin/companies', Building2, 'الشركات'],
      ['/admin/candidates', Users, 'الباحثون'],
      ['/admin/jobs', BriefcaseBusiness, 'الوظائف'],
      ['/admin/applications', FileText, 'طلبات التقديم'],
    ],
  },
} as const;

export function RoleShell({ role, children }: { role: PortalRole; children: ReactNode }) {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();
  const { logout } = useAuth();
  const content = roleContent[role];

  // Clear the session before navigating, otherwise the auth guard would
  // bounce the user straight back into the dashboard.
  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={cn(
        'fixed inset-y-0 start-0 z-50 w-72 border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0',
        mobileOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
      )}>
        <div className="flex h-20 items-center justify-between px-6">
          <Logo light />
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" data-testid="button-role-close-sidebar"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pb-6">
          <div className="rounded-2xl border border-white/10 bg-sidebar-accent p-4">
            <div className="mb-3 flex items-center gap-2 text-xs text-sidebar-foreground/60"><span className="h-2 w-2 rounded-full bg-[#f2c66d]" />{content.account}</div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f2c66d] text-sm font-bold text-[#123e43]">{role === 'admin' ? 'سق' : role === 'company' ? 'مت' : 'لع'}</div>
              <div><p className="text-sm font-bold">{content.name}</p><p className="mt-1 text-[11px] text-sidebar-foreground/50">{role === 'admin' ? 'مدير المنصة' : role === 'company' ? 'حساب موثق' : 'باحثة عن فرصة'}</p></div>
            </div>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {content.links.map(([href, Icon, label]) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
              location === href ? 'bg-sidebar-primary font-bold text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )} data-testid={`link-role-${href.replaceAll('/', '-').replace(/^-/, '')}`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-4 bottom-5 space-y-1 border-t border-sidebar-border pt-4">
          <Link href={role === 'admin' ? '/admin/profile' : role === 'company' ? '/company/profile' : '/seeker/profile'} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent" data-testid="link-role-settings"><Settings className="h-4 w-4" />الإعدادات</Link>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent" data-testid="link-role-logout"><LogOut className="h-4 w-4" />{t('logout')}</button>
        </div>
      </aside>
      <div className="md:ps-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة" data-testid="button-open-sidebar"><Menu /></button>
          <div className="hidden md:block"><p className="text-xs text-muted-foreground">{content.greeting}</p><p className="font-semibold">{role === 'admin' ? 'صباح الخير، سلمان' : role === 'company' ? 'صباح الخير، فريق مِداد' : 'صباح الخير، ليان'}</p></div>
          <div className="ms-auto flex items-center gap-3"><LanguageSwitch /><button className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="الإشعارات" data-testid="button-role-notifications"><Bell className="h-5 w-5" /><span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-accent" /></button><div className="hidden h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary sm:grid">{role === 'admin' ? 'سق' : role === 'company' ? 'مت' : 'لع'}</div></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}