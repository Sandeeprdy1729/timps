import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../src/server.js';

const PORT = 4001;
let baseUrl: string;
let httpServer: ReturnType<typeof server.listen>;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    httpServer = server.listen(PORT, () => {
      baseUrl = `http://localhost:${PORT}`;
      resolve();
    });
  });
});

afterAll(() => {
  httpServer?.close();
});

describe('server', () => {
  it('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('timps-enterprise');
  });

  it('POST /auth/register rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register rejects self-assigned admin', async () => {
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
    expect(res.status).toBe(403);
  });

  it('POST /auth/register creates user and returns JWT', async () => {
    const email = `newuser-${Date.now()}@test.com`;
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'pass123', teamId: 'team-x' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.token).toBeTruthy();
    expect(body.userId).toBeTruthy();
  });

  it('POST /auth/login returns token for valid credentials', async () => {
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
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.token).toBeTruthy();
  });

  it('POST /auth/login rejects wrong password', async () => {
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
    expect(res.status).toBe(401);
  });
});
