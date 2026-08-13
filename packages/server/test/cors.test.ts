// @timps/server — M73 CORS regression tests
// Verifies fail-closed CORS: with no CORS_ORIGINS allowlist, cross-origin
// browser requests get no Access-Control-Allow-Origin header (so a malicious
// page cannot read API/SSE data with credentials), and the SSE endpoint no
// longer hardcodes Access-Control-Allow-Origin: *.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createHmac } from 'node:crypto';

// ─── Mocked dependency graph (routes.ts + server.ts imports) ────────────────
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
vi.mock('../db/vector', () => ({ initVectorStore: vi.fn() }));
vi.mock('../tools/toolsDb', () => ({ initToolsTables: vi.fn() }));
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

import { createApp } from '../api/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.TIMPS_JWT_SECRET ?? 'test-secret';

function signToken(userId: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

interface AppHandle {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startApp(): Promise<AppHandle> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const authed = { token: signToken(42) };

beforeEach(() => {
  delete process.env.CORS_ORIGINS;
  delete process.env.CORS_ORIGIN;
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
});

afterEach(async () => {
  delete process.env.CORS_ORIGINS;
  delete process.env.CORS_ORIGIN;
});

describe('CORS — fail closed by default (no allowlist)', () => {
  it('omits Access-Control-Allow-Origin for a cross-origin request', async () => {
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/health`, {
        headers: { Origin: 'http://evil.example' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('rejects a cross-origin preflight (no allow headers)', async () => {
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/dashboard/stats/1`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://evil.example',
          'Access-Control-Request-Method': 'GET',
        },
      });
      // Browser blocks the cross-origin read because no CORS headers are sent
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.headers.get('access-control-allow-methods')).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('allows same-origin requests (no Origin header)', async () => {
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/health`);
      expect(res.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('SSE endpoint does not hardcode Access-Control-Allow-Origin: *', async () => {
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/events/1`, {
        headers: {
          Authorization: `Bearer ${authed.token}`,
          Origin: 'http://evil.example',
        },
      });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      // Clean up the open SSE stream
      await res.body?.cancel();
    } finally {
      await app.close();
    }
  });
});

describe('CORS — allowlist honored when configured', () => {
  it('reflects an allowlisted origin with credentials', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173,http://app.timps.example';
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/health`, {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    } finally {
      await app.close();
    }
  });

  it('still rejects an origin not in the allowlist', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/health`, {
        headers: { Origin: 'http://evil.example' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('SSE endpoint reflects the allowlisted origin, not *', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const app = await startApp();
    try {
      const res = await fetch(`${app.baseUrl}/api/events/1`, {
        headers: {
          Authorization: `Bearer ${authed.token}`,
          Origin: 'http://localhost:5173',
        },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      await res.body?.cancel();
    } finally {
      await app.close();
    }
  });
});
