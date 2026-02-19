# Flash Cards Web App v1

React frontend + **Java backend** implementation of strict active-recall language cards.

## Prerequisites

- Java 17+
- Node.js 20+
- npm 10+

## Run backend (Java)

```bash
javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main
```

API: `http://localhost:3001`

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
- `PATCH /api/profile`
- `POST /api/cards`
- `GET /api/cards`
- `DELETE /api/cards/{id}`
- `POST /api/cards/{id}/retry`
- `GET /api/session/next`
- `POST /api/cards/{id}/known`
- `POST /api/cards/{id}/unknown`
- `GET /api/stats`
- `GET /api/groups`

## Notes

- Backend storage is in-memory for v1 scaffold.
- `db/schema.sql` still contains the target Postgres schema design.
- Card generation remains server-side and enforces strict no-reveal flow (`/session/next` returns only `cardId` + `text`).


## Grouping support

- When adding a word, client can choose `groupMode`: `default`, `existing`, or `new`.
- Existing groups are fetched from `GET /api/groups`.
- Review session supports group filtering via `GET /api/session/next?group=All|<groupName>`.

## What to implement next (recommended roadmap)

1. **Library group filter + sorting**
   - Add a group dropdown in Library (like Review) so users can browse cards by group.
   - Add sort options (`newest`, `oldest`, `due first`, `status`).

2. **Status clarity in Library**
   - Add a small status legend/help text for `ready`, `generating`, and `failed`.
   - `ready` means the generated content is complete and the card can appear in review sessions when due.

3. **Persistent database (Postgres)**
   - Replace in-memory stores with Postgres using the schema in `db/schema.sql`.
   - Add migrations and startup checks.

4. **Background generation jobs**
   - Move generation/retry work to a background worker queue.
   - Add retry backoff and better failure diagnostics in `quality_flags`.

5. **Auth hardening**
   - Password hashing, refresh tokens/session expiry, and basic rate limits for auth + add-card endpoints.

6. **Review analytics**
   - Add a dedicated history endpoint and charts for 7/30-day known vs unknown trends.
   - Add per-group performance insights.

7. **Polish + accessibility**
   - Empty states, loading skeletons, better form validation messages, keyboard navigation, and contrast checks.
