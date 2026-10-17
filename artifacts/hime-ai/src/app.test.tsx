import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import App from './App';
import { server, TEST_IDS } from '@/test/msw';
import { assessRedirectTarget } from '@/lib/routes';

const JOB_ID = TEST_IDS.job1;
const CANDIDATE_ID = TEST_IDS.candidate1;

const publicRoutes = ['/', '/jobs', '/jobs/does-not-exist', '/login', '/register', '/about'];

const seekerRoutes = [
  '/seeker/dashboard',
  '/seeker/profile',
  '/seeker/cv',
  '/seeker/recommendations',
  '/seeker/applications',
];

const companyRoutes = [
  '/company/dashboard',
  '/company/profile',
  '/company/jobs',
  '/company/jobs/new',
  `/company/jobs/${JOB_ID}`,
  `/company/jobs/${JOB_ID}/candidates`,
  `/company/jobs/${JOB_ID}/candidates/${CANDIDATE_ID}`,
];

const adminRoutes = [
  '/admin/dashboard',
  '/admin/profile',
  '/admin/companies',
  '/admin/candidates',
  '/admin/jobs',
  '/admin/applications',
];

const allRoutes = [...publicRoutes, ...seekerRoutes, ...companyRoutes, ...adminRoutes];

function renderAt(path: string, width = 1440) {
  window.history.pushState({}, '', path);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  return render(<App />);
}

function setRole(role: 'seeker' | 'company' | 'admin') {
  localStorage.setItem('hime_ai_user', JSON.stringify({
    id: 'f14e27ff-7e71-40af-8335-8b28c44852c7',
    email: `${role}@hime.ai`,
    name: 'Test User',
    role,
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
  document.documentElement.lang = '';
  document.documentElement.dir = '';
  // Reset auth so each test starts from a known state
  localStorage.setItem('hime_ai_token', 'test-jwt-token');
  setRole('seeker');
});

// ─── Route rendering ────────────────────────────────────────────────────────

describe('route matrix', () => {
  it.each([390, 1440])('renders every route at %spx without a blank screen', (width) => {
    for (const path of allRoutes) {
      // Set the role BEFORE mounting so AuthProvider's synchronous
      // initializer reads the correct role for this route.
      setRole(path.startsWith('/admin') ? 'admin' : path.startsWith('/company') ? 'company' : 'seeker');
      localStorage.setItem('hime_ai_token', 'test-jwt-token');

      const view = renderAt(path, width);
      const text = document.body.textContent?.trim() ?? '';

      // A blank page is a failure...
      expect(text.length, `${width}px ${path} rendered nothing`).toBeGreaterThan(0);
      // ...and so is the error boundary catching a render crash, which is
      // how a response-shape mismatch like AdminJobsPage's data.filter
      // shows up.
      expect(
        /Something went wrong|حدث خطأ|Unexpected Application Error/i.test(text),
        `${width}px ${path} crashed`,
      ).toBe(false);

      view.unmount();
      cleanup();
    }
  });
});

describe('language direction', () => {
  it('switches the public shell from Arabic RTL to English LTR', async () => {
    renderAt('/');
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('ar');

    fireEvent.click(screen.getByTestId('button-language'));

    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByText('Your next role is not a coincidence.')).toBeInTheDocument();
  });

  it('keeps the dashboard shell direction switchable on mobile', async () => {
    setRole('seeker');
    renderAt('/seeker/dashboard', 390);
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    fireEvent.click(screen.getByTestId('button-language'));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(screen.getByTestId('button-open-sidebar')).toBeInTheDocument();
  });
});

// ─── Sidebar shell ──────────────────────────────────────────────────────────

describe('sidebar shell', () => {
  // jsdom's matchMedia (when present) never evaluates media conditions, so
  // stub it to mirror window.innerWidth — the same signal renderAt() drives.
  function stubMatchMedia() {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: /max-width:\s*767px/.test(query) && window.innerWidth < 768,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }));
  }

  it('keeps the sidebar on-canvas at desktop widths (never parked off-screen)', async () => {
    setRole('seeker');
    stubMatchMedia();
    renderAt('/seeker/dashboard', 1440);
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));

    const aside = document.querySelector('aside');
    expect(aside).not.toBeNull();
    // The v4 regression: rtl:translate-x-full out-cascaded md:translate-x-0,
    // shifting the whole sidebar a full width past the right edge.
    expect(aside?.getAttribute('data-offcanvas')).toBe('0');
    expect(aside?.style.transform).not.toContain('100%');
    // Content keeps its start padding beside the visible sidebar.
    expect(screen.getByTestId('button-toggle-sidebar')).toBeInTheDocument();
  });

  it('slides the sidebar off-canvas on mobile and back when the drawer opens', async () => {
    setRole('seeker');
    stubMatchMedia();
    renderAt('/seeker/dashboard', 390);
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));

    const aside = document.querySelector('aside');
    expect(aside?.getAttribute('data-offcanvas')).toBe('1');
    expect(aside?.style.transform).toContain('100%'); // RTL slides toward the right

    fireEvent.click(screen.getByTestId('button-open-sidebar'));
    expect(aside?.getAttribute('data-offcanvas')).toBe('0');
    expect(aside?.style.transform).not.toContain('100%');

    fireEvent.click(screen.getByTestId('button-role-close-sidebar'));
    expect(aside?.getAttribute('data-offcanvas')).toBe('1');
    expect(aside?.style.transform).toContain('100%');
  });
});

