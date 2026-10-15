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
| 23 | No email verification (O2) | Anyone could claim any employer | `users.emailVerified` + hashed single-use tokens; verification email on register; `/auth/verify-email`, `/auth/resend-verification`; company verification requests refused until the owner's email is confirmed |
| 24 | Rate limits reset on restart (O5) | 429s were advisory | `rate_limits` table, fixed windows shared by every process; in-memory fallback if the DB is down |
| 25 | Password reset was a dead button (O7) | Locked-out users had no path | `/auth/forgot-password` (non-enumerating) + `/auth/reset-password` with 30-min hashed single-use tokens; admin-initiated reset `POST /api/admin/users/:id/password`, audited |
| 26 | Notifications were decorative (O8) | Decisions reached nobody | `notifications` table + routes; written on application status change and company verify/reject/suspend; bell renders real unread count with mark-as-read |
| 27 | Funnel metrics were hardcoded (O9) | Dashboard lied about performance | `GET /api/companies/me/funnel` computed from `applicationsTable`; dashboard and jobs pages use it |
| 28 | Job posting ignored the AI (O10) | Matcher compared against sparse data | `POST /api/jobs` runs `analyzeJobDescription` in the background and links extracted skills (verified: 0 submitted → 5 linked) |
| 29 | Social sign-in faked it (O6) | Half-finished auth | Buttons and component removed until OAuth is actually implemented |
| 30 | Admin lists capped without metadata (O13) | Unusable past a few hundred rows | Offset pagination with totals on `/admin/companies` and `/admin/applications` |
| 31 | Tests were not hermetic (O19) | Results depended on a live DB | MSW `onUnhandledRequest: 'error'` + handlers for every new endpoint; 58/58 green offline |
| 32 | Demo fallback was silent (O20) | Fake jobs rendered invisibly | First fallback dispatches an event; a persistent banner says the data is not real |
| 33 | No CI (O22) | Regressions landed undetected | `.github/workflows/ci.yml`: install, typecheck, frontend tests on every push |

---

## Part 2 — Open problems

### P0 — Security / data integrity

**O1 · Company verification is not enforced — FIXED (Phase 1)**
`POST /api/jobs` now requires `verificationStatus === 'verified'` (403
otherwise); `GET /api/jobs` lists only verified companies' jobs; job detail
404s for unverified postings except owner/admin preview; applications to hidden
jobs are refused; `NewJobPage` shows an explanatory gate. Verified live.

**O2 · No email / phone verification — FIXED (Phase 2/O2)**
Registration now emails a verification link (through the outbox — see O14),
`users.emailVerified` records proof of control, and company verification
requests are refused with a 403 until the owner confirms the address. Tokens
are single-use, hashed at rest, 24h TTL. Phone verification remains open.

**O3 · File uploads stored with predictable paths and no ownership checks — FIXED (Phase 1)**
`/files` is now an authenticated route: the owning seeker or an admin can
download; everyone else (including other signed-in users) gets the same 404 as
a missing file, and traversal/extension tricks are rejected. Verified live.

**O4 · No audit trail for admin actions — FIXED (Phase 1)**
`audit_logs(actorId, action, targetType, targetId, meta)` with `writeAudit()`
called from company verify/reject/suspend, job delete, verification requests
and job creation. The trail survives actor deletion (`ON DELETE SET NULL`).
Verified live.

**O5 · Rate-limit counters are in-memory and per-process — FIXED (Phase 3/O5)**
Counters now live in the `rate_limits` table as fixed windows keyed by limiter
name, client IP and window start — shared by every API process and surviving
restarts. `RATE_LIMIT_STORE=memory` keeps the old behaviour if wanted; a DB
failure falls back to memory rather than failing open. Verified live: 429
returned after the cap, rows visible in the table.

---

### P1 — Broken or misleading functionality

**O6 · Social sign-in buttons do nothing real — FIXED (2.5: hidden)**
No OAuth provider is configured, so the buttons were removed entirely rather
than pretending. `social-auth.tsx` is deleted; tests assert their absence.
Reintroduce them together with a real server-side exchange.

**O7 · Password reset is a dead button — FIXED (2.4)**
`POST /api/auth/forgot-password` (always 200, no account enumeration) issues a
30-minute single-use token, delivered by email through the outbox;
`POST /api/auth/reset-password` consumes it atomically. For locked-out
accounts an admin can run `POST /api/admin/users/:id/password` — audited and
notified. Verified live end-to-end including single-use enforcement.

**O8 · Notifications are decorative — FIXED (2.3)**
`notifications` table with owner-scoped list / mark-read / read-all routes.
Written on every application status change (seeker) and company
verify/reject/suspend (company). The bell fetches the real unread count,
lists items, and marks them read. Verified live.

**O9 · Job funnel metrics are hardcoded — FIXED (2.1)**
`GET /api/companies/me/funnel` computes per-job and total
applied/reviewing/shortlisted/interview/rejected/accepted counts plus the
average match score from `applicationsTable`. The dashboard and jobs pages
render it; the fabricated bar chart is gone.

**O10 · Job posting does not use the AI skill extraction — FIXED (2.2)**
`POST /api/jobs` answers 201 immediately, then `mergeAiSkills()` asks
`analyzeJobDescription` for the implied skills and links any the poster did
not list (case-insensitive dedupe, capped at 10 per list). Verified live:
a job submitted with zero skills came back with React/Node.js/PostgreSQL/
Docker/AWS linked.

**O11 · No candidate confirmation channel — PARTIALLY FIXED**
Seekers now receive an in-app notification and an outbox email on every
decision (shortlist, interview, reject, accept) linking to their applications
page. An accept/decline reply flow is still open.

