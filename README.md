# Flash Cards Web App v1

React + Express implementation of strict active-recall language cards.

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run (frontend + backend)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Run backend only

```bash
npm run dev:server
```

## Run frontend only

```bash
npm run dev:client
```

## Test

```bash
npm test
```

## How to use the app (end-user flow)

1. Open `http://localhost:5173`.
2. Create an account (Sign up) or log in.
3. On first login, complete **Onboarding**:
   - pick known language
   - pick target language (must be different)
   - pick CEFR level (A1–C1)
4. Open **Add** and submit a word/phrase (max 80 chars).
5. Open **Review**:
   - You see only the card text.
   - Click **Known** to move forward immediately (no reveal).
   - Click **Unknown** to reveal meaning + sentence fields, then click **Next**.
6. Open **Library** to search/filter cards and retry failed generation.
7. Open **Stats** for totals and daily review metrics.
8. Open **Settings** to update profile (known/target must differ).

## How to use the API directly (quick curl example)

### 1) Sign up

```bash
curl -s -X POST http://localhost:3001/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"secret123"}'
```

Copy `token` from the response.

### 2) Save profile

```bash
curl -s -X PATCH http://localhost:3001/api/profile \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"knownLanguage":"en","targetLanguage":"de","level":"A2"}'
```

### 3) Add a card

```bash
curl -s -X POST http://localhost:3001/api/cards \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"text":"aufgeben"}'
```

### 4) Fetch next review card (no reveal)

```bash
curl -s http://localhost:3001/api/session/next \
  -H "Authorization: Bearer <TOKEN>"
```

### 5) Unknown (reveals meanings/sentence)

```bash
curl -s -X POST http://localhost:3001/api/cards/<CARD_ID>/unknown \
  -H "Authorization: Bearer <TOKEN>"
```

### 6) Known (no reveal)

```bash
curl -s -X POST http://localhost:3001/api/cards/<CARD_ID>/known \
  -H "Authorization: Bearer <TOKEN>"
```

## Implemented

- Auth endpoints: signup/login/forgot password
- Onboarding + settings with `knownLanguage !== targetLanguage` enforced in UI and API
- Cards CRUD, retry generation, and status handling
- Strict review flow:
  - `/api/session/next` returns only `cardId` + `text`
  - reveal payload is returned only by `/api/cards/:id/unknown`
- SRS scheduling for known/unknown
- Stats endpoint and React screens (dashboard, add, review, library, stats)
- SQL schema in `db/schema.sql` with table/check constraints

## Notes

- LLM generation is mocked in `src/generation.js` but keeps the full validation contract and retries.
- Persistence is in-memory for this v1 scaffold.
