# Recall Cards — German Learning Flash Cards

A full-stack web app for **strict active recall** vocabulary training.

- **Frontend:** React + Vite (`client/`)
- **Primary backend:** Java HTTP API (`backend-java/src/Main.java`)
- **Reference backend:** Node/Express prototype (`src/`)
- **Current product stage:** **v1 prototype / pre-commercial beta**

---

## 1) Current product status (what is implemented now)

This repository already includes a working end-to-end experience for language learners (German as fixed learning language):

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

- In-memory persistence (data resets on backend restart).
- Basic auth storage (not production-grade security/session handling yet).
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

javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main
```

Backend API: `http://localhost:3001`

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

---

## 5) Version roadmap toward commercialization (target: sellable at v5)

## v2 — Reliability foundation

Goal: move from prototype to stable beta.

- Postgres persistence (replace in-memory stores).
- Migration system + schema versioning.
- Safer auth foundation (password hashing, stronger validation).
- Better generation validation + clearer failure handling.
- Expanded API + integration tests.

**Exit criteria for v2:** data survives restarts, core flows stable in staging.

## v3 — Production architecture

Goal: make backend production-capable.

- Async generation workers + queue + retry/backoff.
- Rate limiting + abuse protections.
- Structured logging + monitoring + alerting dashboards.
- Deployment pipeline (staging/prod), health checks, rollback strategy.

**Exit criteria for v3:** reliable operations under moderate real-user traffic.

## v4 — Growth + monetization readiness

Goal: ready for real paid customers.

- Billing integration (plans, subscriptions, webhook reconciliation).
- Entitlement enforcement tied to billing state.
- Compliance/legal package (ToS, Privacy Policy, data export/delete).
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
- `db/schema.sql` remains the reference schema for persistence migration.