**O12 · No token refresh / session expiry handling — OPEN**
JWTs are long-lived with no rotation. A stolen token works until it expires,
and there is no refresh path for a long-lived session.

---

### P2 — Missing features

**O13 · No pagination or search on admin lists — FIXED (3.1)**
`GET /api/admin/companies` and `/admin/applications` accept `page` / `limit`
(up to 200) and return `{ items, pagination: { page, limit, total,
totalPages } }`. The frontend normalizes both shapes.

**O14 · No email confirmations at key moments — FIXED (3.6)**
`sendEmail()` routes every message through a provider (`EMAIL_PROVIDER=log`
stores them in `email_outbox` + the structured log — real links a developer
can open; swap in SMTP for production). Emails now go out on: application
received, application decision (shortlist/interview/reject/accept), company
verified / rejected / suspended, password reset, and admin-initiated reset.

**O15 · No public company page**
Companies have a profile but no public-facing route, so a seeker browsing jobs
cannot see who is hiring beyond a name and logo.

**O16 · No salary / location negotiation or filtering**
Search filters cover industry and contract only. Salary range and remote-only
are the two most common job-search constraints and are absent.

**O17 · No candidate rejection reason surfaced to the company — FIXED**
Rejection now also writes an in-app notification (with the reason as the
body) and an outbox email, both linking back to the company profile.

**O18 · No data export or deletion — OPEN**
Users cannot download or delete their own data (GDPR-style rights).

---

### P3 — Quality / tech debt

**O19 · Tests are not fully hermetic — FIXED (3.2)**
MSW now runs with `onUnhandledRequest: 'error'`: any request that escapes the
handlers fails the test instead of quietly hitting the live database. Full
suite (58 tests) passes offline.

**O20 · Demo fallback data is still reachable — FIXED (3.3)**
The demo paths still exist for offline demos, but the first fallback dispatches
a `hime-demo-mode` event and a persistent destructive banner states that the
data shown is not real. Silent fake rendering is gone.

**O21 · No error tracking or structured alerting — OPEN**
Errors go to pino logs only. There is nothing that tells you a 503 spike or a
parsing failure rate increase happened.

**O22 · No CI pipeline — FIXED (3.4)**
`.github/workflows/ci.yml` runs install → typecheck → frontend tests on every
push and pull request to master/main.

**O23 · Uploaded files are never cleaned — OPEN**
There is no retention policy, no virus scanning, and no size/shape validation
beyond MIME type.

**O24 · No OpenAPI / route documentation — FIXED (3.5)**
`artifacts/api-server/openapi.json` documents every endpoint (auth, jobs,
candidates, companies, applications, admin, AI, assess, notifications, files);
served at `GET /api/openapi.json`.

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

### Phase 2 — Make the UI honest (P1) — DONE ✅

| Task | What changes |
|---|---|
| **2.1** Replace the fake funnel | Compute funnel numbers from `applicationsTable` per company ✅ `GET /api/companies/me/funnel` + dashboard/jobs pages rewired |
| **2.2** Wire `analyzeJobDescription` into job posting | Extract skills/experience/industry on submit and store them ✅ background skill merge after 201 |
| **2.3** Surface candidate decisions | Add a notifications store; write on shortlist/reject/verify; render in the bell ✅ |
| **2.4** Add real password reset | Token table + endpoint + email; or, if no mail provider yet, a logged admin-initiated reset ✅ both shipped |
| **2.5** Either implement Google OAuth or hide the buttons | Half-finished auth is worse than none — decide explicitly ✅ hidden (component deleted) |

### Phase 3 — Harden the platform (P2/P3) — DONE ✅

| Task | What changes |
|---|---|
| **3.1** Paginate admin lists | Cursor or offset + metadata on all admin endpoints ✅ offset + totals |
| **3.2** Make tests hermetic | Point every MSW handler at the real response shapes; fail on unhandled requests ✅ `onUnhandledRequest: 'error'` |
| **3.3** Replace the demo fallback with a visible error | If the API is down the UI should say so, not show fake jobs ✅ persistent demo-mode banner |
| **3.4** Add CI | Typecheck + tests on every push ✅ `.github/workflows/ci.yml` |
| **3.5** Document the API | Generated OpenAPI from the route schemas ✅ `openapi.json` served at `/api/openapi.json` |
| **3.6** Add email notifications | Verification outcome, application received, shortlisted ✅ via outbox provider |

---

## Suggested sequencing

```
Phase 1 (security)  ──►  Phase 2 (honest UI)  ──►  Phase 3 (hardening)
       DONE ✅                 DONE ✅                    DONE ✅
```

**Phase 1** closed O1 (verification enforced on posting, listing, detail and
applications, plus a `NewJobPage` gate), O3 (authenticated `/files` with
ownership checks), O4 (`audit_logs` on every admin mutation), and 1.5 (seed
updated, production rows backfilled).

**Phase 2** closed O2 (email verification gating company review), O6 (social
buttons hidden), O7 (password reset + admin reset), O8 (notifications), O9
(real funnel), O10 (AI skill extraction on posting), and the email leg of
O14/O11 (decisions now notify in-app and by email).

**Phase 3** closed O5 (Postgres rate limits), O13 (admin pagination),
O19 (hermetic tests), O20 (visible demo-mode banner), O22 (CI), O24 (OpenAPI
spec), and finished O14 (outbox email provider across every flow).

Still open, deliberately: **O12** (token refresh), **O15** (public company
page), **O16** (salary/remote filtering), **O18** (data export/deletion),
**O21** (error tracking), **O23** (upload retention), phone verification, and
the seeker accept/decline reply flow behind O11. These are features or
observability work, not lies in the current UI — they can be picked up
independently.
