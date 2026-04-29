# SpendSense

SpendSense is a production-shaped monorepo for a personal expense tracker.

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

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

## Phase 01 Database Setup

From `apps/api`:

```bash
npm run seed:default-user
```

This prints `DEFAULT_USER_ID` to place in `apps/api/.env` and `apps/web/.env.local`.

## Local Endpoints

- Web app: `http://localhost:3000`
- API health: `http://localhost:10000/health`
