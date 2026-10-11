import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LanguageProvider } from '@/i18n';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import {
  AboutPage, ApplicationsPage, CandidatesPage, CompanyJobDetailPage,
  CompanyJobsPage, HomePage, JobsPage, NewJobPage, RecommendationsPage
} from '@/pages/Pages';
import { JobDetailsPage, LoginPage, RegisterPage, SeekerCvPage } from '@/pages/TrustFlows';
import {
  AdminDashboardPage, AdminProfilePage, CandidateDashboardPage,
  CandidateProfilePage, CompanyDashboardPage, CompanyProfilePage
} from '@/pages/PortalPages';
import { CandidateReviewPage } from '@/pages/WorkflowPages';
import {
  AdminCompaniesPage, AdminCandidatesPage, AdminJobsPage, AdminApplicationsPage
} from '@/pages/AdminPages';

const queryClient = new QueryClient();
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/jobs/:id" component={JobDetailsPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/about" component={AboutPage} />

        {/* Seeker routes */}
        <Route path="/seeker/dashboard">
          <ProtectedRoute roles={['seeker']}><CandidateDashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/seeker/profile">
          <ProtectedRoute roles={['seeker']}><CandidateProfilePage /></ProtectedRoute>
        </Route>
        <Route path="/seeker/cv">
          <ProtectedRoute roles={['seeker']}><SeekerCvPage /></ProtectedRoute>
        </Route>
        <Route path="/seeker/recommendations">
          <ProtectedRoute roles={['seeker']}><RecommendationsPage /></ProtectedRoute>
        </Route>
        <Route path="/seeker/applications">
          <ProtectedRoute roles={['seeker']}><ApplicationsPage /></ProtectedRoute>
        </Route>

        {/* Company routes */}
        <Route path="/company/dashboard">
          <ProtectedRoute roles={['company']}><CompanyDashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/company/profile">
          <ProtectedRoute roles={['company']}><CompanyProfilePage /></ProtectedRoute>
        </Route>
        <Route path="/company/jobs/new">
          <ProtectedRoute roles={['company']}><NewJobPage /></ProtectedRoute>
        </Route>
        <Route path="/company/jobs/:jobId/candidates/:candidateId">
          <ProtectedRoute roles={['company']}><CandidateReviewPage /></ProtectedRoute>
        </Route>
        <Route path="/company/jobs/:id/candidates">
          <ProtectedRoute roles={['company']}><CandidatesPage /></ProtectedRoute>
        </Route>
        <Route path="/company/jobs/:id">
          <ProtectedRoute roles={['company']}><CompanyJobDetailPage /></ProtectedRoute>
        </Route>
        <Route path="/company/jobs">
          <ProtectedRoute roles={['company']}><CompanyJobsPage /></ProtectedRoute>
        </Route>

        {/* Admin routes */}
        <Route path="/admin/dashboard">
          <ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/profile">
          <ProtectedRoute roles={['admin']}><AdminProfilePage /></ProtectedRoute>
        </Route>
        <Route path="/admin/companies">
          <ProtectedRoute roles={['admin']}><AdminCompaniesPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/candidates">
          <ProtectedRoute roles={['admin']}><AdminCandidatesPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/jobs">
          <ProtectedRoute roles={['admin']}><AdminJobsPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/applications">
          <ProtectedRoute roles={['admin']}><AdminApplicationsPage /></ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <LanguageProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </LanguageProvider>
        </TooltipProvider>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
export default App;
