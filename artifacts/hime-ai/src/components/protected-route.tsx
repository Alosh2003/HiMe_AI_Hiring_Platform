import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth, type UserRole } from '@/contexts/auth-context';
import { LoadingState } from '@/components/app-kit';
import { useLanguage } from '@/i18n';
import { roleHome } from '@/lib/routes';

/**
 * Imperative redirect. Wouter's <Redirect> renders instead of the route's
 * children, which caused a type error when nesting a fallback inside it.
 */
function Navigate({ to, children }: { to: string; children: ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return <>{children}</>;
}

interface ProtectedRouteProps {
  roles: UserRole[];
  children: ReactNode;
}

/**
 * Guards a role-scoped route.
 *
 * Signed out -> redirects straight to /login carrying a ?next= so the user
 * lands back where they were aiming. Signed in with the wrong role -> that
 * user's own dashboard, not a dead-end "forbidden" screen.
 */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth();
  const { t } = useLanguage();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location);
    return (
      <Navigate to={`/login?next=${next}`}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold" data-testid="auth-required-message">{t('loginRequired')}</p>
          <a
            href="/login"
            data-testid="auth-required-login-link"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {t('signIn')}
          </a>
        </div>
      </Navigate>
    );
  }

  if (!hasRole(roles)) {
    // Wrong role: send them to their own dashboard instead of a wall.
    const home = roleHome(user?.role);
    return (
      <Navigate to={home}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold" data-testid="access-denied-message">{t('accessDenied')}</p>
          <a
            href={home}
            data-testid="access-denied-home-link"
            className="rounded-lg border border-border px-6 py-3 text-sm font-bold hover:bg-muted"
          >
            {t('backToHome')}
          </a>
        </div>
      </Navigate>
    );
  }

  return <>{children}</>;
}

interface GuestRouteProps {
  children: ReactNode;
}

/**
 * Wraps /login and /register so an already-signed-in visitor is sent
 * straight to their dashboard instead of the auth form.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingState />;
  if (isAuthenticated) return <Navigate to={roleHome(user?.role)}>{children}</Navigate>;

  return <>{children}</>;
}