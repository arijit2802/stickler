---
feature  : CI/CD Pipeline (GitHub Actions)
status   : DONE
created  : 2026-04-06
completed: 2026-04-11
replaces : none
---

# Feature 9 — CI/CD Pipeline (GitHub Actions)

## Goal
Establish a secure, automated CI/CD pipeline using GitHub Actions that validates every pull request and deploys only verified, tested code to production — with specific guardrails for an AI-powered application (secret scanning, dependency auditing, and LLM cost-guard checks).

---

## User Stories

- As a developer, I want every PR automatically linted, type-checked, and tested so that broken code never reaches main.
- As a developer, I want secrets and API keys never committed to the repo — caught automatically before merge.
- As a team, I want dependency vulnerabilities surfaced before they reach production.
- As the operator, I want production deployments to happen only after all checks pass on main, never from a feature branch directly.
- As the operator, I want AI provider API keys rotated/scoped per environment so a leaked dev key can't hit production quotas.

---

## Pipeline Flow

```
On: pull_request → main
  1. Secret scan          (detect committed API keys / tokens)
  2. Dependency audit     (npm audit — fail on high/critical)
  3. Lint                 (ESLint — zero warnings policy)
  4. Type check           (tsc --noEmit)
  5. Unit tests           (Vitest — must pass, coverage ≥ 70%)
  6. Build                (next build — catch build-time errors)
  7. [Optional] E2E smoke (Playwright — core happy paths only)
  → All pass → PR can be merged

On: push → main (after merge)
  1. Build (next build — production mode)
  2. Deploy to Vercel (via Vercel GitHub integration or CLI)
  3. Post-deploy smoke test (3 health check pings to /api/health)
  → Failure → automatic Vercel rollback to previous deployment
```

---

## Data Model

No DB changes. Pipeline is infrastructure-only.

---

## API Routes

No new routes. Existing `GET /api/health` is used as the post-deploy smoke test target.

---

## Workflow Files

### `.github/workflows/ci.yml` — PR validation

Triggers on `pull_request` targeting `main`.

**Jobs (run in parallel where possible):**

| Job | Tool | Fail condition |
|---|---|---|
| `secret-scan` | `trufflesecurity/trufflehog-actions-scan` | Any secret found |
| `audit` | `npm audit --audit-level=high` | High or critical vuln |
| `lint` | `npm run lint` | Any ESLint error |
| `typecheck` | `npx tsc --noEmit` | Any type error |
| `test` | `npm run test -- --coverage` | Failing test or coverage < 70% |
| `build` | `npm run build` | Build failure |

`lint`, `typecheck`, `test`, and `build` all depend on `audit` passing first. `secret-scan` runs independently in parallel.

### `.github/workflows/deploy.yml` — Production deployment

Triggers on `push` to `main` only.

**Jobs (sequential):**
1. `build` — `npm run build`
2. `deploy` — Vercel CLI deploy (`--prod`)
3. `smoke-test` — 3 retried `curl` pings to `https://your-domain.com/api/health`; fail and trigger rollback if any return non-200

---

## Secrets Management

All secrets stored in **GitHub Actions Secrets** (repo → Settings → Secrets and variables → Actions). Never in code or `.env` committed to the repo.

| Secret name | Used in | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | deploy.yml | Vercel CLI authentication |
| `VERCEL_ORG_ID` | deploy.yml | Vercel org targeting |
| `VERCEL_PROJECT_ID` | deploy.yml | Vercel project targeting |
| `DATABASE_URL` | ci.yml (test job) | Test DB connection string |
| `NEXTAUTH_SECRET` | ci.yml (build job) | Required for next build |

**AI provider keys are NOT passed to CI** — unit tests mock all Anthropic/Tavily/OpenAI calls. Only the production Vercel environment holds real AI keys (set directly in Vercel's environment variable settings, not via GitHub Secrets).

---

## AI-Specific Security Controls

These apply specifically because this app calls Anthropic, OpenAI, and Tavily:

### 1. No real AI calls in CI
- All Claude, OpenAI TTS, and Tavily calls must be mockable via environment variable guard
- Pattern: `if (process.env.CI) return mockResponse;` OR use `vitest` mocks — no real SDK calls in test suite
- Failing to mock = real API spend on every PR; unacceptable

### 2. API key scoping per environment
- Dev `.env.local`: separate low-quota API keys (not shared with prod)
- Production Vercel env: separate high-quota keys
- Never the same key in both — a dev leak cannot drain production budget

### 3. Secret scanning covers AI keys
TruffleHog's default ruleset detects:
- `ANTHROPIC_API_KEY` (pattern: `sk-ant-...`)
- `OPENAI_API_KEY` (pattern: `sk-...`)
- Tavily keys (custom pattern if needed)

### 4. Dependency audit scope
`npm audit` flags packages used in AI pipeline (e.g. `openai`, `@tavily/core`, `@anthropic-ai/sdk`) — supply chain attacks on AI SDKs are a real vector.

---

## Branch Protection Rules

Set on `main` via GitHub repo Settings → Branches → Add rule:

- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
  - Required checks: `secret-scan`, `audit`, `lint`, `typecheck`, `test`, `build`
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings (applies to admins too)
- [x] Restrict who can push to matching branches (owner only for MVP)

---

## Edge Cases

| Case | Handling |
|---|---|
| Vitest hits a real AI SDK (no mock) | Test fails with network error in CI — catches the missing mock immediately |
| TruffleHog false positive on test fixture | Add path exclusion in `.trufflehog.yml` config; document the reason |
| `npm audit` flags a transitive dep with no fix | Use `npm audit --omit=dev` to exclude dev deps; add `audit-resolve` comment in PR if unavoidable |
| Vercel deploy succeeds but smoke test fails | Deploy job calls `vercel rollback` via CLI; posts failure summary to PR via GitHub comment |
| Branch protection bypassed by repo admin | "Do not allow bypassing" rule enabled — admins cannot force-push to main |
| E2E tests flaky in CI | Run E2E only on `schedule` (nightly), not on every PR — keeps PR feedback loop fast |

---

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` runs all 6 jobs on every PR targeting `main`
- [ ] A PR with a committed secret (e.g. `sk-ant-test123`) is blocked by `secret-scan`
- [ ] A PR with a failing unit test is blocked from merging
- [ ] A PR with a TypeScript error is blocked from merging
- [ ] `npm audit` with a high-severity vuln blocks the PR
- [ ] `.github/workflows/deploy.yml` triggers only on push to `main`, not on PRs
- [ ] Post-deploy smoke test hits `GET /api/health` and passes (200 response)
- [ ] No real Anthropic / OpenAI / Tavily API calls made during CI test run
- [ ] All required GitHub secrets documented in `CLAUDE.md` (names only, never values)
- [ ] Branch protection rules enforced on `main` — no direct pushes, all checks required
- [ ] AI provider keys are different between dev (`.env.local`) and production (Vercel env)
