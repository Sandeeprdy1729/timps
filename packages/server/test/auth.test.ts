// @timps/server — M71 auth middleware tests
// Exercises requireAuth: token format, expiry, algorithm, signature, missing
// secret (500), and requireUserId IDOR gating.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createHmac } from 'node:crypto';

const dbState = vi.hoisted(() => ({
  available: true,
  query: vi.fn(),
  execute: vi.fn(),
}));
const eventBus = vi.hoisted(() => ({ emit: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
const memoryIndex = vi.hoisted(() => ({
  retrieveContext: vi.fn(),
  storeGoal: vi.fn(),
  storePreference: vi.fn(),
}));
const contradictionExecute = vi.hoisted(() => vi.fn());
const agentRun = vi.hoisted(() => vi.fn());
const agentClear = vi.hoisted(() => vi.fn());
const positionStore = vi.hoisted(() => ({
  getUserPositions: vi.fn(),
  getContradictionHistory: vi.fn(),
}));
const nexusForge = vi.hoisted(() => ({
  episodicIndexer: vi.fn(),
  evolutionOracle: vi.fn(),
  retrievalWeaver: vi.fn(),
}));
const chronosVeil = vi.hoisted(() => ({
  ingestEvent: vi.fn(),
  queryWithVeil: vi.fn(),
  buildVeilContext: vi.fn(),
}));
const synapseMetabolon = vi.hoisted(() => ({
  injectEvent: vi.fn(),
  queryWithSpread: vi.fn(),
  buildMetabolicContext: vi.fn(),
  getStats: vi.fn(),
  getGraph: vi.fn(),
  runConsolidationCycle: vi.fn(),
}));
const chronosForge = vi.hoisted(() => ({
  queryAt: vi.fn(),
  simulateForesight: vi.fn(),
  consolidate: vi.fn(),
}));

vi.mock('../db/postgres', () => ({
  query: dbState.query,
  execute: dbState.execute,
  get dbAvailable() { return dbState.available; },
  initDatabase: vi.fn(),
  pool: {},
}));
vi.mock('../core/agent', () => ({
  Agent: class MockAgent {
    constructor(_config: Record<string, unknown>) {}
    clearConversation() { agentClear(); }
    async run(message: string) { return agentRun(message); }
  },
}));
vi.mock('../core/eventBus', () => ({ eventBus }));
vi.mock('../memory/memoryIndex', () => ({ memoryIndex }));
vi.mock('../tools/contradictionTool', () => ({
  ContradictionTool: class MockContradictionTool {
    execute(args: Record<string, unknown>) { return contradictionExecute(args); }
  },
}));
vi.mock('../tools/positionStore', () => ({ positionStore }));
vi.mock('../core/nexusForge', () => ({ nexusForge }));
vi.mock('../core/chronosVeil', () => ({ chronosVeil }));
vi.mock('../core/synapseMetabolon', () => ({ synapseMetabolon }));
vi.mock('../memory/chronosForge.js', () => ({ chronosForge }));

import routes from '../api/routes';

const SECRET = process.env.TIMPS_JWT_SECRET ?? 'test-secret';

function makeToken(
  userId: number,
  opts: { secret?: string; exp?: number; alg?: string; header?: Record<string, unknown> } = {},
): string {
  const header = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'HS256', typ: 'JWT', ...opts.header })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: opts.exp ?? Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const sig = createHmac('sha256', opts.secret ?? SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function badBase64(part: string): string {
  return Buffer.from(part).toString('base64url');
}

interface AppHandle {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startApp(): Promise<AppHandle> {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

async function call(
  app: AppHandle,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${app.baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

beforeEach(() => {
  dbState.available = true;
  dbState.query.mockReset().mockResolvedValue([]);
  dbState.execute.mockReset().mockResolvedValue(1);
  eventBus.emit.mockReset();
  memoryIndex.retrieveContext.mockReset().mockResolvedValue({ memories: [], goals: [], preferences: [], projects: [] });
});

let app: AppHandle | undefined;
afterEach(async () => {
  if (app) { await app.close(); app = undefined; }
});

describe('M71 — JWT auth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/42');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing or invalid Authorization/);
  });

  it('rejects non-Bearer schemes', async () => {
    app = await startApp();
    const res = await fetch(`${app.baseUrl}/api/memory/42`, {
      headers: { Authorization: `Basic ${makeToken(42)}` },
    });
    expect(res.status).toBe(401);
  });

  it('rejects malformed tokens (wrong part count)', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/42', { token: 'a.b' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid token format/);
  });

  it('rejects tokens whose header/payload are not valid JSON', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/42', { token: `${badBase64('notjson')}.${badBase64('notjson')}.${badBase64('x')}` });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid token/);
  });

  it('rejects expired tokens', async () => {
    app = await startApp();
    const expired = makeToken(42, { exp: Math.floor(Date.now() / 1000) - 60 });
    const res = await call(app, 'GET', '/api/memory/42', { token: expired });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('rejects unsupported algorithms', async () => {
    app = await startApp();
    const hs512 = makeToken(42, { alg: 'HS512' });
    const res = await call(app, 'GET', '/api/memory/42', { token: hs512 });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/algorithm/i);
  });

  it('rejects tokens with a tampered signature', async () => {
    app = await startApp();
    const valid = makeToken(42);
    const parts = valid.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}x`;
    const res = await call(app, 'GET', '/api/memory/42', { token: tampered });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signature/i);
  });

  it('rejects tokens signed with a different secret', async () => {
    app = await startApp();
    const wrong = makeToken(42, { secret: 'other-secret' });
    const res = await call(app, 'GET', '/api/memory/42', { token: wrong });
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and sets the authenticated user', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/42', { token: makeToken(42) });
    expect(res.status).toBe(200);
    expect(memoryIndex.retrieveContext).toHaveBeenCalledWith(42, '', '');
  });

  it('accepts a token without an exp claim', async () => {
    app = await startApp();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 42 })).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
    const res = await call(app, 'GET', '/api/memory/42', { token: `${header}.${payload}.${sig}` });
    expect(res.status).toBe(200);
  });

  it('rejects cross-user access on scoped endpoints (requireUserId)', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/43', { token: makeToken(42) });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/);
  });

  it('rejects non-numeric scoped route params', async () => {
    app = await startApp();
    const res = await call(app, 'GET', '/api/memory/abc', { token: makeToken(42) });
    expect(res.status).toBe(403);
  });
});

describe('M71 — auth with no configured JWT secret', () => {
  it('returns 500 when TIMPS_JWT_SECRET is not set', async () => {
    const previous = process.env.TIMPS_JWT_SECRET;
    delete process.env.TIMPS_JWT_SECRET;
    vi.resetModules();
    const mod = await import('../api/routes');
    const freshRoutes = mod.default;
    const app = express();
    app.use(express.json());
    app.use('/api', freshRoutes);
    const server: Server = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ userId: 42, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString('base64url');
      const sig = createHmac('sha256', 'anything').update(`${header}.${payload}`).digest('base64url');
      const res = await fetch(`${baseUrl}/api/memory/42`, {
        headers: { Authorization: `Bearer ${header}.${payload}.${sig}` },
      });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/Server not configured for auth/);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      if (previous !== undefined) process.env.TIMPS_JWT_SECRET = previous;
      else delete process.env.TIMPS_JWT_SECRET;
    }
  });
});