// ─── Role workflow ──────────────────────────────────────────────────────────

describe('role workflows', () => {
  it('renders the seeker workflow guide', async () => {
    setRole('seeker');
    renderAt('/seeker/dashboard');
    expect(await screen.findByTestId('workflow-guide-seeker')).toBeInTheDocument();
  });

  it('renders the company workflow guide', async () => {
    setRole('company');
    renderAt('/company/dashboard');
    expect(await screen.findByTestId('workflow-guide-company')).toBeInTheDocument();
  });

  it('renders the admin workflow guide', async () => {
    setRole('admin');
    renderAt('/admin/dashboard');
    expect(await screen.findByTestId('workflow-guide-admin')).toBeInTheDocument();
  });

  it('renders ranked candidates with sort controls', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt(`/company/jobs/${JOB_ID}/candidates`);

    expect(await screen.findByText('سارة الحربي', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('select-candidate-sort')).toBeInTheDocument();
    expect(screen.getByTestId('select-candidate-status')).toBeInTheDocument();
  });

  it('lets a company shortlist a candidate from the review page', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt(`/company/jobs/${JOB_ID}/candidates/${CANDIDATE_ID}`);

    const shortlist = await screen.findByTestId('button-shortlist-candidate', {}, { timeout: 3000 });
    fireEvent.click(shortlist);
    expect(screen.getByTestId('status-candidate-decision')).toBeInTheDocument();
  });
});

// ─── Route protection ───────────────────────────────────────────────────────

describe('route protection', () => {
  it('redirects a signed-out user to login and remembers where they aimed', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');

    renderAt('/seeker/applications');

    // Guard redirects to /login?next=/seeker/applications — no click needed.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(window.location.search).toContain(encodeURIComponent('/seeker/applications'));
  });

  it('sends a seeker away from admin routes to their own dashboard', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/admin/dashboard');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/dashboard');
    });
  });

  it('sends a company away from seeker routes to their own dashboard', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/seeker/dashboard');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/company/dashboard');
    });
  });

  it('keeps an admin on admin routes', async () => {
    setRole('admin');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/admin/dashboard');

    await screen.findByTestId('workflow-guide-admin');
    expect(window.location.pathname).toBe('/admin/dashboard');
  });

  it('keeps a signed-in user off the login and register pages', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/login');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/dashboard');
    });
  });
});

// ─── Authentication flows ───────────────────────────────────────────────────

