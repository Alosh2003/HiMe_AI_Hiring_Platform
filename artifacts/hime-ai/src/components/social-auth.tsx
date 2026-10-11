import { useState, type ReactElement } from 'react';

type Provider = 'google' | 'github' | 'facebook';

const PROVIDERS: { id: Provider; label: string; testId: string; icon: ReactElement }[] = [
  {
    id: 'google',
    label: 'Google',
    testId: 'button-social-google',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    testId: 'button-social-github',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.7 1.2 3.4.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11 11 0 0 1 6 0C17.1 5 18 5.3 18 5.3c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    testId: 'button-social-facebook',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
      </svg>
    ),
  },
];

interface SocialAuthProps {
  mode: 'signin' | 'signup';
}

/**
 * Social sign-in buttons.
 *
 * These render real, accessible controls but do NOT fake an authentication.
 * OAuth needs client IDs, redirect URIs and a server-side token exchange —
 * none of which exist yet. Until they are wired, the buttons say so instead
 * of silently pretending to log the user in.
 */
export function SocialAuth({ mode }: SocialAuthProps) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          أو تابع باستخدام
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map(({ id, label, testId, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setNotice(`${label} — لم يتم ربط الحساب بعد. استخدم البريد الإلكتروني وكلمة المرور.`)}
            aria-label={`${mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'} باستخدام ${label}`}
            data-testid={testId}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          data-testid="status-social-unavailable"
          className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground"
        >
          {notice}
        </p>
      )}
    </div>
  );
}