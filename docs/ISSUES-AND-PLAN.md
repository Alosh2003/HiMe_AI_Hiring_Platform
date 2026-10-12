# HiMe AI — Known Issues & Fix Plan

Generated after a full audit of the back-end, AI engine, and front-end.
Everything marked **Verified** was reproduced against the running app or the
database. Everything marked **Inferred** comes from reading the code without
executing it yet.

Severity legend: **P0** security/data · **P1** broken or misleading · **P2** missing
feature · **P3** quality / tech debt

---

## Part 1 — Fixed during this session (record)

These were real bugs, found and closed. Listed so they are not re-reported.

| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | Malformed UUIDs hit Postgres and returned 500 | Any bad `/api/jobs/<id>` | `validate-params.ts` + middleware on all param routes |
| 2 | `?status=bogus` returned 500 | Job list unusable | Zod enum + pagination validation |
| 3 | 500 responses echoed raw SQL error text | Schema/data leak | Generic message in all envs |
| 4 | `JWT_SECRET` was the literal dev string | Anyone could forge tokens | Random 64-char secret generated |
| 5 | Auth loaded in `useEffect` | Login screen flashed on every refresh | Synchronous `useState` hydration |
| 6 | `JobDetailsPage` called `apply()` recursively | Applying hung forever | Aliased import to `applyToJob` |
| 7 | Dashboard linked to `/company/jobs/j-1/...` | Dead link, non-UUID | Derive job id from loaded data |
| 8 | Footer linked to protected routes | Logged-out users hit an auth wall | Point at `/register?role=` |
| 9 | "Log out" was `href="/"` | Token never cleared | Calls `logout()` then redirects |
| 10 | `GET /api/companies/:id/jobs` did not exist (404) | Company job list silently empty | Endpoint added + skills expansion |
| 11 | `listJobs` typed the paginated body as `Job[]` | `/admin/jobs` crashed on `data.filter` | Normalize at the API boundary |
| 12 | `gemini-2.0-flash` retired (404), `gemini-flash-latest` ~50% 503 | AI features silently died | Switched to `gemini-3.5-flash` + retry w/ backoff |
| 13 | `JSON.parse` on raw model output | Fenced/prose replies → empty results | `extractJson()` with fence + brace scanning |
| 14 | No candidate row created at registration | New seekers got 404 on CV upload | Seed row in `POST /auth/register` |
| 15 | `uploadCv` posted a placeholder `fileUrl` | The AI never saw a document | Real multipart upload |
| 16 | `Content-Type: application/json` forced onto FormData | Multer could not read the body | Skip header when body is FormData |
| 17 | LLM failures swallowed in two places | Dead AI looked like a clean empty result | Log + surface `parsed` / `parseError` |
| 18 | Stale closure in auth forms | Two batched updates dropped a sibling field | Functional `setState` updaters |
| 19 | Uploaded CVs committed to git | Personal data in the repo | Removed + gitignored |
| 20 | Company verification not enforced (O1) | Unverified companies posted to the public board | `verificationStatus` guard on `POST /api/jobs`, public listing/detail gated, applications to hidden jobs refused, `NewJobPage` gate |
| 21 | Uploads served publicly (O3) | Any CV readable with a URL | Authenticated `/files` route with seeker-ownership check (admin bypass), traversal-safe |
| 22 | No audit trail (O4) | Admin actions left no record | `audit_logs` table + `writeAudit()` on verify/reject/suspend/delete/verification-request/job-create |

---

## Part 2 — Open problems

### P0 — Security / data integrity

**O1 · Company verification is not enforced — FIXED (Phase 1)**
`POST /api/jobs` now requires `verificationStatus === 'verified'` (403
otherwise); `GET /api/jobs` lists only verified companies' jobs; job detail
404s for unverified postings except owner/admin preview; applications to hidden
jobs are refused; `NewJobPage` shows an explanatory gate. Verified live.

**O2 · No email / phone verification**
Accounts are active the moment they are created. Combined with O1, anyone can
register a company, claim to be any employer, and post jobs. There is no proof
the account owner controls the contact details.

**O3 · File uploads stored with predictable paths and no ownership checks — FIXED (Phase 1)**
`/files` is now an authenticated route: the owning seeker or an admin can
download; everyone else (including other signed-in users) gets the same 404 as
a missing file, and traversal/extension tricks are rejected. Verified live.

**O4 · No audit trail for admin actions — FIXED (Phase 1)**
`audit_logs(actorId, action, targetType, targetId, meta)` with `writeAudit()`
called from company verify/reject/suspend, job delete, verification requests
and job creation. The trail survives actor deletion (`ON DELETE SET NULL`).
Verified live.

**O5 · Rate-limit counters are in-memory and per-process**
Restarting the API resets every counter, and multiple processes do not share
state. The limit is effectively advisory.

---

### P1 — Broken or misleading functionality

**O6 · Social sign-in buttons do nothing real**
Google / GitHub / Facebook render correctly and show a "not connected" notice on
click. There is no OAuth flow, no server exchange, no account linking. A user
could reasonably expect to be signed in.

**O7 · Password reset is a dead button**
"نسيت كلمة المرور؟" has no handler. There is no token generation, no email
delivery, no reset endpoint.

**O8 · Notifications are decorative**
The bell and its unread dot are static. There is no endpoint, no storage, no
mark-as-read.

