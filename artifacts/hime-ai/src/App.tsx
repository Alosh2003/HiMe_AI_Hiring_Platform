import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LanguageProvider } from '@/i18n';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AboutPage, AdminApplicationsPage, AdminCandidatesPage, AdminCompaniesPage, AdminDashboardPage, AdminJobsPage, ApplicationsPage, CandidatesPage, CompanyDashboardPage, CompanyJobDetailPage, CompanyJobsPage, CompanyProfilePage, HomePage, JobDetailsPage, JobsPage, LoginPage, NewJobPage, RecommendationsPage, RegisterPage, SeekerCvPage, SeekerDashboardPage, SeekerProfilePage } from '@/pages/Pages';

const queryClient = new QueryClient();
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() { return <RoutedErrorBoundary><Switch><Route path="/" component={HomePage} /><Route path="/jobs" component={JobsPage} /><Route path="/jobs/:id" component={JobDetailsPage} /><Route path="/login" component={LoginPage} /><Route path="/register" component={RegisterPage} /><Route path="/about" component={AboutPage} /><Route path="/seeker/dashboard" component={SeekerDashboardPage} /><Route path="/seeker/profile" component={SeekerProfilePage} /><Route path="/seeker/cv" component={SeekerCvPage} /><Route path="/seeker/recommendations" component={RecommendationsPage} /><Route path="/seeker/applications" component={ApplicationsPage} /><Route path="/company/dashboard" component={CompanyDashboardPage} /><Route path="/company/profile" component={CompanyProfilePage} /><Route path="/company/jobs/new" component={NewJobPage} /><Route path="/company/jobs/:id/candidates" component={CandidatesPage} /><Route path="/company/jobs/:id" component={CompanyJobDetailPage} /><Route path="/company/jobs" component={CompanyJobsPage} /><Route path="/admin/dashboard" component={AdminDashboardPage} /><Route path="/admin/companies" component={AdminCompaniesPage} /><Route path="/admin/candidates" component={AdminCandidatesPage} /><Route path="/admin/jobs" component={AdminJobsPage} /><Route path="/admin/applications" component={AdminApplicationsPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><LanguageProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></LanguageProvider></TooltipProvider><Toaster /></QueryClientProvider>; }
export default App;