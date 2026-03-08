# Recall Cards — German Learning Flash Cards

A full-stack web app for **strict active recall** vocabulary training.

- **Frontend:** React + Vite (`client/`)
- **Primary backend:** Java HTTP API (`backend-java/src/Main.java`)
- **Reference backend:** Node/Express prototype (`src/`)
- **Current product stage:** **v2 beta foundation (in progress)**

---

## 1) Current product status (what is implemented now)

This repository already includes a working end-to-end experience for language learners (German as fixed learning language):


### v2 upgrades implemented in this version

- Safer auth foundation:
  - password hashing via PBKDF2 (new signups)
  - stronger signup validation (email format + stronger password rule)
  - backward-compatible login verification for legacy plain-password records
- Postgres-backed persistence with startup DB validation and schema migrations.
- Generation validation tightened:
  - strict key set check for generated payload (no missing/extra keys)
  - sentence sanity guard for one-sentence target output

### Core learning flow (implemented)

- Strict recall review loop:
  - `GET /api/session/next` returns only card id + word/phrase.
  - Reveal content appears only after `POST /api/cards/{id}/unknown`.
- Learning reveal includes:
  - German meaning/explanation (`meaningTarget`)
  - Known-language explanation (`meaningKnown`)
  - German example sentence (`sentenceTarget`)
  - Known-language translation (`sentenceKnown`)
- SRS scheduling for known/unknown outcomes.

### User/account/profile (implemented)

- Auth endpoints: signup/login/forgot-password.
- Profile onboarding + settings:
  - Known language selection
  - German CEFR level (`A1`–`C2`)
  - Fixed learning language = German (`de`)
- Subscription plan state in backend:
  - `free` or `premium`
  - free: 10 words/day
  - premium: unlimited words/day

### Cards and grouping (implemented)

- Add card with generation pipeline.
- Grouping model:
  - default/existing/new group modes on add
  - list groups
  - review by selected group
  - library filtering by group
  - delete one card, delete group cards, or delete group (move to default)

### Generation pipeline (implemented)

- Server-side OpenAI generation integration (Java backend).
- Demo fallback if key/response fails.
- Retry generation endpoint.
- Generation diagnostics endpoints/fields (source/model/error).

### Frontend UX (implemented)

- Full screen set:
  - Auth, Onboarding, Dashboard, Add, Review, Library, Stats, Settings
- Creative review reveal with deep-focus overlay card.
- Responsive UI styling for desktop/mobile.

### What is still prototype-level

- Persistence is Postgres-only; additional production hardening is still required (indexes, backup/restore drills, connection pool strategy).
- Auth is improved (hashed passwords) but still not full production security/session architecture yet.
- No queue-based async generation workers.
- Limited observability (metrics/tracing/alerts).
- Test coverage is partial; not yet production confidence level.

---

## 2) Run locally

## Prerequisites

- Java 17+
- Node.js 20+
- npm 10+

### Run backend (Java)

```bash
# Optional OpenAI config
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4o-mini"

# Required Postgres persistence (v2)
# Example: export JDBC_DATABASE_URL="jdbc:postgresql://localhost:5432/recall_cards"
# Optional when auth is required by DB:
# export JDBC_DATABASE_USER="postgres"
# export JDBC_DATABASE_PASSWORD="postgres"

javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main
```

Backend API: `http://localhost:3001`

Persistence mode:
- `JDBC_DATABASE_URL` is required.
- On startup, backend validates DB connectivity and runs migrations from `db/migrations`.
- Runtime persistence and reload use Postgres as the single source of truth.

### Run frontend

```bash
npm install
npm run dev:client
```

Frontend: `http://localhost:5173`

### Run both

```bash
npm install
npm run dev
```

### Basic check

```bash
npm test
```

---

## 3) OpenAI generation quick verification

After exporting your key, run:

```bash
./scripts/test_openai_generation.sh
```

Expected:
- OpenAI preflight returns HTTP 200.
- Generation source reports `openai`.
- If fallback occurs, check returned `error` and `/tmp/java_api.log`.

---

## 4) API surface (Java backend)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `GET /api/health`

### Profile + plan
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/subscription`
- `PATCH /api/subscription` with `{"plan":"free"|"premium"}`

### Cards / review
- `POST /api/cards`
- `GET /api/cards`
- `DELETE /api/cards/{id}`
- `POST /api/cards/{id}/retry`
- `GET /api/cards/{id}/generation`
- `GET /api/session/next`
- `POST /api/cards/{id}/known`
- `POST /api/cards/{id}/unknown`

### Groups / stats
- `GET /api/groups`
- `DELETE /api/groups/{groupName}/cards`
- `DELETE /api/groups/{groupName}`
- `GET /api/review/summary`
- `GET /api/stats`
- `POST /api/events`
- `GET /api/events`
- `GET /api/account/export`
- `DELETE /api/account`

---

## 5) Version roadmap toward commercialization (target: sellable at v5)

## v2 — Reliability foundation

Goal: move from prototype to stable beta.

✅ Implemented now:
- Safer auth foundation (password hashing + stronger validation).
- Better generation validation baseline.
- Restart persistence with two modes:
  - Postgres persistence as the required source of truth
- Startup migration runner with schema version tracking (`schema_migrations`) and SQL files in `db/migrations`.
- New operational/security foundations: health endpoint, auth attempt rate limiting, secure response headers, basic event ingestion, and account export/delete APIs.

⏳ Still required to close full v2:
- Production-grade DB hardening (indexes, backup/restore drill, connection pool strategy).
- Expanded API + integration tests.

**Exit criteria for v2:** Postgres-backed data survives restarts with migration/backups tested and core flows stable in staging.

## v3 — Production architecture

Goal: make backend production-capable.

✅ Foundations implemented now:
- Health endpoint (`/api/health`) and basic operational telemetry hooks (`/api/events`).
- Auth attempt rate limiting baseline and safer response security headers.

⏳ Still required to close full v3:
- Async generation workers + queue + retry/backoff.
- Structured logging + monitoring + alerting dashboards.
- Deployment pipeline (staging/prod), health checks, rollback strategy.

**Exit criteria for v3:** reliable operations under moderate real-user traffic.

## v4 — Growth + monetization readiness

Goal: ready for real paid customers.

- Billing integration (plans, subscriptions, webhook reconciliation).
- Entitlement enforcement tied to billing state.
- Compliance/legal package (ToS, Privacy Policy, data export/delete).
  - Note: API foundations for export/delete are implemented; legal/policy and full workflows remain.
- Product analytics instrumentation (activation, retention, churn, conversion).
- Accessibility and UX quality pass.

**Exit criteria for v4:** real payment loop works and legal/compliance basics are in place.

## v5 — Commercial launch version (sellable)

Goal: launch and sell confidently.

- Security hardening + external security review.
- SLO/SLA definition and operational playbooks.
- Full regression + load testing gates in CI/CD.
- Customer support workflows (error reporting, admin tooling, incident handling).
- Final onboarding refinement and conversion optimization.

**Exit criteria for v5:**
- secure,
- observable,
- compliant,
- monetized,
- and operationally supportable for paying users.

---

## 6) Notes

- Learning language is fixed to German (`de`) in current product direction.
- Free plan daily generation limit is enforced in backend.
- Premium plan removes daily card creation limit.
- `db/schema.sql` remains the Postgres reference schema for migration hardening and production rollout checks.
