import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BriefcaseBusiness, Building2, FileText, LayoutDashboard, LogOut,
  Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings, ShieldCheck, Sparkles,
  Users, X,
} from 'lucide-react';
import { LanguageSwitch, Logo } from '@/components/app-kit';
import { BrandMark, BrandPattern } from '@/components/brand-pattern';
import { NotificationBell } from '@/components/notification-bell';
import { useLanguage } from '@/i18n';
import { useAuth } from '@/contexts/auth-context';
import { fileSrc } from '@/services/api/demo-api';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export type PortalRole = 'seeker' | 'company' | 'admin';

const roleContent = {
  seeker: {
    account: 'حساب الباحث عن عمل',
    name: 'باحث عن فرصة',
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
    name: 'حساب الشركة',
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
    name: 'إدارة المنصة',
    greeting: 'مركز إدارة Hire me',
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

const FOLD_KEY = 'hime_sidebar_folded';

/**
 * The shell every signed-in page renders inside.
 *
 * The sidebar folds to an icon rail on desktop (persisted per user in
 * localStorage) and holds every page of the role, so nothing lives behind a
 * URL you have to remember. Sign-out sits both in the sidebar footer and in
 * the header, reachable at every scroll position and on every role.
 */
export function RoleShell({ role, children }: { role: PortalRole; children: ReactNode }) {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [folded, setFolded] = useState(() => {
    try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
  });
  const { t, dir } = useLanguage();
  const { user, logout } = useAuth();
  const content = roleContent[role];

  // Track the <768px viewport so the drawer can slide off-canvas on mobile
  // only. Doing this in JS (instead of `ltr:`/`rtl:` + `md:` Tailwind
  // variants) is deliberate: Tailwind v4 orders the rtl: variant AFTER the
  // md: media query, so `rtl:translate-x-full` used to beat `md:translate-x-0`
  // and the sidebar stayed shifted a full width off-screen on desktop.
  // matchMedia mirrors the CSS `md:` breakpoint exactly; the innerWidth
  // fallback covers environments without matchMedia (jsdom) and resize
  // covers the test harness which drives width via window.innerWidth.
  const queryNarrow = () =>
    typeof window === 'undefined'
      ? false
      : typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth < 768;

  const [narrow, setNarrow] = useState(queryNarrow);

  useEffect(() => {
    const onChange = () => setNarrow(queryNarrow());
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 767px)') : null;
    mq?.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mq?.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  // Off-canvas only while the mobile drawer is closed; desktop is always on.
  const offCanvas = narrow && !mobileOpen;

  // The signed-in identity — never a hardcoded persona. Falls back to the
  // role's generic label when the session has no stored name.
  const displayName = user?.name?.trim() || content.name;
  // Show the uploaded photo wherever the initials box used to stand alone.
  const userAvatar = fileSrc(user?.avatarUrl);
  const avatar = initials(displayName);
  const firstName = displayName.split(' ')[0];

  useEffect(() => {
    try { localStorage.setItem(FOLD_KEY, folded ? '1' : '0'); } catch { /* private mode */ }
  }, [folded]);

  // Clear the session before navigating, otherwise the auth guard would
  // bounce the user straight back into the dashboard.
  const signOut = () => {
    logout();
    navigate('/login');
  };

  // Deepest match wins so /company/jobs/123 highlights "الوظائف" while
  // /company/jobs/new highlights "إضافة وظيفة".
  const activeHref = content.links
    .map(([href]) => href as string)
    .filter((href) => location === href || location.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const settingsHref = role === 'admin' ? '/admin/profile' : role === 'company' ? '/company/profile' : '/seeker/profile';

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside
        data-offcanvas={offCanvas ? '1' : '0'}
        style={{ transform: offCanvas ? (dir === 'rtl' ? 'translateX(100%)' : 'translateX(-100%)') : 'translateX(0)' }}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:transition-[width]',
          folded ? 'md:w-20' : 'md:w-72',
        )}
      >
        <div className={cn('flex h-20 shrink-0 items-center justify-between', folded ? 'justify-center px-3' : 'px-6')}>
          {folded ? (
            <button
              type="button"
              onClick={() => setFolded(false)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sm font-black text-sidebar-primary-foreground"
              aria-label="فتح القائمة الجانبية"
              title="فتح القائمة الجانبية — عرض أسماء الصفحات"
              data-testid="button-unfold-rail"
            ><BrandMark className="h-5 w-5" /></button>
          ) : (
            <Logo light />
          )}
          <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" data-testid="button-role-close-sidebar"><X className="h-5 w-5" /></button>
        </div>

        {!folded && (
          <div className="shrink-0 px-4 pb-6">
            <div className="rounded-2xl border border-white/10 bg-sidebar-accent p-4">
              <div className="mb-3 flex items-center gap-2 text-xs text-sidebar-foreground/60"><span className="h-2 w-2 rounded-full bg-brand-accent" />{content.account}</div>
              <div className="flex items-center gap-3">
                <div className="relative"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-accent text-sm font-bold text-brand-ink">{avatar}</div>{userAvatar && <img src={userAvatar} alt="" className="absolute inset-0 h-10 w-10 rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} data-testid="img-sidebar-avatar" />}</div>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{displayName}</p><p className="mt-1 text-[11px] text-sidebar-foreground/50">{role === 'admin' ? 'مدير المنصة' : role === 'company' ? 'حساب موثق' : 'باحث عن فرصة'}</p></div>
              </div>
            </div>
          </div>
        )}
        {folded && (
          <div className="flex shrink-0 justify-center pb-4 pt-2">
            <div className="relative"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-accent text-sm font-bold text-brand-ink" title={displayName}>{avatar}</div>{userAvatar && <img src={userAvatar} alt="" className="absolute inset-0 h-10 w-10 rounded-xl object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
          {content.links.map(([href, Icon, label]) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} title={folded ? (label as string) : undefined} className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
              folded && 'justify-center px-0',
              activeHref === href ? 'bg-sidebar-primary font-bold text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )} data-testid={`link-role-${href.replaceAll('/', '-').replace(/^-/, '')}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className={cn(folded && 'sr-only')}>{label as string}</span>
            </Link>
          ))}
        </nav>

        <div className={cn('shrink-0 space-y-1 border-t border-sidebar-border pt-4', folded ? 'px-3 pb-4' : 'px-4 pb-5')}>
          <Link href={settingsHref} title={folded ? 'الإعدادات' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent', folded && 'justify-center px-0')} data-testid="link-role-settings"><Settings className="h-4 w-4 shrink-0" /><span className={cn(folded && 'sr-only')}>الإعدادات</span></Link>
          <button type="button" onClick={signOut} title={folded ? t('logout') : undefined} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent', folded && 'justify-center px-0')} data-testid="link-role-logout"><LogOut className="h-4 w-4 shrink-0" /><span className={cn(folded && 'sr-only')}>{t('logout')}</span></button>
        </div>
      </aside>

      <div className={cn('md:transition-[padding]', folded ? 'md:ps-20' : 'md:ps-72')}>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة" data-testid="button-open-sidebar"><Menu /></button>
            <button
              type="button"
              onClick={() => setFolded((value) => !value)}
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:grid"
              aria-label={folded ? 'فتح القائمة الجانبية' : 'طيّ القائمة الجانبية'}
              title={folded ? 'فتح القائمة الجانبية' : 'طيّ القائمة الجانبية'}
              data-testid="button-toggle-sidebar"
            >
              {folded ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className="hidden md:block"><p className="text-xs text-muted-foreground">{content.greeting}</p><p className="font-semibold">صباح الخير، {firstName}</p></div>
          </div>
          <div className="ms-auto flex items-center gap-3">
            <LanguageSwitch />
            <NotificationBell />
            <button
              type="button"
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={t('logout')}
              title={t('logout')}
              data-testid="button-header-logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <Link
              href={settingsHref}
              title="الملف الشخصي"
              aria-label="الملف الشخصي"
              className="relative block rounded-full ring-2 ring-brand-accent/55 transition-shadow hover:ring-brand-accent"
              data-testid="link-header-profile"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{avatar}</span>
              {userAvatar && <img src={userAvatar} alt="" className="absolute inset-0 h-9 w-9 rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} data-testid="img-header-avatar" />}
            </Link>
          </div>
        </header>
        {/* Brand lattice behind the portal content: isolated + negative z so
            cards and copy stay above it while the gutters carry the motif. */}
        <main className="relative isolate mx-auto max-w-[1500px] p-4 md:p-8">
          <BrandPattern className="-z-10 text-primary opacity-[0.05]" />
          {children}
        </main>
      </div>
    </div>
  );
}
