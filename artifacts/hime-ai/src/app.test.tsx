import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { demoApi } from '@/services/api/ApiClient';

const criticalRoutes = [
  '/',
  '/jobs',
  '/jobs/j-1',
  '/jobs/unknown',
  '/login',
  '/register',
  '/about',
  '/seeker/dashboard',
  '/seeker/profile',
  '/seeker/cv',
  '/seeker/recommendations',
  '/seeker/applications',
  '/company/dashboard',
  '/company/profile',
  '/company/jobs',
  '/company/jobs/new',
  '/company/jobs/j-1',
  '/company/jobs/j-1/candidates',
  '/company/jobs/j-1/candidates/u-8',
  '/admin/dashboard',
  '/admin/companies',
  '/admin/candidates',
  '/admin/jobs',
  '/admin/applications',
];

function renderAt(path: string, width = 1440) {
  window.history.pushState({}, '', path);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  return render(<App />);
}

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});

describe('route matrix', () => {
  it.each([390, 1440])('renders every critical route at %spx without a blank screen', (width) => {
    for (const path of criticalRoutes) {
      const view = renderAt(path, width);
      expect(document.body.textContent?.trim().length, `${width}px ${path}`).toBeGreaterThan(0);
      view.unmount();
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

  it('keeps the dashboard shell direction switchable', async () => {
    renderAt('/seeker/dashboard', 390);
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    fireEvent.click(screen.getByTestId('button-language'));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(screen.getByTestId('button-open-sidebar')).toBeInTheDocument();
  });
});

describe('role workflow connections', () => {
  it('shows the candidate, company, and admin workflow guides', async () => {
    renderAt('/seeker/dashboard');
    expect(await screen.findByTestId('workflow-guide-seeker')).toBeInTheDocument();
    cleanup();

    renderAt('/company/dashboard');
    expect(await screen.findByTestId('workflow-guide-company')).toBeInTheDocument();
    cleanup();

    renderAt('/admin/dashboard');
    expect(await screen.findByTestId('workflow-guide-admin')).toBeInTheDocument();
  });

  it('connects candidate ranking to a candidate review page', async () => {
    renderAt('/company/jobs/j-1/candidates');
    const reviewLink = await screen.findByTestId('link-candidate-u-8');
    expect(reviewLink).toHaveAttribute('href', '/company/jobs/j-1/candidates/u-8');

    fireEvent.click(reviewLink);
    expect(await screen.findByTestId('button-shortlist-candidate')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('button-shortlist-candidate'));
    expect(screen.getByTestId('status-candidate-decision')).toBeInTheDocument();
  });

  it('offers role-specific destinations after login', async () => {
    renderAt('/login');
    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-login-role-admin'));
    fireEvent.click(screen.getByTestId('button-submit-login'));
    expect(await screen.findByTestId('link-login-destination')).toHaveAttribute('href', '/admin/dashboard');
  });
});

describe('authentication flows', () => {
  it('does not report sign-in success for invalid values, then confirms valid input', async () => {
    renderAt('/login');
    fireEvent.click(screen.getByTestId('button-submit-login'));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.queryByTestId('status-login-success')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-login-email'), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByTestId('input-login-password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByTestId('button-submit-login'));

    expect(await screen.findByTestId('status-login-success')).toBeInTheDocument();
  });

  it('requires registration consent and preserves the selected account type', async () => {
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

describe('CV upload flow', () => {
  it('surfaces invalid files instead of silently starting an upload', async () => {
    renderAt('/seeker/cv');
    await screen.findByText('AI extracted profile');
    const input = screen.getByTestId('input-cv-upload');
    fireEvent.change(input, { target: { files: [new File(['bad'], 'resume.txt', { type: 'text/plain' })] } });
    expect(screen.getByTestId('error-cv-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('status-cv-uploading')).not.toBeInTheDocument();
  });

  it('shows upload completion after a valid CV is processed', async () => {
    renderAt('/seeker/cv');
    await screen.findByText('AI extracted profile');
    fireEvent.change(screen.getByTestId('input-cv-upload'), { target: { files: [new File(['cv'], 'resume.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByTestId('status-cv-uploading')).toBeInTheDocument();
    expect(await screen.findByTestId('status-cv-success', {}, { timeout: 2000 })).toBeInTheDocument();
  });
});

describe('application and candidate review flows', () => {
  it('confirms a successful application', async () => {
    renderAt('/jobs/j-1');
    expect(await screen.findByTestId('button-apply-job')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('button-apply-job'));
    expect(await screen.findByTestId('status-application-success')).toBeInTheDocument();
  });

  it('shows an application error when the service fails', async () => {
    const apply = vi.spyOn(demoApi, 'apply').mockRejectedValueOnce(new Error('network'));
    renderAt('/jobs/j-1');
    await screen.findByTestId('button-apply-job');
    fireEvent.click(screen.getByTestId('button-apply-job'));
    expect(await screen.findByTestId('error-application')).toBeInTheDocument();
    apply.mockRestore();
  });

  it('renders ranked candidates and exposes the sort control', async () => {
    renderAt('/company/jobs/j-1/candidates');
    expect(await screen.findByText('سارة الحربي')).toBeInTheDocument();
    expect(screen.getByTestId('select-candidate-sort')).toBeInTheDocument();
  });
});