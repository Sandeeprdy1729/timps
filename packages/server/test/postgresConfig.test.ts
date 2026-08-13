// @timps/server — M75 regression tests
// Verifies (1) the Postgres config log never prints the password and
// (2) config no longer ships a hardcoded default credential (postgres/postgres).

import { describe, it, expect, vi, afterEach } from 'vitest';

// config/env.ts does `import 'dotenv/config'` which would load the local
// .env file (e.g. POSTGRES_PASSWORD=postgres in dev). Stub it so the tests
// exercise loadConfig() against process.env only.
vi.mock('dotenv/config', () => ({}));

const REAL_SECRET = 'S3cr3t_P0stgres_Phrase';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_PASSWORD;
});

describe('config/env.ts — postgres credentials (M75)', () => {
  it('does not ship a hardcoded default password', async () => {
    vi.resetModules();
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.DATABASE_URL;
    const { loadConfig } = await import('../config/env');
    const cfg = loadConfig();
    expect(cfg.postgres.password).not.toBe('postgres');
  });

  it('reads POSTGRES_PASSWORD from the environment', async () => {
    vi.resetModules();
    process.env.POSTGRES_PASSWORD = REAL_SECRET;
    const { loadConfig } = await import('../config/env');
    const cfg = loadConfig();
    expect(cfg.postgres.password).toBe(REAL_SECRET);
  });
});

describe('db/postgres.ts — no password leakage (M75)', () => {
  it('does not print the password in the import-time config log', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      vi.resetModules();
      process.env.POSTGRES_PASSWORD = REAL_SECRET;
      delete process.env.DATABASE_URL;
      await import('../db/postgres');
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }

    const configLine = logs.find((l) => l.includes('POSTGRES CONFIG'));
    expect(configLine).toBeDefined();
    // The password must never appear in stdout
    expect(logs.join('\n')).not.toContain(REAL_SECRET);
    // A masked placeholder is present instead
    expect(configLine).toContain('password: ********');
  });
});
