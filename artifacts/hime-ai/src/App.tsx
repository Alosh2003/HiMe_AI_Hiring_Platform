import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LanguageProvider } from '@/i18n';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AboutPage, AdminApplicationsPage, AdminCandidatesPage, AdminCompaniesPage, AdminJobsPage, ApplicationsPage, CandidatesPage, CompanyJobDetailPage, CompanyJobsPage, HomePage, JobsPage, NewJobPage, RecommendationsPage } from '@/pages/Pages';
import { JobDetailsPage, LoginPage, RegisterPage, SeekerCvPage } from '@/pages/TrustFlows';
import { AdminDashboardPage, AdminProfilePage, CandidateDashboardPage, CandidateProfilePage, CompanyDashboardPage, CompanyProfilePage } from '@/pages/PortalPages';
import { CandidateReviewPage } from '@/pages/WorkflowPages';

const queryClient = new QueryClient();
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() { return <RoutedErrorBoundary><Switch><Route path="/" component={HomePage} /><Route path="/jobs" component={JobsPage} /><Route path="/jobs/:id" component={JobDetailsPage} /><Route path="/login" component={LoginPage} /><Route path="/register" component={RegisterPage} /><Route path="/about" component={AboutPage} /><Route path="/seeker/dashboard" component={CandidateDashboardPage} /><Route path="/seeker/profile" component={CandidateProfilePage} /><Route path="/seeker/cv" component={SeekerCvPage} /><Route path="/seeker/recommendations" component={RecommendationsPage} /><Route path="/seeker/applications" component={ApplicationsPage} /><Route path="/company/dashboard" component={CompanyDashboardPage} /><Route path="/company/profile" component={CompanyProfilePage} /><Route path="/company/jobs/new" component={NewJobPage} /><Route path="/company/jobs/:jobId/candidates/:candidateId" component={CandidateReviewPage} /><Route path="/company/jobs/:id/candidates" component={CandidatesPage} /><Route path="/company/jobs/:id" component={CompanyJobDetailPage} /><Route path="/company/jobs" component={CompanyJobsPage} /><Route path="/admin/dashboard" component={AdminDashboardPage} /><Route path="/admin/profile" component={AdminProfilePage} /><Route path="/admin/companies" component={AdminCompaniesPage} /><Route path="/admin/candidates" component={AdminCandidatesPage} /><Route path="/admin/jobs" component={AdminJobsPage} /><Route path="/admin/applications" component={AdminApplicationsPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><LanguageProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></LanguageProvider></TooltipProvider><Toaster /></QueryClientProvider>; }
export default App;