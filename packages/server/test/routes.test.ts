// @timps/server — M71 integration tests for the REST API
// Exercises /chat, user-data endpoints (memory/goals/preferences/projects),
// contradiction + positions, dashboard, nexus/chronos/synapse/chrono forge
// routes with the heavy dependency graph (db, agent, forges, tools, eventBus)
// mocked out. Verifies auth gating, input validation, and 503/500 paths.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createHmac } from 'node:crypto';

// ─── Mocked dependency graph (routes.ts imports) ─────────────────────────────
const dbState = vi.hoisted(() => ({
  available: true,
  query: vi.fn(),
  execute: vi.fn(),
}));
const contradictionExecute = vi.hoisted(() => vi.fn());
const agentRun = vi.hoisted(() => vi.fn());
const agentClear = vi.hoisted(() => vi.fn());
const eventBus = vi.hoisted(() => ({
  emit: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
const memoryIndex = vi.hoisted(() => ({
  retrieveContext: vi.fn(),
  storeGoal: vi.fn(),
  storePreference: vi.fn(),
}));
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.TIMPS_JWT_SECRET ?? 'test-secret';

function signToken(
  userId: number,
  opts: { secret?: string; exp?: number; alg?: string; tamper?: boolean } = {},
): string {
  const header = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: opts.exp ?? Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const sig = createHmac('sha256', opts.secret ?? JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  let out = `${header}.${payload}.${sig}`;
  if (opts.tamper) out = `${header}.${payload}.tampered`;
  return out;
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

const authed = { token: signToken(42) };
const otherUser = { token: signToken(7) };

beforeEach(() => {
  dbState.available = true;
  dbState.query.mockReset();
  dbState.execute.mockReset();
  contradictionExecute.mockReset();
  agentRun.mockReset();
  agentClear.mockReset();
  eventBus.emit.mockReset();
  eventBus.subscribe.mockReset();
  eventBus.unsubscribe.mockReset();
  memoryIndex.retrieveContext.mockReset();
  memoryIndex.storeGoal.mockReset();
  memoryIndex.storePreference.mockReset();
  positionStore.getUserPositions.mockReset();
  positionStore.getContradictionHistory.mockReset();
  nexusForge.episodicIndexer.mockReset();
  nexusForge.evolutionOracle.mockReset();
  nexusForge.retrievalWeaver.mockReset();
  chronosVeil.ingestEvent.mockReset();
  chronosVeil.queryWithVeil.mockReset();
  chronosVeil.buildVeilContext.mockReset();
  synapseMetabolon.injectEvent.mockReset();
  synapseMetabolon.queryWithSpread.mockReset();
  synapseMetabolon.buildMetabolicContext.mockReset();
  synapseMetabolon.getStats.mockReset();
  synapseMetabolon.getGraph.mockReset();
  synapseMetabolon.runConsolidationCycle.mockReset();
  chronosForge.queryAt.mockReset();
  chronosForge.simulateForesight.mockReset();
  chronosForge.consolidate.mockReset();

  // Sensible defaults
  dbState.query.mockResolvedValue([]);
  dbState.execute.mockResolvedValue(1);
  contradictionExecute.mockResolvedValue(
    JSON.stringify({ verdict: 'CLEAN', contradiction_score: 0, semantic_similarity: 0 }),
  );
  agentRun.mockResolvedValue({
    content: 'mock reply',
    toolResults: [],
    iterations: 1,
    toolsActivated: ['memory_search'],
    planExecuted: false,
  });
  memoryIndex.retrieveContext.mockResolvedValue({ memories: [], goals: [], preferences: [], projects: [] });
  memoryIndex.storeGoal.mockResolvedValue({ id: 1, title: 'goal', user_id: 42 });
  memoryIndex.storePreference.mockResolvedValue({ id: 1, key: 'theme', value: 'dark' });
  positionStore.getUserPositions.mockResolvedValue([]);
  positionStore.getContradictionHistory.mockResolvedValue([]);
  nexusForge.episodicIndexer.mockResolvedValue('node_abc');
  nexusForge.retrievalWeaver.mockResolvedValue({ results: [], total: 0 });
  chronosVeil.ingestEvent.mockResolvedValue({ eventId: 'evt_1', layer: 'knowledge', entities: ['e'], supersedes: null });
  chronosVeil.queryWithVeil.mockResolvedValue({ results: [], total: 0 });
  chronosVeil.buildVeilContext.mockResolvedValue({ context: [] });
  synapseMetabolon.injectEvent.mockResolvedValue({ nodeId: 'node_1', layer: 'reasoning', entities: [], activation: 0.5 });
  synapseMetabolon.queryWithSpread.mockResolvedValue({ results: [], total: 0 });
  synapseMetabolon.buildMetabolicContext.mockResolvedValue({ context: [] });
  synapseMetabolon.getStats.mockResolvedValue({ total: 0 });
  synapseMetabolon.getGraph.mockResolvedValue({ nodes: [], edges: [] });
  synapseMetabolon.runConsolidationCycle.mockResolvedValue({ consolidated: 0 });
  chronosForge.queryAt.mockResolvedValue({ results: [], total: 0 });
  chronosForge.simulateForesight.mockResolvedValue({ predictions: [] });
  chronosForge.consolidate.mockResolvedValue({ consolidated: 0 });
});

let app: AppHandle | undefined;
afterEach(async () => {
  if (app) { await app.close(); app = undefined; }
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('M71 — REST API integration', () => {
  describe('health', () => {
    it('GET /health returns ok', async () => {
      app = await startApp();
      const res = await call(app, 'GET', '/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /chat', () => {
    it('rejects unauthenticated requests', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/chat', { body: { message: 'hi' } });
      expect(res.status).toBe(401);
    });

    it('returns 400 when message is missing or empty', async () => {
      app = await startApp();
      const noMsg = await call(app, 'POST', '/api/chat', { ...authed, body: {} });
      expect(noMsg.status).toBe(400);
      const empty = await call(app, 'POST', '/api/chat', { ...authed, body: { message: '   ' } });
      expect(empty.status).toBe(400);
    });

    it('returns 503 when DB unavailable', async () => {
      dbState.available = false;
      app = await startApp();
      const res = await call(app, 'POST', '/api/chat', { ...authed, body: { message: 'hi' } });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/Database unavailable/);
    });

    it('runs the agent and emits tool + chat events', async () => {
      agentRun.mockResolvedValue({
        content: 'answer',
        toolResults: [{ tool: 'memory_search', ok: true }],
        iterations: 2,
        toolsActivated: ['memory_search', 'web_search'],
        planExecuted: true,
      });
      app = await startApp();
      const res = await call(app, 'POST', '/api/chat', { ...authed, body: { message: 'hello', username: 'alice' } });
      expect(res.status).toBe(200);
      expect(res.body.response).toBe('answer');
      expect(res.body.toolsActivated).toEqual(['memory_search', 'web_search']);
      expect(res.body.iterations).toBe(2);
      // ensureUser ran before the agent
      expect(dbState.query).toHaveBeenCalledWith('SELECT id FROM users WHERE id = $1', [42]);
      expect(agentRun).toHaveBeenCalledWith('hello');
      const emitCalls = eventBus.emit.mock.calls.map((c) => c[0].type);
      expect(emitCalls).toContain('tool_activated');
      expect(emitCalls).toContain('chat_message');
    });

    it('calls clearConversation when requested', async () => {
      app = await startApp();
      await call(app, 'POST', '/api/chat', { ...authed, body: { message: 'hi', clearConversation: true } });
      expect(agentClear).toHaveBeenCalled();
    });

    it('returns 500 when the agent throws', async () => {
      agentRun.mockRejectedValue(new Error('provider down'));
      app = await startApp();
      const res = await call(app, 'POST', '/api/chat', { ...authed, body: { message: 'hi' } });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('provider down');
    });
  });

  describe('user-data endpoints (memory/goals/preferences/projects/conversations)', () => {
    it('GET /memory/:userId returns context', async () => {
      memoryIndex.retrieveContext.mockResolvedValue({ memories: [{}], goals: [{}], preferences: [{}], projects: [{}] });
      app = await startApp();
      const res = await call(app, 'GET', '/api/memory/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.memories).toHaveLength(1);
      expect(memoryIndex.retrieveContext).toHaveBeenCalledWith(42, '', '');
    });

    it('GET /goals/:userId returns goals', async () => {
      dbState.query.mockResolvedValue([{ id: 1, title: 'ship' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/goals/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.goals).toHaveLength(1);
      expect(dbState.query).toHaveBeenCalledWith(
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY priority DESC, created_at DESC',
        [42],
      );
    });

    it('POST /goals/:userId creates a goal', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/goals/42', { ...authed, body: { title: 'Write tests', priority: 2 } });
      expect(res.status).toBe(200);
      expect(memoryIndex.storeGoal).toHaveBeenCalledWith(42, 'Write tests', undefined, 2, undefined);
    });

    it('POST /goals/:userId rejects missing title', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/goals/42', { ...authed, body: { priority: 1 } });
      expect(res.status).toBe(400);
    });

    it('PUT /goals/:goalId updates status', async () => {
      app = await startApp();
      const res = await call(app, 'PUT', '/api/goals/9', { body: { status: 'done' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(dbState.query).toHaveBeenCalledWith(
        'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['done', 9],
      );
    });

    it('GET /preferences/:userId returns preferences', async () => {
      dbState.query.mockResolvedValue([{ key: 'theme', value: 'dark' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/preferences/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.preferences).toHaveLength(1);
    });

    it('POST /preferences/:userId stores a preference', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/preferences/42', { ...authed, body: { key: 'theme', value: 'dark', category: 'ui' } });
      expect(res.status).toBe(200);
      expect(memoryIndex.storePreference).toHaveBeenCalledWith(42, 'theme', 'dark', 'ui');
    });

    it('POST /preferences/:userId rejects missing key', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/preferences/42', { ...authed, body: { value: 'dark' } });
      expect(res.status).toBe(400);
    });

    it('GET /projects/:userId returns projects', async () => {
      dbState.query.mockResolvedValue([{ name: 'timps' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/projects/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(1);
    });

    it('POST /conversations/:userId creates a conversation', async () => {
      dbState.query.mockResolvedValue([{ id: 5, title: 'New Conversation', user_id: 42 }]);
      app = await startApp();
      const res = await call(app, 'POST', '/api/conversations/42', { ...authed, body: { title: 'Chat' } });
      expect(res.status).toBe(200);
      expect(res.body.conversation.id).toBe(5);
      expect(dbState.query).toHaveBeenCalledWith(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [42, 'Chat'],
      );
    });

    it('scoped endpoints return 403 when auth user differs from route user', async () => {
      app = await startApp();
      const res = await call(app, 'GET', '/api/memory/99', authed);
      expect(res.status).toBe(403);
    });
  });

  describe('contradiction + positions', () => {
    it('POST /contradiction/check returns a CLEAN verdict', async () => {
      contradictionExecute.mockResolvedValue(
        JSON.stringify({ verdict: 'CLEAN', contradiction_score: 0.1, semantic_similarity: 0.2 }),
      );
      app = await startApp();
      const res = await call(app, 'POST', '/api/contradiction/check', { ...authed, body: { text: 'Sky is blue' } });
      expect(res.status).toBe(200);
      expect(res.body.verdict).toBe('CLEAN');
      expect(contradictionExecute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'check', user_id: 42 }));
    });

    it('POST /contradiction/check emits an event on CONTRADICTION', async () => {
      contradictionExecute.mockResolvedValue(
        JSON.stringify({ verdict: 'CONTRADICTION', contradiction_score: 0.9, conflicting_position: { extracted_claim: 'Sky is green' } }),
      );
      app = await startApp();
      const res = await call(app, 'POST', '/api/contradiction/check', { ...authed, body: { text: 'Sky is blue' } });
      expect(res.status).toBe(200);
      const types = eventBus.emit.mock.calls.map((c) => c[0].type);
      expect(types).toContain('contradiction');
    });

    it('POST /contradiction/check rejects missing text', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/contradiction/check', { ...authed, body: {} });
      expect(res.status).toBe(400);
    });

    it('GET /positions/:userId lists positions', async () => {
      positionStore.getUserPositions.mockResolvedValue([{ id: 1, extracted_claim: 'x' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/positions/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('POST /positions/:userId stores a position', async () => {
      contradictionExecute.mockResolvedValue(JSON.stringify({ success: true, position_id: 3 }));
      app = await startApp();
      const res = await call(app, 'POST', '/api/positions/42', { ...authed, body: { text: 'Coffee is good' } });
      expect(res.status).toBe(200);
      expect(contradictionExecute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'store', user_id: 42 }));
    });

    it('DELETE /positions/:userId/:positionId deletes', async () => {
      contradictionExecute.mockResolvedValue(JSON.stringify({ success: true, deleted: 1 }));
      app = await startApp();
      const res = await call(app, 'DELETE', '/api/positions/42/3');
      expect(res.status).toBe(200);
      expect(contradictionExecute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'delete', position_id: 3 }));
    });

    it('GET /contradiction/history/:positionId returns history', async () => {
      positionStore.getContradictionHistory.mockResolvedValue([{ id: 1 }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/contradiction/history/3');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });
  });

  describe('dashboard endpoints', () => {
    it.each([
      ['/api/dashboard/burnout/42', { signals: [], baseline: null, analysis: [] }],
      ['/api/dashboard/commitments/42', { commitments: [], counts: [] }],
      ['/api/dashboard/relationships/42', { relationships: [], total: 0 }],
      ['/api/dashboard/bugs/42', { bugs: [], total: 0 }],
    ] as const)('%s returns 200', async (path, expected) => {
      app = await startApp();
      const res = await call(app, 'GET', path, authed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expected);
    });

    it('GET /dashboard/manifesto/:userId returns manifesto + values', async () => {
      dbState.query
        .mockResolvedValueOnce([{ content: 'my manifesto', updated_at: null }])
        .mockResolvedValueOnce([{ inferred_value: 'honesty', frequency: 3 }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/dashboard/manifesto/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.manifesto).toBe('my manifesto');
      expect(res.body.values).toHaveLength(1);
    });

    it('GET /dashboard/stats/:userId aggregates counts', async () => {
      dbState.query.mockResolvedValue([{ count: '3' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/dashboard/stats/42', authed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        memories: 3, positions: 3, commitments: 3, relationships: 3, bugs: 3, decisions: 3,
      });
    });

    it.each([
      '/api/dashboard/burnout/abc',
      '/api/dashboard/commitments/abc',
      '/api/dashboard/relationships/abc',
      '/api/dashboard/bugs/abc',
      '/api/dashboard/manifesto/abc',
      '/api/dashboard/stats/abc',
    ])('rejects non-numeric userId without leaking a DB error (%s)', async (path) => {
      app = await startApp();
      const res = await call(app, 'GET', path, authed);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/invalid input syntax/);
    });

    it.each([
      '/api/dashboard/burnout/42',
      '/api/dashboard/commitments/42',
      '/api/dashboard/relationships/42',
      '/api/dashboard/bugs/42',
      '/api/dashboard/manifesto/42',
      '/api/dashboard/stats/42',
    ])('returns 503 when DB unavailable (%s)', async (path) => {
      dbState.available = false;
      app = await startApp();
      const res = await call(app, 'GET', path, authed);
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/Database unavailable/);
    });

    it('does not leak raw DB errors to the client', async () => {
      dbState.query.mockRejectedValue(new Error('invalid input syntax for integer: "NaN"'));
      app = await startApp();
      const res = await call(app, 'GET', '/api/dashboard/burnout/42', authed);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(JSON.stringify(res.body)).not.toMatch(/invalid input syntax/);
    });
  });

  describe('nexus endpoints', () => {
    it('POST /nexus/ingest indexes an event', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/nexus/ingest', {
        ...authed,
        body: { content: 'learned X', sourceModule: 'code', tags: ['a'], metadata: { k: 1 } },
      });
      expect(res.status).toBe(200);
      expect(res.body.nodeId).toBe('node_abc');
      expect(nexusForge.episodicIndexer).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42, content: 'learned X' }),
        'code',
      );
    });

    it('POST /nexus/ingest rejects missing sourceModule', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/nexus/ingest', { ...authed, body: { content: 'x' } });
      expect(res.status).toBe(400);
    });

    it('POST /nexus/query returns retrieval results', async () => {
      nexusForge.retrievalWeaver.mockResolvedValue({ results: [{ id: 1 }], total: 1 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/nexus/query', { ...authed, body: { query: 'what about X' } });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('GET /nexus/stats/:userId aggregates node stats', async () => {
      dbState.query
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([{ count: '3' }])
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ source_module: 'code', count: '5' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/nexus/stats/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.totalNodes).toBe(5);
      expect(res.body.totalEdges).toBe(3);
      expect(res.body.sources.code).toBe(5);
    });

    it('GET /nexus/graph/:userId returns nodes + edges', async () => {
      dbState.query
        .mockResolvedValueOnce([{ node_id: 'n1', source_module: 'timps-code', content: 'x' }])
        .mockResolvedValueOnce([{ source_node_id: 'n1', edge_type: 'next' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/nexus/graph/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.nodes[0].isCoding).toBe(true);
      expect(res.body.edges).toHaveLength(1);
    });
  });

  describe('chronos endpoints', () => {
    it('POST /chronos/ingest stores an event and emits', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/chronos/ingest', {
        ...authed,
        body: { content: 'event', sourceModule: 'code' },
      });
      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe('evt_1');
      expect(chronosVeil.ingestEvent).toHaveBeenCalled();
      expect(eventBus.emit.mock.calls.map((c) => c[0].type)).toContain('chronos_event');
    });

    it('POST /chronos/ingest rejects missing content', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/chronos/ingest', { ...authed, body: { sourceModule: 'code' } });
      expect(res.status).toBe(400);
    });

    it('POST /chronos/query returns results', async () => {
      chronosVeil.queryWithVeil.mockResolvedValue({ results: [{ id: 1 }], total: 1 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/chronos/query', { ...authed, body: { query: 'remember X' } });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('GET /chronos/context/:userId builds context', async () => {
      chronosVeil.buildVeilContext.mockResolvedValue({ context: [{ text: 'c' }] });
      app = await startApp();
      const res = await call(app, 'GET', '/api/chronos/context/42?query=hello', authed);
      expect(res.status).toBe(200);
      expect(res.body.context.context).toHaveLength(1);
    });

    it('GET /chronos/context/:userId requires a query param', async () => {
      app = await startApp();
      const res = await call(app, 'GET', '/api/chronos/context/42', authed);
      expect(res.status).toBe(400);
    });

    it('GET /chronos/stats/:userId aggregates', async () => {
      dbState.query
        .mockResolvedValueOnce([{ count: '7' }])
        .mockResolvedValueOnce([{ layer: 'knowledge', count: '4' }])
        .mockResolvedValueOnce([{ event_id: 'e1' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/chronos/stats/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(7);
      expect(res.body.byLayer.knowledge).toBe(4);
    });

    it('GET /chronos/edges/:userId returns edges', async () => {
      dbState.query.mockResolvedValue([{ source_event_id: 'a', target_event_id: 'b' }]);
      app = await startApp();
      const res = await call(app, 'GET', '/api/chronos/edges/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });
  });

  describe('synapse endpoints', () => {
    it('POST /synapse/ingest stores and emits', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/synapse/ingest', {
        ...authed,
        body: { content: 'syn', sourceModule: 'code', confidence: 0.9, outcomeScore: 0.8 },
      });
      expect(res.status).toBe(200);
      expect(res.body.nodeId).toBe('node_1');
      expect(eventBus.emit.mock.calls.map((c) => c[0].type)).toContain('synapse_event');
      expect(synapseMetabolon.injectEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42, confidence: 0.9, outcomeScore: 0.8 }),
        'code',
      );
    });

    it('POST /synapse/query returns results', async () => {
      synapseMetabolon.queryWithSpread.mockResolvedValue({ results: [{ id: 1 }], total: 1 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/synapse/query', { ...authed, body: { query: 'spread' } });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('GET /synapse/context/:userId builds context', async () => {
      synapseMetabolon.buildMetabolicContext.mockResolvedValue({ context: [{ text: 'c' }] });
      app = await startApp();
      const res = await call(app, 'GET', '/api/synapse/context/42?query=q', authed);
      expect(res.status).toBe(200);
      expect(res.body.context.context).toHaveLength(1);
    });

    it('GET /synapse/stats/:userId returns stats', async () => {
      synapseMetabolon.getStats.mockResolvedValue({ total: 12, layers: {} });
      app = await startApp();
      const res = await call(app, 'GET', '/api/synapse/stats/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(12);
    });

    it('GET /synapse/graph/:userId returns graph', async () => {
      synapseMetabolon.getGraph.mockResolvedValue({ nodes: [{}], edges: [{}] });
      app = await startApp();
      const res = await call(app, 'GET', '/api/synapse/graph/42', authed);
      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
    });

    it('POST /synapse/consolidate/:userId runs a cycle', async () => {
      synapseMetabolon.runConsolidationCycle.mockResolvedValue({ consolidated: 4 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/synapse/consolidate/42', { ...authed, body: { projectId: 'p' } });
      expect(res.status).toBe(200);
      expect(res.body.consolidated).toBe(4);
    });
  });

  describe('chrono (ChronosForge) endpoints', () => {
    it('POST /chrono/query queries at a timestamp', async () => {
      chronosForge.queryAt.mockResolvedValue({ results: [{}], total: 1 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/chrono/query', { ...authed, body: { atTime: Date.now() } });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(chronosForge.queryAt).toHaveBeenCalled();
    });

    it('POST /chrono/query requires atTime', async () => {
      app = await startApp();
      const res = await call(app, 'POST', '/api/chrono/query', { ...authed, body: {} });
      expect(res.status).toBe(400);
    });

    it('POST /chrono/foresight simulates', async () => {
      chronosForge.simulateForesight.mockResolvedValue({ predictions: [{}] });
      app = await startApp();
      const res = await call(app, 'POST', '/api/chrono/foresight', { ...authed, body: { domain: 'code' } });
      expect(res.status).toBe(200);
      expect(res.body.predictions).toHaveLength(1);
    });

    it('POST /chrono/consolidate consolidates', async () => {
      chronosForge.consolidate.mockResolvedValue({ consolidated: 2 });
      app = await startApp();
      const res = await call(app, 'POST', '/api/chrono/consolidate', { ...authed, body: { projectId: 'p' } });
      expect(res.status).toBe(200);
      expect(res.body.consolidated).toBe(2);
    });
  });

  describe('DB-unavailable guard (requireDb)', () => {
    it.each([
      ['POST', '/api/goals/42', { title: 'x' }],
      ['PUT', '/api/goals/1', { status: 'done' }],
      ['GET', '/api/preferences/42', undefined],
      ['POST', '/api/preferences/42', { key: 'k', value: 'v' }],
      ['GET', '/api/projects/42', undefined],
      ['POST', '/api/conversations/42', {}],
      ['POST', '/api/contradiction/check', { text: 'x' }],
      ['POST', '/api/positions/42', { text: 'x' }],
      ['DELETE', '/api/positions/42/1', undefined],
      ['GET', '/api/contradiction/history/1', undefined],
      ['GET', '/api/dashboard/burnout/42', undefined],
      ['GET', '/api/dashboard/stats/42', undefined],
      ['POST', '/api/nexus/ingest', { content: 'x', sourceModule: 'code' }],
      ['POST', '/api/nexus/query', { query: 'q' }],
      ['GET', '/api/nexus/stats/42', undefined],
      ['GET', '/api/nexus/graph/42', undefined],
      ['POST', '/api/chronos/ingest', { content: 'x', sourceModule: 'code' }],
      ['POST', '/api/chronos/query', { query: 'q' }],
      ['GET', '/api/chronos/context/42?query=q', undefined],
      ['GET', '/api/chronos/stats/42', undefined],
      ['GET', '/api/chronos/edges/42', undefined],
      ['POST', '/api/synapse/ingest', { content: 'x', sourceModule: 'code' }],
      ['POST', '/api/synapse/query', { query: 'q' }],
      ['GET', '/api/synapse/context/42?query=q', undefined],
      ['GET', '/api/synapse/stats/42', undefined],
      ['GET', '/api/synapse/graph/42', undefined],
      ['POST', '/api/synapse/consolidate/42', {}],
      ['POST', '/api/chrono/query', { atTime: 123 }],
      ['POST', '/api/chrono/foresight', { domain: 'code' }],
      ['POST', '/api/chrono/consolidate', {}],
    ] as [string, string, unknown][])('returns 503 on %s %s when DB is down', async (m, p, body) => {
      dbState.available = false;
      app = await startApp();
      const res = await call(app, m as any, p, body !== undefined ? { ...authed, body } : authed);
      expect(res.status, `${m} ${p}`).toBe(503);
      expect(res.body.error, `${m} ${p}`).toMatch(/Database unavailable/);
    });
  });

  describe('route gating + IDOR', () => {
    it('requires auth on data endpoints', async () => {
      app = await startApp();
      for (const [m, p, body] of [
        ['GET', '/api/memory/42', undefined],
        ['GET', '/api/goals/42', undefined],
        ['POST', '/api/goals/42', { title: 'x' }],
        ['GET', '/api/preferences/42', undefined],
        ['POST', '/api/preferences/42', { key: 'k', value: 'v' }],
        ['GET', '/api/projects/42', undefined],
        ['POST', '/api/conversations/42', {}],
        ['POST', '/api/contradiction/check', { text: 'x' }],
        ['GET', '/api/positions/42', undefined],
        ['POST', '/api/positions/42', { text: 'x' }],
        ['GET', '/api/dashboard/stats/42', undefined],
        ['GET', '/api/nexus/stats/42', undefined],
        ['GET', '/api/chronos/context/42?query=q', undefined],
        ['GET', '/api/synapse/graph/42', undefined],
        ['POST', '/api/chrono/query', { atTime: 123 }],
      ] as [string, string, unknown][]) {
        const res = await call(app, m as any, p, body !== undefined ? { body } : {});
        expect(res.status, `${m} ${p}`).toBe(401);
      }
    });

    it('rejects cross-user access on scoped endpoints (IDOR)', async () => {
      app = await startApp();
      const paths = [
        'GET /api/memory/7',
        'GET /api/goals/7',
        'GET /api/preferences/7',
        'GET /api/projects/7',
        'GET /api/positions/7',
        'GET /api/dashboard/stats/7',
        'GET /api/nexus/stats/7',
        'GET /api/nexus/graph/7',
        'GET /api/chronos/stats/7',
        'GET /api/chronos/edges/7',
        'GET /api/synapse/stats/7',
        'GET /api/synapse/graph/7',
      ];
      for (const entry of paths) {
        const [m, p] = entry.split(' ');
        const res = await call(app, m as any, p, { token: signToken(42) });
        expect(res.status, entry).toBe(403);
      }
    });

    it('returns 404 for unknown routes', async () => {
      app = await startApp();
      const res = await call(app, 'GET', '/api/nope', authed);
      expect(res.status).toBe(404);
    });
  });
});
