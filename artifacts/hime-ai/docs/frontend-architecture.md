# HiMe AI frontend architecture

## Structure

The app is organized around a small, replaceable service boundary:

- `src/types` contains the domain contracts used by pages and future API responses.
- `src/services/api/ApiClient.ts` owns the future REST client and typed local demo service.
- `src/i18n` owns Arabic-first copy, language state, and document `dir` / `lang` updates.
- `src/components/app-kit.tsx` contains the shared navigation, dashboard shell, cards, score visualizations, field primitives, and data states.
- `src/layouts` re-exports shared dashboard layouts.
- `src/pages/Pages.tsx` contains route-level compositions. Components never define fixture objects.
- `src/pages/TrustFlows.tsx` owns the hardened sign-in, registration, CV upload, and job application states.
- `src/services/validation.ts` contains pure validation rules shared by the trust-flow UI and automated tests.
- `src/hooks/use-demo.ts` provides a small async loading/error/retry boundary for demo calls.

## Routing

Wouter uses one flat top-level `Switch` in `src/App.tsx`. Public routes use `PublicNav`; seeker and company routes use `DashboardLayout`. Dynamic routes are placed before their broader siblings, e.g. candidate details before the company job list.

## Product workflows

The role journeys are intentionally connected instead of being isolated dashboards:

- Candidate: register or sign in → candidate dashboard → complete profile → review CV → inspect explainable recommendations → open a job → apply → follow the application.
- Company: register or sign in → company dashboard → complete company profile → publish a job → review ranked candidates → open a candidate review → shortlist or start a conversation.
- Admin: sign in → platform dashboard → verify companies → review jobs → monitor applications and reports → manage admin permissions and notifications.

`WorkflowGuide` renders these sequences inside each role dashboard. Role-specific auth destinations, dashboard navigation, company candidate review, and admin navigation all use the same route graph. The app remains frontend-only and these transitions use typed demo services until the REST services are connected.

## Components and states

The visual system uses a deep teal / warm saffron palette: teal communicates capability and trust, while saffron gives important actions a human signal. `LoadingState`, `FeedbackState`, empty-search states, inline success feedback, and upload progress are available to every data-driven surface.

## API abstraction

`ApiClient` reads `VITE_API_BASE_URL` and is ready for:

`register`, `login`, `logout`, `me`, `listJobs`, `getJob`, seeker profile read/update, CV upload metadata, recommendations, applications, apply, company jobs, job CRUD, and ranked candidates.

Until Laravel is connected, `demoApi` is the only source of demo data. Components call its methods rather than importing fixtures. Replace or extend that service behind the same contracts when the REST API is ready. No secrets belong in `VITE_*` variables.

## Types

The core model types are `User`, `CandidateProfile`, `Company`, `Job`, `Skill`, `Experience`, `Education`, `Project`, `Certification`, `Application`, `MatchResult`, and `Notification`.

## i18n and direction

Arabic is the default. `LanguageProvider` updates `document.documentElement.lang` and `dir` and exposes a `t()` helper plus the language switcher. Layout uses logical spacing utilities (`start`, `end`, `ps`, `pe`) so navigation and cards remain readable in both RTL and LTR.

## Environment

Set `VITE_API_BASE_URL` to the future API origin or path. The default is `/api/v1` for local integration. This frontend does not implement auth persistence, a database, Supabase, or backend credentials.

## Trust-flow verification

Run `pnpm --filter @workspace/hime-ai run test` to execute the frontend checks. The suite covers:

- Arabic RTL and English LTR switching in public and dashboard shells.
- Every public, seeker, company, and admin route rendering at 390px and 1440px viewport widths.
- Login and registration validation, role selection, consent, and explicit success feedback.
- CV rejection for unsupported or oversized files, upload progress, and completion feedback.
- Job application success and service-error feedback.
- Company candidate ranking and sorting surface.

The test suite uses the current typed `demoApi` service boundary, so it can remain in place when the Laravel REST implementation replaces the demo service.