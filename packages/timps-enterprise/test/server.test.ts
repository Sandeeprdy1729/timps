import { server } from '../src/server.js';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

const PORT = 4001; // different port to avoid conflict with dev server
let baseUrl: string;

// Start the server
const httpServer = server.listen(PORT, () => {
  baseUrl = `http://localhost:${PORT}`;
  runTests();
});

async function runTests() {
  console.log('\nserver tests:');

  await test('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'timps-enterprise');
  });

  await test('POST /auth/register rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  await test('POST /auth/register rejects self-assigned admin', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin-wannabe@test.com',
        password: 'pass123',
        teamId: 'team-x',
        role: 'admin',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test('POST /auth/register creates user and returns JWT', async () => {
    const email = `newuser-${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'pass123', teamId: 'team-x' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json() as any;
    assert.ok(body.token);
    assert.ok(body.userId);
  });

  await test('POST /auth/login returns token for valid credentials', async () => {
    const email = `logintest-${Date.now()}@test.com`;
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'pass123', teamId: 'team-login' }),
    });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'pass123' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.token);
  });

  await test('POST /auth/login rejects wrong password', async () => {
    const email = `wrongpw-${Date.now()}@test.com`;
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'pass123', teamId: 'team-wp' }),
    });
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong' }),
    });
    assert.strictEqual(res.status, 401);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  httpServer.close();
  process.exit(failed > 0 ? 1 : 0);
}
