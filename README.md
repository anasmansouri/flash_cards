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

## Notes

- Backend storage is in-memory for v1 scaffold.
- `db/schema.sql` still contains the target Postgres schema design.
- Card generation remains server-side and enforces strict no-reveal flow (`/session/next` returns only `cardId` + `text`).