describe('authentication', () => {
  it('does not report sign-in success for empty credentials', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/login');

    fireEvent.click(screen.getByTestId('button-submit-login'));

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe('/login');
  });

  it('sends a signed-in user straight to the role dashboard', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-submit-login'));

    // No manual "go to dashboard" click — the route changes by itself.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/dashboard');
    }, { timeout: 3000 });
  });

  it('honours ?next= after login when it belongs to the same role', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    window.history.pushState({}, '', '/login?next=/seeker/recommendations');
    render(<App />);

    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-submit-login'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/recommendations');
    }, { timeout: 3000 });
  });

  it('ignores ?next= pointing at another role', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    window.history.pushState({}, '', '/login?next=/admin/jobs');
    render(<App />);

    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-submit-login'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/dashboard');
    }, { timeout: 3000 });
  });

  it('keeps the chosen role when terms are ticked in the same batch', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    fireEvent.change(screen.getByTestId('input-register-name'), { target: { value: 'Noura' } });
    fireEvent.change(screen.getByTestId('input-register-email'), { target: { value: 'n@example.com' } });
    fireEvent.change(screen.getByTestId('input-register-password'), { target: { value: 'correct-password' } });

    // Role and terms are separate state updates. With a stale closure one
    // overwrites the other: either the account registers as a seeker, or the
    // terms tick is lost and registration is rejected.
    fireEvent.click(screen.getByTestId('button-role-company'));
    fireEvent.click(screen.getByTestId('checkbox-terms'));
    expect(screen.getByTestId('button-role-company')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('button-submit-register'));

    // Landing on the company onboarding page proves the role survived.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/company/profile');
    }, { timeout: 3000 });
  });

  it('requires terms consent on registration', async () => {
    // GuestRoute bounces signed-in users off /register, so start signed out.
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    fireEvent.change(screen.getByTestId('input-register-name'), { target: { value: 'Layan' } });
    fireEvent.change(screen.getByTestId('input-register-email'), { target: { value: 'layan@example.com' } });
    fireEvent.change(screen.getByTestId('input-register-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-role-company'));
    fireEvent.click(screen.getByTestId('button-submit-register'));

    expect(screen.getByTestId('error-register-terms')).toBeInTheDocument();
    expect(screen.getByTestId('button-role-company')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('checkbox-terms'));
    fireEvent.click(screen.getByTestId('button-submit-register'));

    // A brand-new company goes into onboarding, not straight to the dashboard.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/company/profile');
    }, { timeout: 3000 });
  });

  it('sends a brand-new seeker into CV onboarding', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    fireEvent.change(screen.getByTestId('input-register-name'), { target: { value: 'Noura' } });
    fireEvent.change(screen.getByTestId('input-register-email'), { target: { value: 'noura@example.com' } });
    fireEvent.change(screen.getByTestId('input-register-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('checkbox-terms'));
    fireEvent.click(screen.getByTestId('button-submit-register'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/cv');
    }, { timeout: 3000 });
  });
});

// ─── Cross-links and social sign-in ─────────────────────────────────────────

describe('auth page navigation', () => {
  it('offers a link to register from the login page', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    const link = await screen.findByTestId('link-register-from-login');
    expect(link).toHaveAttribute('href', '/register');
    expect(screen.getByTestId('text-login-register-prompt')).toHaveTextContent('ليس لديك حساب');
  });

  it('offers a link to login from the register page', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    const link = await screen.findByTestId('link-login-from-register');
    expect(link).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('text-register-login-prompt')).toHaveTextContent('لديك حساب بالفعل');
  });

  it('hides social sign-in entirely until OAuth is actually implemented', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    await screen.findByTestId('button-submit-login');
    // Decision 2.5: half-finished auth is worse than none. The buttons are
    // gone rather than pretending to work.
    expect(screen.queryByTestId('button-social-google')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-social-github')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-social-facebook')).not.toBeInTheDocument();
  });

  it('hides social sign-up on the register page too', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    await screen.findByTestId('button-submit-register');
    expect(screen.queryByTestId('button-social-google')).not.toBeInTheDocument();
  });

  it('requests a password reset from the login page', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    fireEvent.click(await screen.findByTestId('button-forgot-password'));
    const input = await screen.findByTestId('input-forgot-email');
    fireEvent.change(input, { target: { value: 'seeker@hime.ai' } });
    fireEvent.click(screen.getByTestId('button-submit-forgot'));

    expect(await screen.findByTestId('status-forgot-sent', {}, { timeout: 3000 })).toHaveTextContent('رابط');
  });
});

