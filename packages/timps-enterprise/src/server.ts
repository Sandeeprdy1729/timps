/**
 * timps-enterprise — Express REST server.
 *
 * Routes:
 *   POST /auth/register     — create user account
 *   POST /auth/login        — get JWT
 *   GET  /team/members      — list team members (auth required)
 *   GET  /team/memory       — get all team memories (auth required)
 *   POST /team/memory       — upsert a memory entry (auth required)
 *   DELETE /team/memory/:key— delete a memory entry (auth required, admin/member)
 *   GET  /team/feed         — episodic feed (auth required)
 *   GET  /billing/plan      — current plan info (auth required)
 *   POST /billing/checkout  — create checkout session (auth required, admin)
 *   POST /billing/webhook   — Stripe webhook (no auth)
 *   GET  /health            — health check (no auth)
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  registerUser, validatePassword, signToken, requireAuth, requireRole,
  listTeamMembers,
  type AuthenticatedRequest,
} from './auth.js';
import {
  upsertMemory, listMemory, deleteMemory, appendEpisode, getTeamFeed,
} from './teamMemory.js';
import { getTeamPlan, createCheckoutSession, handleWebhook, setTeamPlan, PLANS } from './billing.js';

const app = express();

app.use(cors());
app.use(express.json());

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '../public')));
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ── Auth ───────────────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const { email, password, teamId, role } = req.body as {
    email?: string; password?: string; teamId?: string; role?: 'admin' | 'member' | 'viewer';
  };
  if (!email || !password || !teamId) {
    res.status(400).json({ error: 'email, password, teamId are required' });
    return;
  }
  try {
    const user = await registerUser(email, password, teamId, role ?? 'member');
    const token = signToken(user);
    res.status(201).json({ token, userId: user.id, teamId: user.teamId, role: user.role });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const user = await validatePassword(email, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  res.json({ token: signToken(user), userId: user.id, teamId: user.teamId, role: user.role });
});

// ── Team members ───────────────────────────────────────────────────────────

app.get('/team/members', requireAuth, (req: AuthenticatedRequest, res) => {
  const members = listTeamMembers(req.user!.teamId);
  res.json({ members });
});

// ── Team memory ────────────────────────────────────────────────────────────

app.get('/team/memory', requireAuth, (req: AuthenticatedRequest, res) => {
  const tags = req.query.tags ? String(req.query.tags).split(',') : undefined;
  const entries = listMemory(req.user!.teamId, tags);
  res.json({ entries });
});

app.post('/team/memory', requireAuth, (req: AuthenticatedRequest, res) => {
  const { key, value, importance = 0.5, tags = [] } = req.body as {
    key?: string; value?: string; importance?: number; tags?: string[];
  };
  if (!key || !value) {
    res.status(400).json({ error: 'key and value are required' });
    return;
  }
  const entry = {
    key,
    value,
    importance,
    tags,
    createdBy: req.user!.sub,
    teamId: req.user!.teamId,
    updatedAt: new Date().toISOString(),
  };
  upsertMemory(entry);
  appendEpisode({
    id: randomUUID(),
    teamId: req.user!.teamId,
    userId: req.user!.sub,
    action: 'memory.upsert',
    summary: `Upserted memory key "${key}"`,
  });
  res.status(201).json({ entry });
});

app.delete('/team/memory/:key', requireAuth, requireRole('member'), (req: AuthenticatedRequest, res) => {
  const deleted = deleteMemory(req.user!.teamId, req.params['key']);
  if (!deleted) {
    res.status(404).json({ error: 'Memory entry not found' });
    return;
  }
  res.json({ deleted: true });
});

// ── Episodic feed ──────────────────────────────────────────────────────────

app.get('/team/feed', requireAuth, (req: AuthenticatedRequest, res) => {
  const limit = Number(req.query['limit'] ?? 50);
  const feed = getTeamFeed(req.user!.teamId, limit);
  res.json({ feed });
});

// ── Billing ────────────────────────────────────────────────────────────────

app.get('/billing/plan', requireAuth, (req: AuthenticatedRequest, res) => {
  const plan = getTeamPlan(req.user!.teamId);
  res.json({ plan });
});

app.post('/billing/checkout', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  const { planId } = req.body as { planId?: string };
  if (!planId || !PLANS[planId as keyof typeof PLANS]) {
    res.status(400).json({ error: 'Invalid planId. Choose: free, team, enterprise' });
    return;
  }
  const session = await createCheckoutSession(req.user!.teamId, planId as 'free' | 'team' | 'enterprise');
  res.json(session);
});

app.post('/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  handleWebhook(req.body);
  res.json({ received: true });
});

// Convenience: allow admin to set plan directly (dev/test only)
app.post('/billing/set-plan', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { planId } = req.body as { planId?: string };
  if (!planId || !PLANS[planId as keyof typeof PLANS]) {
    res.status(400).json({ error: 'Invalid planId' });
    return;
  }
  setTeamPlan(req.user!.teamId, planId as 'free' | 'team' | 'enterprise');
  res.json({ plan: getTeamPlan(req.user!.teamId) });
});

// ── Health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'timps-enterprise', version: '0.1.0' });
});

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 4000);

export const server = app;

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    console.log(`timps-enterprise listening on port ${PORT}`);
  });
}

export default app;
