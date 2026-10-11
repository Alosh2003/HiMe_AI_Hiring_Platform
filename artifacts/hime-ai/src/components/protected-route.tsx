import { type ReactNode } from 'react';
import { useAuth, type UserRole } from '@/contexts/auth-context';
import { LoadingState } from '@/components/app-kit';
import { useLanguage } from '@/i18n';

interface ProtectedRouteProps {
  roles: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return (
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
    );
  }

  if (!hasRole(roles)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold" data-testid="access-denied-message">{t('accessDenied')}</p>
        <a
          href="/"
          data-testid="access-denied-home-link"
          className="rounded-lg border border-border px-6 py-3 text-sm font-bold hover:bg-muted"
        >
          {t('backToHome')}
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
