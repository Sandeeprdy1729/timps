# TIMPS Enterprise

Enterprise team memory server for TIMPS — adds shared memory, multi-user access, JWT auth, and billing.

## Features

- **Shared semantic memory** — team-wide key/value memory store with tags and importance scores
- **Episodic feed** — shared activity log of all memory and agent actions
- **JWT authentication** — secure login with role-based access (admin/member/viewer)
- **Billing stubs** — Stripe checkout integration ready to wire in
- **Admin panel** — web dashboard at `/admin`

## Setup

```bash
cd packages/timps-enterprise

# Install deps
npm install

# Run in dev mode
npm run dev
```

Server starts on port 4000 (or `PORT` env var).

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `TIMPS_JWT_SECRET` | `timps-dev-secret-change-in-prod` | JWT signing key — **change in production** |
| `TIMPS_JWT_EXPIRY` | `7d` | Token expiry duration |
| `STRIPE_SECRET_KEY` | — | Stripe secret key (billing) |

## REST API

All `/team/*` and `/billing/*` routes require `Authorization: Bearer <token>`.

### Auth

```
POST /auth/register  { email, password, teamId, role? }
POST /auth/login     { email, password }
```

### Team memory

```
GET    /team/memory         ?tags=comma,separated
POST   /team/memory         { key, value, importance?, tags? }
DELETE /team/memory/:key
```

### Episodic feed

```
GET /team/feed   ?limit=50
```

### Members

```
GET /team/members
```

### Billing

```
GET  /billing/plan
POST /billing/checkout  { planId }  (admin only)
POST /billing/webhook               (Stripe webhook)
```

## Admin panel

Open `http://localhost:4000/admin` in your browser.

## Plans

| Plan | Price | Members | Memory Entries |
| --- | --- | --- | --- |
| Free | $0/mo | 1 | 1,000 |
| Team | $29/mo | 10 | 50,000 |
| Enterprise | Contact sales | Unlimited | Unlimited |

## Security notes

- Always set `TIMPS_JWT_SECRET` to a strong random value in production
- The in-memory store does not persist across restarts — replace with PostgreSQL for production
- Stripe webhook handling requires signature verification in production (use `stripe.webhooks.constructEvent`)
