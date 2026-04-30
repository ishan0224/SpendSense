# SpendSense

SpendSense is a production-shaped monorepo for a personal expense tracker with:

- Next.js web app and webhook route on Vercel (`apps/web`)
- Express API on Render (`apps/api`)
- Shared contracts/parser packages (`packages/shared`, `packages/parser`)
- MongoDB Atlas for persistence

## Workspace Layout

- `apps/web`: Next.js dashboard and Vercel route handlers.
- `apps/api`: Express API for CRUD, analytics, imports, settings, and logs.
- `packages/shared`: shared types, constants, and validation contracts.
- `packages/parser`: parser and normalization utilities.

## Prerequisites

- Node.js 20.11+.
- npm 10+.

## Setup

1. Copy `.env.example` to local env files as needed.
2. Use app-specific templates:
   - `apps/api/.env.example` -> `apps/api/.env`
   - `apps/web/.env.example` -> `apps/web/.env.local`
3. Install dependencies:

```bash
npm install
```

## Architecture

- **Webhook first hop:** `POST /api/ingest/sms` in `apps/web` (Vercel)
- **Core API:** `apps/api` on Render for transactions, analytics, imports, settings
- **Database:** MongoDB Atlas

SMS/notification ingestion is intentionally handled by the Vercel route so Render free-tier cold starts do not block transaction capture.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

## Phase 01 Database Setup

From repo root:

```bash
npm run seed:default-user --workspace @spendsense/api
npm run db:sync-indexes --workspace @spendsense/api
```

`seed:default-user` prints `DEFAULT_USER_ID`. Set that value in both:

- `apps/api/.env`
- `apps/web/.env.local`

## Phone Automation Webhook Payload

Endpoint:

```text
POST https://<your-vercel-domain>/api/ingest/sms
```

Headers:

```text
Content-Type: application/json
x-webhook-secret: <plaintext-webhook-secret>
```

Payload example:

```json
{
  "source": "sms",
  "sender": "JD-HDFC-S",
  "message": "Rs. 250 spent on your credit card ending 1234 at SWIGGY. Txn ID 98765.",
  "receivedAt": "2026-04-30T10:15:00.000Z"
}
```

See full Tasker setup: `docs/phoneAutomation.md`.

## Statement Import Demo

1. Open `/import` in web.
2. Upload CSV/XLSX (example: `docs/SampleSpend.xlsx`).
3. Run preview and validate matches/skips.
4. Commit import.
5. Verify imported items in `/transactions` and `/dashboard`.

## Local Endpoints

- Web app: `http://localhost:3000`
- API health: `http://localhost:10000/health`
- SMS webhook: `http://localhost:3000/api/ingest/sms`

## Deployment

### 1. MongoDB Atlas

1. Create cluster, DB user, and network access.
2. Set `MONGODB_URI` in Vercel and Render.
3. Run:

```bash
npm run seed:default-user --workspace @spendsense/api
npm run db:sync-indexes --workspace @spendsense/api
```

### 2. Render (`apps/api`)

- Build command:

```bash
npm install && npx turbo run build --filter=@spendsense/api...
```

- Start command:

```bash
npm run start --workspace @spendsense/api
```

- Required env vars:
  - `NODE_ENV=production`
  - `MONGODB_URI`
  - `DEFAULT_USER_ID`
  - `JWT_SECRET`
  - `CLIENT_URL=https://<your-vercel-domain>`
  - `APP_TIMEZONE=Asia/Kolkata`
  - `DEFAULT_CURRENCY=INR`

### 3. Vercel (`apps/web`)

- Build command:

```bash
npm install && npx turbo run build --filter=@spendsense/web...
```

- Required env vars:
  - `MONGODB_URI`
  - `DEFAULT_USER_ID`
  - `WEBHOOK_SECRET_HASH`
  - `NEXT_PUBLIC_API_BASE_URL=https://<your-render-domain>`
  - `NEXT_PUBLIC_API_TIMEOUT_MS=10000`
  - `NEXT_PUBLIC_API_RETRY_COUNT=2`
  - `NEXT_PUBLIC_API_RETRY_BASE_DELAY_MS=400`
  - `NEXT_PUBLIC_APP_TIMEZONE=Asia/Kolkata`
  - `NEXT_PUBLIC_DEFAULT_CURRENCY=INR`

## Production Smoke Checklist

1. `GET <render>/health` returns `200`.
2. Open Vercel dashboard; summary and charts load.
3. Create/edit/ignore/restore a manual transaction.
4. Send webhook test payload; transaction is created.
5. Re-send same payload; response is `duplicate`.
6. Send OTP-like message; response is `ignored`.
7. Import statement via `/import`; preview and commit match expectations.
8. Let Render sleep, then refresh dashboard; first load recovers without manual retries.
