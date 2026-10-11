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
      expect(document.body.textContent?.trim().length, `${width}px ${path}`).toBeGreaterThan(0);
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
  it('blocks a signed-out user from seeker routes', async () => {
    localStorage.removeItem('hime_ai_token');
    localStorage.removeItem('hime_ai_user');

    renderAt('/seeker/dashboard');

    expect(await screen.findByTestId('auth-required-message')).toBeInTheDocument();
    expect(screen.getByTestId('auth-required-login-link')).toHaveAttribute('href', '/login');
  });

  it('blocks a seeker from admin routes', async () => {
    setRole('seeker');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/admin/dashboard');

    expect(await screen.findByTestId('access-denied-message')).toBeInTheDocument();
    expect(screen.getByTestId('access-denied-home-link')).toHaveAttribute('href', '/');
  });

  it('blocks a company from seeker routes', async () => {
    setRole('company');
    localStorage.setItem('hime_ai_token', 'test-jwt-token');

    renderAt('/seeker/dashboard');

    expect(await screen.findByTestId('access-denied-message')).toBeInTheDocument();
  });
});

// ─── Authentication flows ───────────────────────────────────────────────────

describe('authentication', () => {
  it('does not report sign-in success for empty credentials', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/login');

    fireEvent.click(screen.getByTestId('button-submit-login'));

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('status-login-success')).not.toBeInTheDocument();
  });

  it('confirms login with valid credentials', async () => {
    localStorage.removeItem('hime_ai_token');
    renderAt('/login');

    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-submit-login'));

    expect(await screen.findByTestId('status-login-success', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('requires terms consent on registration', async () => {
    renderAt('/register');

    fireEvent.change(screen.getByTestId('input-register-name'), { target: { value: 'Layan' } });
    fireEvent.change(screen.getByTestId('input-register-email'), { target: { value: 'layan@example.com' } });
    fireEvent.change(screen.getByTestId('input-register-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-role-company'));
    fireEvent.click(screen.getByTestId('button-submit-register'));

    expect(screen.getByTestId('error-register-terms')).toBeInTheDocument();
    expect(screen.queryByTestId('status-register-success')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('checkbox-terms'));
    fireEvent.click(screen.getByTestId('button-submit-register'));

    expect(await screen.findByTestId('status-register-success')).toBeInTheDocument();
    expect(screen.getByTestId('button-role-company')).toHaveAttribute('aria-pressed', 'true');
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
    renderAt('/seeker/cv');

    await screen.findByText('AI extracted profile');
    const input = screen.getByTestId('input-cv-upload');
    fireEvent.change(input, {
      target: { files: [new File(['cv'], 'resume.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByTestId('status-cv-success', {}, { timeout: 3000 })).toBeInTheDocument();
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