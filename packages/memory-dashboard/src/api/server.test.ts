// @timps/memory-dashboard — M66 security tests
// Asserts the M66 behavior: localhost-only CORS, bearer-token auth, and a
// project allowlist that blocks reading arbitrary ~/.timps/memory directories.

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './server';

let tmp: string;
let allowedProject: string;
let memoryRoot: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm66-dash-'));
  allowedProject = path.join(tmp, 'allowed-project');
  fs.mkdirSync(path.join(allowedProject, '.timps', 'memory'), { recursive: true });
  // memoryRoot simulates ~/.timps/memory/<hash>
  memoryRoot = path.join(allowedProject, '.timps', 'memory');
  const root = memoryRoot;
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'semantic.json'),
    JSON.stringify([{ id: 'mem_1', timestamp: Date.now(), type: 'fact', content: 'SECRET_CREDENTIAL', tags: [] }]),
  );
  fs.writeFileSync(path.join(root, 'working.json'), JSON.stringify({ activeFiles: [] }));
  fs.writeFileSync(path.join(root, 'episodes.json'), JSON.stringify([]));
});

afterAll(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
});

// Start an app on an ephemeral port. The memoryRoot fixture is injected so the
// loader finds the seeded semantic.json without touching the real ~/.timps.
async function startApp(opts: Parameters<typeof createApp>[0] = {}) {
  const app = createApp({ projectPath: allowedProject, memoryRoot: () => memoryRoot, ...opts });
  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as { port: number }).port;
  return {
    port,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

describe('M66 — memory dashboard API security', () => {
  it('blocks cross-origin reads (no Access-Control-Allow-Origin for foreign origins)', async () => {
    const { port, close } = await startApp();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/memory`, {
        headers: { Origin: 'https://evil.example.com' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await close();
    }
  });

  it('allows localhost origins through CORS', async () => {
    const { port, close } = await startApp();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/memory`, {
        headers: { Origin: 'http://localhost:5175' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5175');
    } finally {
      await close();
    }
  });

  it('requires a bearer token when a token is configured', async () => {
    const { port, close } = await startApp({ token: 's3cret' });
    try {
      const noAuth = await fetch(`http://127.0.0.1:${port}/api/memory`);
      expect(noAuth.status).toBe(401);
      const badAuth = await fetch(`http://127.0.0.1:${port}/api/memory`, {
        headers: { Authorization: 'Bearer wrong' },
      });
      expect(badAuth.status).toBe(401);
      const goodAuth = await fetch(`http://127.0.0.1:${port}/api/memory`, {
        headers: { Authorization: 'Bearer s3cret' },
      });
      expect(goodAuth.status).toBe(200);
      const headerAuth = await fetch(`http://127.0.0.1:${port}/api/memory`, {
        headers: { 'X-TIMPS-DASH-TOKEN': 's3cret' },
      });
      expect(headerAuth.status).toBe(200);
    } finally {
      await close();
    }
  });

  it('rejects ?project= outside the configured allowlist', async () => {
    const { port, close } = await startApp();
    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/memory?project=${encodeURIComponent('/some/other/project')}`,
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('project not allowed');
    } finally {
      await close();
    }
  });

  it('serves memory for the default project when no ?project= is passed', async () => {
    const { port, close } = await startApp();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/memory`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.semantic[0].content).toBe('SECRET_CREDENTIAL');
    } finally {
      await close();
    }
  });

  it('honors explicitly allowlisted projects', async () => {
    const second = path.join(tmp, 'second-project');
    fs.mkdirSync(path.join(second, '.timps', 'memory'), { recursive: true });
    fs.writeFileSync(path.join(second, '.timps', 'memory', 'semantic.json'), JSON.stringify([{ id: 'mem_2', timestamp: Date.now(), type: 'fact', content: 'SECOND_PROJECT_MEMORY', tags: [] }]));
    fs.writeFileSync(path.join(second, '.timps', 'memory', 'working.json'), JSON.stringify({ activeFiles: [] }));
    fs.writeFileSync(path.join(second, '.timps', 'memory', 'episodes.json'), JSON.stringify([]));
    const { port, close } = await startApp({
      allowedProjects: [second],
      memoryRoot: (p) => path.join(p, '.timps', 'memory'),
    });
    try {
      const ok = await fetch(
        `http://127.0.0.1:${port}/api/memory?project=${encodeURIComponent(second)}`,
      );
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.semantic[0].content).toBe('SECOND_PROJECT_MEMORY');
    } finally {
      await close();
    }
  });
});