// ─── Notifications ─────────────────────────────────────────────────────────

describe('notifications', () => {
  it('shows the unread dot and lists notifications in the bell', async () => {
    setRole('seeker');
    renderAt('/seeker/dashboard');

    expect(await screen.findByTestId('badge-notifications-unread', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('button-role-notifications'));

    const panel = await screen.findByTestId('panel-notifications');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/القائمة المختصرة/)).toBeInTheDocument();
  });

  it('marks all notifications as read without breaking the page', async () => {
    setRole('seeker');
    renderAt('/seeker/applications');

    fireEvent.click(await screen.findByTestId('button-role-notifications', {}, { timeout: 3000 }));
    fireEvent.click(await screen.findByTestId('button-notifications-read-all'));
    expect(await screen.findByTestId('panel-notifications')).toBeInTheDocument();
  });
});

// ─── Password reset & email verification pages ─────────────────────────────

describe('password reset page', () => {
  it('confirms a successful reset', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/reset-password?token=abc123def456');

    fireEvent.change(await screen.findByTestId('input-reset-password'), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByTestId('input-reset-confirm'), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByTestId('button-submit-reset'));

    expect(await screen.findByTestId('status-reset-success', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('explains a missing token instead of hanging', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/reset-password');

    expect(await screen.findByTestId('error-reset-no-token')).toBeInTheDocument();
  });

  it('rejects mismatched passwords client-side', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/reset-password?token=abc123def456');

    fireEvent.change(await screen.findByTestId('input-reset-password'), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByTestId('input-reset-confirm'), { target: { value: 'differentpass1' } });
    fireEvent.click(screen.getByTestId('button-submit-reset'));

    expect(await screen.findByTestId('error-reset')).toHaveTextContent('غير متطابقتين');
  });
});

describe('email verification page', () => {
  it('confirms a valid token', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/verify-email?token=abc123def456');

    expect(await screen.findByTestId('status-verify-success', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('offers a resend form when the link is missing or invalid', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/verify-email');

    expect(await screen.findByTestId('error-verify')).toBeInTheDocument();
    expect(screen.getByTestId('input-resend-email')).toBeInTheDocument();
  });
});

// ─── Public CV assessment ──────────────────────────────────────────────────

describe('public CV assessment', () => {
  it('is reachable without signing in', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    expect(await screen.findByTestId('input-assess-role')).toBeInTheDocument();
    expect(screen.getByTestId('input-assess-file')).toBeInTheDocument();
    expect(screen.getByTestId('button-submit-assess')).toBeDisabled();
  });

  it('returns an AI assessment and offers a sign-in CTA', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Senior Backend Engineer' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(screen.getByTestId('button-submit-assess'));

    expect(await screen.findByTestId('status-assess-result', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    // The score appears in both the ring and the summary line.
    expect(screen.getAllByText(/85%/).length).toBeGreaterThan(0);
    expect(screen.getByText('نقاط القوة')).toBeInTheDocument();
    expect(screen.getByText('الفجوات')).toBeInTheDocument();
    expect(screen.getByText('تحسينات مقترحة')).toBeInTheDocument();
  });

  it('sends the visitor to register from the results CTA', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Product Designer' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));

    const cta = await screen.findByTestId('link-assess-to-register', {}, { timeout: 5000 });
    fireEvent.click(cta);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/register');
    }, { timeout: 3000 });
  });

  it('keeps the assessment so the dashboard can show it after sign-in', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Data Analyst' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });

    // The result is persisted for the signed-in dashboard to pick up.
    const saved = JSON.parse(localStorage.getItem('hime_cv_assessment') || '{}');
    expect(saved.overallScore).toBe(85);
    expect(saved.recommendations.length).toBeGreaterThan(0);
  });

// ─── Assessment redirect targets (pure logic) ───────────────────────────────

describe('assessRedirectTarget', () => {
  it('sends a first-time visitor to register', () => {
    expect(assessRedirectTarget(false, null, 95)).toBe('/register');
    expect(assessRedirectTarget(false, 'seeker', 20)).toBe('/register');
  });

  it('sends a signed-in seeker with a strong score to matching jobs', () => {
    expect(assessRedirectTarget(true, 'seeker', 85)).toBe('/seeker/recommendations');
    expect(assessRedirectTarget(true, 'seeker', 60)).toBe('/seeker/recommendations');
  });

  it('sends a signed-in seeker with a weak score to improve the CV first', () => {
    expect(assessRedirectTarget(true, 'seeker', 59)).toBe('/seeker/cv');
    expect(assessRedirectTarget(true, 'seeker', 0)).toBe('/seeker/cv');
  });

  it('sends other roles to their own dashboard', () => {
    expect(assessRedirectTarget(true, 'company', 90)).toBe('/company/dashboard');
    expect(assessRedirectTarget(true, 'admin', 90)).toBe('/admin/dashboard');
  });
});

// ─── Assessment redirect banner ─────────────────────────────────────────────

describe('assessment redirect banner', () => {
  it('tells a first-time visitor they are heading to register', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Data Analyst' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });
    // The banner arrives one render after the result (the countdown starts in
    // an effect), so wait for it explicitly instead of racing it.
    await screen.findByTestId('banner-assess-redirect', {}, { timeout: 3000 });

    expect(screen.getByTestId('button-assess-continue')).toHaveTextContent('إنشاء حساب مجاني');
    // The page never transports anyone on its own: no countdown element and
    // no copy promising an automatic redirect — only the CTA navigates.
    expect(screen.queryByTestId('text-assess-redirect-countdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('banner-assess-redirect').textContent).not.toContain('سيتم تحويلك');
    expect(window.location.pathname).toBe('/assess');
  });

  it('stays on the results when the visitor asks to stay', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Data Analyst' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });
    // Same race as above: the stay button lives inside the banner.
    await screen.findByTestId('banner-assess-redirect', {}, { timeout: 3000 });

    fireEvent.click(screen.getByTestId('button-assess-stay'));

    expect(window.location.pathname).toBe('/assess');
    expect(screen.getByTestId('status-assess-result')).toBeInTheDocument();
    expect(screen.queryByTestId('banner-assess-redirect')).not.toBeInTheDocument();
  });

  it('points a signed-in seeker with a strong score at matching jobs', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    // Mocked score is 85, above the threshold.
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });
    // Banner (and its continue button) arrives one render after the result.
    await screen.findByTestId('banner-assess-redirect', {}, { timeout: 3000 });

    // No register CTA for signed-in users — a continue card instead.
    expect(screen.queryByTestId('link-assess-to-register')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-assess-continue')).toBeInTheDocument();
    expect(screen.getByTestId('button-assess-continue')).toHaveTextContent('استكشف الوظائف المطابقة');

    fireEvent.click(screen.getByTestId('button-assess-continue'));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/recommendations');
    });
  });

  it('points a signed-in seeker with a weak score at CV improvement', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    server.use(
      http.post('*/api/assess', async () => {
        return HttpResponse.json({
          overallScore: 42,
          role: 'Data Analyst',
          breakdown: {
            skills: { score: 40, matched: [], missing: ['SQL'] },
            experience: { score: 45, years: 1, relevant: [] },
            education: { score: 60, notes: 'ok' },
            presentation: { score: 50, notes: 'ok' },
          },
          strengths: ['motivation'],
          gaps: ['experience'],
          recommendations: ['Add a SQL project'],
        });
      }),
    );
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Data Analyst' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });
    // Banner (and its continue button) arrives one render after the result.
    await screen.findByTestId('banner-assess-redirect', {}, { timeout: 3000 });

    expect(screen.getByTestId('button-assess-continue')).toHaveTextContent('حسّن سيرتك');

    fireEvent.click(screen.getByTestId('button-assess-continue'));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/cv');
    });
  });

  it('points a signed-in company at its own dashboard', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Designer' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));
    await screen.findByTestId('status-assess-result', {}, { timeout: 5000 });
    // Banner (and its continue button) arrives one render after the result.
    await screen.findByTestId('banner-assess-redirect', {}, { timeout: 3000 });

    fireEvent.click(screen.getByTestId('button-assess-continue'));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/company/dashboard');
    });
  });
});

  it('explains the free quota in Arabic and offers registration when limited', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    server.use(
      http.post('*/api/assess', async () => {
        return HttpResponse.json(
          { error: 'Too Many Requests', message: 'Assessment limit reached.', retryAfter: 1800 },
          { status: 429 },
        );
      }),
    );
    renderAt('/assess');

    fireEvent.change(screen.getByTestId('input-assess-role'), { target: { value: 'Data Analyst' } });
    fireEvent.change(screen.getByTestId('input-assess-file'), {
      target: { files: [new File(['cv'], 'cv.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('button-submit-assess'));

    const box = await screen.findByTestId('error-assess', {}, { timeout: 5000 });
    expect(box).toHaveTextContent('الحد المجاني');
    expect(box).toHaveTextContent('30 دقيقة');

    const cta = await screen.findByTestId('link-assess-limit-to-register');
    fireEvent.click(cta);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/register');
    }, { timeout: 3000 });
  });
});

