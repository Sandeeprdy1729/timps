// ── @timps/memory-core — REST route tests ──
// Drives the real Express router over a loopback socket. Temp dirs only.

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryEngine } from '../MemoryEngine.js';
import { createMemoryRoutes } from './routes.js';

let server: http.Server;
let base: string;
let engine: MemoryEngine;

beforeEach(async () => {
  engine = new MemoryEngine(fs.mkdtempSync(path.join(os.tmpdir(), 'routes-test-')));
  const app = express();
  app.use(express.json());
  app.use('/', createMemoryRoutes(engine));
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const post = (route: string, body: unknown) =>
  fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('memory REST routes', () => {
  it('POST /context returns the context string, not a serialized Promise', async () => {
    engine.store({ content: 'The billing service is written in Go', type: 'fact', tags: [] });
    const res = await post('/context', { task: 'billing' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.context).toBe('string');
    expect(body.context).toContain('billing service');
  });

  it('POST /store then POST /recall round-trips a memory', async () => {
    const stored = await post('/store', { content: 'Payments use Stripe webhooks with idempotency keys', type: 'fact' });
    expect(stored.status).toBe(200);
    const res = await post('/recall', { query: 'Stripe webhooks', limit: 5 });
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.results[0].content).toContain('Stripe');
  });

  it('POST /recall requires a query', async () => {
    expect((await post('/recall', {})).status).toBe(400);
  });
});
