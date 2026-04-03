# Finance Dashboard Backend

Role-based finance backend focused on clean API design, access control, data processing, and dashboard analytics.

## Assignment Fit Summary

This project covers all core assignment requirements:

1. User and role management
2. Financial records CRUD + filters
3. Dashboard summary and trends
4. Backend access control (role + ownership checks)
5. Validation and structured error handling
6. Persistent storage with PostgreSQL + Prisma

It also includes optional enhancements:

1. JWT auth with refresh flow
2. Pagination and sorting
3. Soft delete + restore
4. Redis caching and rate limiting
5. AI-powered query, insights, and anomaly endpoints
6. BullMQ queue for AI fallback processing

## Tech Stack

- Runtime: Node.js + TypeScript
- Framework: Express
- Database: PostgreSQL (Prisma ORM)
- Cache: Redis
- Queue: BullMQ (Redis-backed)
- Auth: JWT (access + refresh)
- Validation: Zod
- AI: Google Gemini (model discovery + fallback)

## Project Structure

- `src/modules/*`: feature modules (auth, users, records, dashboard, ai)
- `src/middleware/*`: auth, role checks, validation, rate limit, error handler
- `src/lib/*`: prisma, redis, gemini, queue helpers
- `prisma/*`: schema and database setup files
- `postman/*`: ready collection/environment for endpoint testing

## Role Permissions

### Viewer

- Can view dashboard summary
- Can view own records
- Cannot create/update/delete records
- Cannot access AI endpoints

### Analyst

- Viewer permissions
- Can create and update own records
- Can access AI endpoints

### Admin

- Full records access (including deleted + restore)
- Can manage users (list, role/status update, soft delete)
- Can access AI endpoints

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

3. Start development server

```bash
npm run dev
```

## Environment Variables

### Required

- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `REDIS_URL`
- `GEMINI_API_KEY`

### Important Optional

- `GEMINI_MODEL` (comma-separated model fallback list)
- `ROLE_SECRET` (required for non-viewer registration)
- `RATE_LIMIT_WINDOW_MS` (default: 900000)
- `RATE_LIMIT_MAX` (default: 100)
- `DASHBOARD_CACHE_TTL` (default: 300)
- `AI_QUERY_CACHE_TTL` (default: 300)
- `AI_INSIGHTS_CACHE_TTL` (default: 600)
- `AI_ANOMALIES_CACHE_TTL` (default: 600)
- `AI_QUEUE_JOB_TIMEOUT_MS` (default: 15000)

### Optional Integration Fields

- `CLOUDINARY_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Scripts

- `npm run dev`: start in development
- `npm run build`: compile TypeScript
- `npm run start`: run compiled build
- `npm run db:studio`: open Prisma Studio

## API Overview

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refreshToken`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/updateProfile`

### Users (Admin)

- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id/role`
- `PATCH /api/users/:id/status`
- `DELETE /api/users/:id`

### Records

- `GET /api/records`
- `POST /api/records`
- `GET /api/records/:id`
- `PATCH /api/records/:id`
- `DELETE /api/records/:id` (soft delete)
- `GET /api/records/deleted` (admin)
- `PATCH /api/records/:id/restore` (admin)
- `GET /api/records/search` (AI search on records module)

### Dashboard

- `GET /api/dashboard/summary`

### AI

- `GET /api/ai/insights?months=3`
- `GET /api/ai/anomalies`
- `POST /api/ai/query`
- `GET /api/ai/search` (normal filter search)
- `GET /api/ai/ai-search` (AI-powered natural language record search)

## Validation and Error Format

Example error shape:

```json
{
  "success": false,
  "error": "Human readable error message"
}
```

Validation errors return HTTP 422 with field-specific messages.

## Notes on AI Behavior

1. Simple Q&A paths are answered directly from DB when possible for speed.
2. Complex Q&A uses BullMQ job processing with Redis.
3. If queue processing fails/timeouts, API falls back to direct Gemini call.
4. AI responses are cached and invalidated on record mutations.

## Rate Limiting

1. The app currently uses a single global limiter applied at app level.
2. Tuning is controlled by `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.
3. Redis-backed limiter storage is used for stable behavior across instances.

## Assumptions and Tradeoffs

1. JWTs are stateless; middleware re-checks current user status/role from DB.
2. Soft delete is used for audit-friendly history.
3. Queue worker runs in same process for simplicity in this assignment scope.
4. No automated test suite included yet; Postman collection is provided for verification.

## How to Verify Quickly

1. Import Postman files from `postman/`.
2. Register/login as Viewer, Analyst, Admin.
3. Validate role restrictions across records/users/ai endpoints.
4. Create records and verify dashboard summaries.
5. Test AI insights, anomalies, query, and ai-search endpoints.

## Submission Checklist

Submit the following:

1. Repository URL (public or shared access)
2. README (this file) with setup and assumptions
3. Postman collection and environment files from `postman/`
4. Prisma schema and DB files from `prisma/`
5. Optional: short demo video or deployed API URL

Recommended short note to include in submission:

1. What optional enhancements you implemented (AI, Redis cache, BullMQ, soft delete, rate limit)
2. What you would improve next (tests, observability, separate worker process, CI)
