# Flash Cards Web App v1

React frontend + **Java backend** implementation focused on learning German with strict active recall.

## Prerequisites

- Java 17+
- Node.js 20+
- npm 10+

## Run backend (Java)

```bash
# optional: enable real ChatGPT generation
export OPENAI_API_KEY=your_openai_api_key
# optional model override (default gpt-4o-mini)
export OPENAI_MODEL=gpt-4o-mini

javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main
```

API: `http://localhost:3001`

## Use your OpenAI API key (quick setup)

1. Generate your key in OpenAI platform and copy it.
2. In your terminal (same shell where you run backend):

```bash
export OPENAI_API_KEY="sk-..."
# optional: choose model (default is gpt-4o-mini)
export OPENAI_MODEL="gpt-4o-mini"
```

3. Start backend:

```bash
javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main
```

4. Add a word from the app. The backend will call OpenAI for:
   - `meaningTarget` (German explanation)
   - `meaningKnown` (explanation in your language)
   - `sentenceTarget` (German sentence adapted to your level)
   - `sentenceKnown` (translation in your language)

5. If the key is missing/invalid, backend falls back to demo generation content.

### Fast verification command

Run this helper script after setting `OPENAI_API_KEY`:

```bash
./scripts/test_openai_generation.sh
```
(also supports loading `OPENAI_API_KEY` from `.env` in repo root)

What you should check in output:
- Script runs a preflight check against `https://api.openai.com/v1/models` (must return HTTP 200).
- `generationSource` should be `openai` in create response, OR
- `GET /api/cards/{id}/generation` returns `{"source":"openai", ...}`
- If fallback happens, read `error` from generation status and backend log `/tmp/java_api.log`.
  - `openai_key_missing` means backend process did not receive your key (export key **before** starting Java server).
- Cards created before key setup may still use old generated content; use `POST /api/cards/{id}/retry` to force regeneration.

## Run frontend

```bash
npm install
npm run dev:client
```

Frontend: `http://localhost:5173`

## Run both

```bash
npm install
npm run dev
```

## Java backend endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `GET /api/profile`
- `PATCH /api/profile` (set your language + German level; target language is always German)
- `GET /api/subscription`
- `PATCH /api/subscription` (`{"plan":"free"|"premium"}`)
- `POST /api/cards`
- `GET /api/cards`
- `DELETE /api/cards/{id}`
- `POST /api/cards/{id}/retry`
- `GET /api/session/next`
- `GET /api/review/summary`
- `POST /api/cards/{id}/known`
- `POST /api/cards/{id}/unknown`
- `GET /api/stats`
- `GET /api/groups`
- `DELETE /api/groups/{groupName}/cards`
- `DELETE /api/groups/{groupName}`

## Notes

- Learning language is fixed to **German (`de`)** across the app.
- Settings/onboarding control your language (`knownLanguage`), German CEFR level (`A1`-`C2`), and plan (`free` vs `premium`).
- Backend storage is in-memory for v1 scaffold.
- `db/schema.sql` still contains the target Postgres schema design.
- Card generation remains server-side and enforces strict no-reveal flow (`/session/next` returns only `cardId` + `text`).
- If `OPENAI_API_KEY` is set, backend generation uses OpenAI Chat Completions; otherwise it falls back to demo generation content.
- Free plan limit: **10 words/day**. Premium plan: **unlimited words/day**.


## Grouping support

- When adding a word, client can choose `groupMode`: `default`, `existing`, or `new`.
- Existing groups are fetched from `GET /api/groups`.
- Review session supports group filtering via `GET /api/session/next?group=All|<groupName>`.
- Library can filter by `group` via `GET /api/cards?...&group=All|<groupName>`.
- Group actions:
  - `DELETE /api/groups/{groupName}/cards` deletes all cards in that group.
  - `DELETE /api/groups/{groupName}` deletes the group label by moving its cards to `Default`.

## Project status now

Current state: **working beta / prototype**, not production-ready yet.

### What is already implemented

- End-to-end user flow is available: signup/login, onboarding/settings, add word, review session, library, stats.
- Strict active-recall contract is implemented (`next` returns only word; reveal appears only after `unknown`).
- Grouping is implemented (create/select groups, group-filtered review and library management).
- German-learning profile model is implemented (fixed German target, user known language + CEFR level).
- OpenAI generation is integrated server-side with diagnostics and a fallback mode when key/model output fails.

### Current technical limitations

- Backend persistence is **in-memory** (data resets on restart).
- Authentication is basic (no password hashing, refresh tokens, robust session management).
- Background jobs/queueing are not implemented (generation is inline in request flow).
- Observability is minimal (limited structured logs, no monitoring/alerting).
- Automated test coverage is still limited for full end-to-end production scenarios.

## Next features needed before commercialization

1. **Production-grade security and auth**
   - Hash passwords (e.g., bcrypt/argon2), secure token lifecycle, session expiry, logout invalidation.
   - Add CSRF/rate-limiting/abuse protections, brute-force protections, and stricter validation.
   - Add secrets management and environment hardening for deployment.

2. **Persistent database + migrations**
   - Replace in-memory stores with Postgres for users/cards/reviews/SRS.
   - Add migration tooling, backups, restore strategy, and integrity checks.

3. **Reliable generation pipeline**
   - Move generation/retry to background workers/queues.
   - Add retry policy with backoff, dead-letter handling, and operator-visible failure reasons.
   - Add quality and language checks that enforce known-language correctness consistently.

4. **Payments and subscription enforcement**
   - Implement billing (plans, free vs paid limits, webhooks, invoice state sync).
   - Enforce daily generation quotas and account entitlements from billing status.

5. **Operational readiness (DevOps/SRE)**
   - Containerize services, add staging/prod deployment pipelines, health checks, and rollbacks.
   - Add monitoring/alerting (API latency, error rate, generation failures, queue depth).
   - Add centralized logging and audit trails.

6. **Compliance and legal readiness**
   - Privacy policy, terms of service, cookie policy, account deletion/export flows.
   - GDPR-ready data handling and consent records (if serving EU users).

7. **Product quality gates**
   - Expand automated tests (API integration, E2E UI, regression and load tests).
   - Accessibility pass (keyboard/screen-reader/contrast), responsive QA, and UX polish.
   - Improve onboarding/help states and reliability under edge cases.

8. **Commercial product analytics**
   - Add event instrumentation for activation, retention, conversion, and churn.
   - Build dashboards for learning outcomes and business KPIs.