**O9 · Job funnel metrics are hardcoded**
`CompanyDashboardPage` renders fixed funnel numbers and a fixed bar chart. The
"متوسط التطابق 88%" figure is not derived from any data.

**O10 · Job posting does not use the AI skill extraction**
`analyzeJobDescription()` exists and is tested, but `NewJobPage` sends only raw
strings. The AI-extracted required/preferred skills, experience level and
industry are never written, so the matching engine compares against sparse data.

**O11 · No candidate confirmation channel**
A seeker who is shortlisted has no way to be told, and no in-app place to accept
or decline. The status is visible only if they happen to look.

**O12 · No token refresh / session expiry handling**
JWTs are long-lived with no rotation. A stolen token works until it expires, and
there is no refresh path for a long-lived session.

---

### P2 — Missing features

**O13 · No pagination or search on admin lists**
`GET /api/admin/companies` caps at 200, `/admin/applications` at 100, with no
pagination metadata. Unusable at real scale.

**O14 · No email confirmations at key moments**
No email when a company is verified, rejected, applied to, or shortlisted. The
platform is currently a black box to its users.

**O15 · No public company page**
Companies have a profile but no public-facing route, so a seeker browsing jobs
cannot see who is hiring beyond a name and logo.

**O16 · No salary / location negotiation or filtering**
Search filters cover industry and contract only. Salary range and remote-only
are the two most common job-search constraints and are absent.

**O17 · No candidate rejection reason surfaced to the company**
A company that is rejected sees the note, but there is no in-app notification and
no structured guidance on what to change.

**O18 · No data export or deletion**
Users cannot download or delete their own data (GDPR-style rights).

---

### P3 — Quality / tech debt

**O19 · Tests are not fully hermetic**
MSW intercepts most calls, but some paths still reach the live API during the
frontier test run. Results depend on the database containing seeded rows.

**O20 · Demo fallback data is still reachable**
`demo-api.ts` ships a full set of fake jobs, candidates, and companies. If the
API is unreachable the UI silently renders demo data with no visible
indication, which is dangerous in a hiring context.

**O21 · No error tracking or structured alerting**
Errors go to pino logs only. There is nothing that tells you a 503 spike or a
parsing failure rate increase happened.

**O22 · No CI pipeline**
No automated run of typecheck + tests on push. Regressions land undetected.

**O23 · Uploaded files are never cleaned**
There is no retention policy, no virus scanning, and no size/shape validation
beyond MIME type.

**O24 · No OpenAPI / route documentation**
The API surface grew to ~40 endpoints with no generated documentation.

---

## Part 3 — Fix plan

Ordered by risk reduced per unit of effort. Each phase is independently
shippable.

### Phase 1 — Close the security holes (P0) — ~2 days

| Task | What changes |
|---|---|
| **1.1** Enforce verification on job posting | Add a `requireVerified` guard to `POST /api/jobs`; have `NewJobPage` redirect unverified companies to `/company/profile` with an explanation |
| **1.2** Gate public job listing | `GET /api/jobs` should only return jobs from verified companies, or clearly mark unverified ones |
| **1.3** Protect `/files` | Serve uploads through an authenticated route that checks ownership, not `express.static` |
| **1.4** Add an audit log table | `auditLogs(actorId, action, target, meta)`; write from every admin mutation |
| **1.5** Backfill the seed company as verified | So existing jobs do not vanish from the public board when 1.2 lands |

### Phase 2 — Make the UI honest (P1) — ~3 days

| Task | What changes |
|---|---|
| **2.1** Replace the fake funnel | Compute funnel numbers from `applicationsTable` per company |
| **2.2** Wire `analyzeJobDescription` into job posting | Extract skills/experience/industry on submit and store them |
| **2.3** Surface candidate decisions | Add a notifications store; write on shortlist/reject/verify; render in the bell |
| **2.4** Add real password reset | Token table + endpoint + email; or, if no mail provider yet, a logged admin-initiated reset |
| **2.5** Either implement Google OAuth or hide the buttons | Half-finished auth is worse than none — decide explicitly |

### Phase 3 — Harden the platform (P2/P3) — ~4 days

| Task | What changes |
|---|---|
| **3.1** Paginate admin lists | Cursor or offset + metadata on all admin endpoints |
| **3.2** Make tests hermetic | Point every MSW handler at the real response shapes; fail on unhandled requests |
| **3.3** Replace the demo fallback with a visible error | If the API is down the UI should say so, not show fake jobs |
| **3.4** Add CI | Typecheck + tests on every push |
| **3.5** Document the API | Generated OpenAPI from the route schemas |
| **3.6** Add email notifications | Verification outcome, application received, shortlisted |

---

## Suggested sequencing

```
Phase 1 (security)  ──►  Phase 2 (honest UI)  ──►  Phase 3 (hardening)
     DONE ✅                  ~3 days                   ~4 days
```

Phase 1 completed: O1 (verification enforced on posting, listing, detail and
applications, plus a `NewJobPage` gate), O3 (authenticated `/files` with
ownership checks), O4 (`audit_logs` on every admin mutation), and 1.5 (seed
updated, production rows backfilled — no inconsistencies found). O2 (email
verification) and O5 (persistent rate limits) remain open by design: they need
an email provider and shared state respectively.

Phase 1 first because O1 means the verification work already shipped provides
**no actual protection** — that is the one place where the current code is
worse than it looks.

Phase 2 before Phase 3 because fake metrics and dead buttons undermine trust in
the product, which is the thing the verification workflow is supposed to build.
