# @timps/enterprise — Team Memory Server

[!WARNING]
> **Status: Experimental — not production-ready.**
> - All data is stored **in-memory** — everything resets on restart (no database)
> - Stripe billing is a **stub** — `console.warn` only, no real charges
> - Depends on `@timps-ai/memory-core` but never uses it

Multi-user team memory server with JWT auth, role-based access, shared memory store, episodic feed, and billing stubs.

```bash
cd packages/timps-enterprise
npm install
npm run dev   # port 4000
```

## API

`POST /auth/register`, `POST /auth/login`, `GET /team/memory`, `POST /team/memory`, `DELETE /team/memory/:key`, `GET /team/feed`, `GET /team/members`, `GET /billing/plan`, `POST /billing/checkout`

## Env

`PORT` (4000), `TIMPS_JWT_SECRET`, `TIMPS_JWT_EXPIRY` (7d), `STRIPE_SECRET_KEY`

## Plans (stub)

Free ($0, 1 member, 1K entries), Team ($29, 10 members, 50K), Enterprise (contact)