// ─── CV upload ──────────────────────────────────────────────────────────────

describe('CV upload', () => {
  it('rejects an unsupported file type', async () => {
    setRole('seeker');
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    const input = screen.getByTestId('input-cv-upload');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'resume.exe', { type: 'application/octet-stream' })] },
    });

    expect(screen.getByTestId('error-cv-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('status-cv-uploading')).not.toBeInTheDocument();
  });

  it('accepts a valid PDF', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    const input = screen.getByTestId('input-cv-upload');
    fireEvent.change(input, {
      target: { files: [new File(['cv'], 'resume.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByTestId('status-cv-success', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('shows what the model extracted and offers the next onboarding step', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    fireEvent.change(screen.getByTestId('input-cv-upload'), {
      target: { files: [new File(['cv'], 'resume.pdf', { type: 'application/pdf' })] },
    });

    // The extracted headline comes from the CV, not the placeholder.
    expect(await screen.findByText('مهندس برمجيات أول', {}, { timeout: 5000 })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('button-continue-profile'));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/seeker/profile');
    }, { timeout: 3000 });
  });

  it('shows every extracted skill and the full-file counts after upload', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    fireEvent.change(screen.getByTestId('input-cv-upload'), {
      target: { files: [new File(['cv'], 'resume.pdf', { type: 'application/pdf' })] },
    });

    // The 7th skill proves the list is no longer cut down to a short preview.
    expect(await screen.findByText('Kubernetes', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();
    const counts = await screen.findByTestId('text-cv-extract-counts');
    expect(counts).toHaveTextContent('خبرة عمل');
    expect(counts).toHaveTextContent('مؤهل دراسي');
    expect(counts).toHaveTextContent('مشروع');
    expect(screen.queryByTestId('warning-cv-parse')).not.toBeInTheDocument();
  });

  it('reports a file it could not read instead of showing stale data', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    server.use(
      http.post('*/api/candidates/cv', async () => {
        return HttpResponse.json({
          parsed: false,
          parseError: 'LLM returned no usable CV fields',
        });
      }),
    );
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    fireEvent.change(screen.getByTestId('input-cv-upload'), {
      target: { files: [new File(['cv'], 'scan.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByTestId('warning-cv-parse', {}, { timeout: 5000 })).toHaveTextContent('LLM returned no usable CV fields');
    // The extracted card must not claim fresh extraction for this upload.
    expect(screen.queryByTestId('text-cv-extract-counts')).not.toBeInTheDocument();
  });
});

// ─── Job application ────────────────────────────────────────────────────────

describe('applications', () => {
  it('confirms a successful application', async () => {
    setRole('seeker');
    renderAt(`/jobs/${JOB_ID}`);

    const applyButton = await screen.findByTestId('button-apply-job', {}, { timeout: 3000 });
    fireEvent.click(applyButton);

    expect(await screen.findByTestId('status-application-success', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('surfaces an error when the apply request fails', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    // Override the apply endpoint for this test only
    server.use(
      http.post('*/api/applications', async () => {
        return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }),
    );

    renderAt(`/jobs/${JOB_ID}`);
    const applyButton = await screen.findByTestId('button-apply-job', {}, { timeout: 3000 });
    fireEvent.click(applyButton);

    expect(await screen.findByTestId('error-application', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

// ─── Job posting gate (verification required) ───────────────────────────────

describe('job posting gate', () => {
  it('shows the form to a verified company', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/company/jobs/new');

    // Step 1 of the form renders (publish lives on step 3).
    expect(await screen.findByTestId('button-next-step', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByTestId('card-job-post-blocked')).not.toBeInTheDocument();
  });

  it('blocks an unverified company with an explanation', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    server.use(
      http.get('*/api/companies/me/profile', async () => {
        await delay(10);
        return HttpResponse.json({
          id: TEST_IDS.company1,
          name: 'شركة جديدة',
          industry: 'تقنية المعلومات',
          location: 'الرياض',
          website: '',
          description: 'وصف تجريبي للشركة الجديدة.',
          verified: false,
          verificationStatus: 'pending',
        });
      }),
    );
    renderAt('/company/jobs/new');

    expect(await screen.findByTestId('card-job-post-blocked', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('link-job-blocked-to-profile')).toHaveAttribute('href', '/company/profile');
    expect(screen.queryByTestId('button-publish-job')).not.toBeInTheDocument();
  });

  it('blocks a company without any profile from posting', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    server.use(
      http.get('*/api/companies/me/profile', async () => {
        await delay(10);
        return HttpResponse.json({
          id: '', name: '', industry: '', location: '', website: '',
          description: '', verified: false, verificationStatus: 'draft',
        });
      }),
    );
    renderAt('/company/jobs/new');

    expect(await screen.findByTestId('card-job-post-blocked', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

// ─── AI job draft ────────────────────────────────────────────────────────────

describe('AI job draft', () => {
  it('fills the whole wizard from a pasted ad', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    renderAt('/company/jobs/new');

    await screen.findByTestId('card-ai-draft', {}, { timeout: 3000 });
    fireEvent.change(screen.getByTestId('textarea-job-ad'), {
      target: { value: 'We are hiring a Senior Data Analyst with SQL and Power BI.' },
    });
    fireEvent.click(screen.getByTestId('button-ai-draft'));

    // The extracted draft lands in step 1 and the status says so.
    expect(await screen.findByTestId('status-ai-draft', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('محلل بيانات أول')).toBeInTheDocument();

    // Step 2 carries the extracted skills…
    fireEvent.click(screen.getByTestId('button-next-step'));
    expect(await screen.findByText('SQL', {}, { timeout: 3000 })).toBeInTheDocument();

    // …and step 3 the salary, plus a deadline that is never in the past.
    fireEvent.click(screen.getByTestId('button-next-step'));
    expect(await screen.findByDisplayValue('15000', {}, { timeout: 3000 })).toBeInTheDocument();
    const deadline = screen.getByTestId('input-job-deadline') as HTMLInputElement;
    const today = new Date().toISOString().slice(0, 10);
    expect(deadline.value >= today).toBe(true);
    expect(deadline).toHaveAttribute('min', today);
  });

  it('reports an unreachable AI instead of silently doing nothing', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');
    server.use(
      http.post('*/api/ai/parse-job-ad', async () => {
        await delay(10);
        return HttpResponse.json(
          {
            error: 'AI draft unavailable',
            message: 'تعذر الوصول إلى محرك الذكاء الاصطناعي الآن. أكمل الحقول يدوياً أو حاول لاحقاً.',
          },
          { status: 502 },
        );
      }),
    );
    renderAt('/company/jobs/new');

    await screen.findByTestId('card-ai-draft', {}, { timeout: 3000 });
    fireEvent.change(screen.getByTestId('input-ai-position'), { target: { value: 'محلل بيانات' } });
    fireEvent.click(screen.getByTestId('button-ai-draft'));

    const error = await screen.findByTestId('error-ai-draft', {}, { timeout: 5000 });
    expect(error).toHaveTextContent('محرك الذكاء الاصطناعي');
    expect(screen.queryByTestId('status-ai-draft')).not.toBeInTheDocument();
  });
});