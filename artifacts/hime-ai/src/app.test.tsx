import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import App from './App';
import { server, TEST_IDS } from '@/test/msw';

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

  it('shows Google, GitHub and Facebook buttons on login', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    expect(await screen.findByTestId('button-social-google')).toBeInTheDocument();
    expect(screen.getByTestId('button-social-github')).toBeInTheDocument();
    expect(screen.getByTestId('button-social-facebook')).toBeInTheDocument();
  });

  it('shows Google, GitHub and Facebook buttons on register', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/register');

    expect(await screen.findByTestId('button-social-google')).toBeInTheDocument();
    expect(screen.getByTestId('button-social-github')).toBeInTheDocument();
    expect(screen.getByTestId('button-social-facebook')).toBeInTheDocument();
  });

  it('does not silently fake a session when a social button is pressed', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');
    renderAt('/login');

    fireEvent.click(await screen.findByTestId('button-social-google'));

    // It explains the provider is not wired up, and stays signed out.
    expect(await screen.findByTestId('status-social-unavailable')).toBeInTheDocument();
    expect(localStorage.getItem('hime_ai_token')).toBeNull();
    expect(window.location.pathname).toBe('/login');
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