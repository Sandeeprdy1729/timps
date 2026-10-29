import { describe, it, expect, vi, afterEach } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { parseCliArgs, validateApiPath, usage } from '../src/options';
import {
  createHttpHandler,
  hostnameFromHostHeader,
  isAuthorized,
  isHostAllowed,
  isOriginAllowed,
  MAX_BODY_BYTES,
  parseAllowedOrigins,
} from '../src/httpTransport';
import { registerAllTools, type ToolContext } from '../src/registerTools';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PKG_VERSION: string = require('../package.json').version;

describe('timps-mcp entry point', () => {
  afterEach(() => vi.restoreAllMocks());

  it('imports without starting a server', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.main).toBe('function');
  });

  it('--version prints the package version instead of serving', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { main } = await import('../src/index');
    await main(['--version']);
    expect(log).toHaveBeenCalledWith(PKG_VERSION);
  });

  it('--help prints usage', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { main } = await import('../src/index');
    await main(['--help']);
    expect(log.mock.calls[0][0]).toContain('Usage: timps-mcp');
  });
});

describe('parseCliArgs', () => {
  it('defaults to stdio on loopback port 4200', () => {
    expect(parseCliArgs([], {})).toEqual({ http: false, port: 4200, host: '127.0.0.1', help: false, version: false });
  });

  it('reads --http, --port and --host, with flags overriding env', () => {
    const opts = parseCliArgs(['--http', '--port', '9000', '--host', '0.0.0.0'], { TIMPS_MCP_PORT: '1234', TIMPS_MCP_HOST: '::1' });
    expect(opts).toMatchObject({ http: true, port: 9000, host: '0.0.0.0' });
  });

  it('falls back to TIMPS_MCP_PORT / TIMPS_MCP_HOST', () => {
    expect(parseCliArgs(['--http'], { TIMPS_MCP_PORT: '5000', TIMPS_MCP_HOST: '::1' })).toMatchObject({ port: 5000, host: '::1' });
  });

  it('rejects invalid ports', () => {
    expect(() => parseCliArgs(['--port', 'abc'], {})).toThrow('Invalid port');
    expect(() => parseCliArgs(['--port', '70000'], {})).toThrow('Invalid port');
  });

  it('recognises -v/-h', () => {
    expect(parseCliArgs(['-v'], {}).version).toBe(true);
    expect(parseCliArgs(['-h'], {}).help).toBe(true);
    expect(usage('9.9.9')).toContain('9.9.9');
  });
});

describe('validateApiPath', () => {
  it('rejects paths without leading slash', () => {
    expect(() => validateApiPath('api/chat')).toThrow('Invalid API path');
  });
  it('rejects parent traversal', () => {
    expect(() => validateApiPath('/../../../etc/passwd')).toThrow('Invalid API path');
  });
  it('rejects shell metacharacters', () => {
    expect(() => validateApiPath('/path|id')).toThrow('Invalid API path');
    expect(() => validateApiPath('/a<b')).toThrow('Invalid API path');
  });
  it('accepts valid paths', () => {
    expect(() => validateApiPath('/chat')).not.toThrow();
    expect(() => validateApiPath('/chronos/ingest')).not.toThrow();
  });
});

describe('HTTP security helpers', () => {
  it('allows requests without an Origin, loopback origins and configured origins', () => {
    expect(isOriginAllowed(undefined, [])).toBe(true);
    expect(isOriginAllowed('http://localhost:6274', [])).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3000', [])).toBe(true);
    expect(isOriginAllowed('http://[::1]:3000', [])).toBe(true);
    expect(isOriginAllowed('https://app.example.com', ['https://app.example.com'])).toBe(true);
  });

  it('rejects other browser origins', () => {
    expect(isOriginAllowed('https://evil.example', [])).toBe(false);
    expect(isOriginAllowed('https://localhost.evil.example', [])).toBe(false);
    expect(isOriginAllowed('null', [])).toBe(false);
  });

  it('guards against DNS rebinding when bound to loopback', () => {
    expect(isHostAllowed('localhost:4200', '127.0.0.1')).toBe(true);
    expect(isHostAllowed('127.0.0.1:4200', '127.0.0.1')).toBe(true);
    expect(isHostAllowed('[::1]:4200', '127.0.0.1')).toBe(true);
    expect(isHostAllowed('attacker.example:4200', '127.0.0.1')).toBe(false);
    expect(isHostAllowed(undefined, '127.0.0.1')).toBe(false);
    // Deliberately exposed: Host is not restricted.
    expect(isHostAllowed('mcp.example.com', '0.0.0.0')).toBe(true);
  });

  it('parses Host headers including IPv6 literals', () => {
    expect(hostnameFromHostHeader('localhost:4200')).toBe('localhost');
    expect(hostnameFromHostHeader('[::1]:4200')).toBe('[::1]');
    expect(hostnameFromHostHeader('example.com')).toBe('example.com');
  });

  it('checks bearer tokens only when one is configured', () => {
    expect(isAuthorized(undefined, undefined)).toBe(true);
    expect(isAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(isAuthorized('Bearer wrong', 's3cret')).toBe(false);
    expect(isAuthorized(undefined, 's3cret')).toBe(false);
    expect(isAuthorized('Basic s3cret', 's3cret')).toBe(false);
  });

  it('parses the allowed-origins list', () => {
    expect(parseAllowedOrigins(' https://a.example , https://b.example,')).toEqual(['https://a.example', 'https://b.example']);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe('createHttpHandler', () => {
  async function withServer(
    opts: { token?: string; allowedOrigins?: string[] },
    fn: (port: number, calls: unknown[]) => Promise<void>,
  ): Promise<void> {
    const calls: unknown[] = [];
    const handler = createHttpHandler({
      security: { host: '127.0.0.1', allowedOrigins: opts.allowedOrigins ?? [], token: opts.token },
      toolCount: 69,
      handleMcp: async (_req, res, body) => {
        calls.push(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      },
    });
    const server = http.createServer(handler);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      await fn((server.address() as AddressInfo).port, calls);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  const post = (port: number, body: string, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

  it('reports the real tool count on /health', async () => {
    await withServer({}, async port => {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(await res.json()).toEqual({ status: 'ok', transport: 'streamable-http', tools: 69 });
    });
  });

  it('forwards valid JSON-RPC bodies to the MCP handler', async () => {
    await withServer({}, async (port, calls) => {
      const res = await post(port, '{"jsonrpc":"2.0","id":1,"method":"ping"}');
      expect(res.status).toBe(200);
      expect(calls).toEqual([{ jsonrpc: '2.0', id: 1, method: 'ping' }]);
    });
  });

  it('rejects cross-site browser origins and does not send a wildcard CORS header', async () => {
    await withServer({}, async (port, calls) => {
      const res = await post(port, '{}', { Origin: 'https://evil.example' });
      expect(res.status).toBe(403);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(calls).toEqual([]);
    });
  });

  it('echoes an allowed origin instead of *', async () => {
    await withServer({}, async port => {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:6274' } });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:6274');
    });
  });

  it('requires the bearer token when configured', async () => {
    await withServer({ token: 'tkn' }, async (port, calls) => {
      expect((await post(port, '{}')).status).toBe(401);
      expect((await post(port, '{}', { Authorization: 'Bearer nope' })).status).toBe(401);
      expect((await post(port, '{"jsonrpc":"2.0","id":2,"method":"ping"}', { Authorization: 'Bearer tkn' })).status).toBe(200);
      expect(calls).toHaveLength(1);
    });
  });

  it('answers invalid JSON with a JSON-RPC parse error, not a 500', async () => {
    await withServer({}, async (port, calls) => {
      const res = await post(port, '{not json');
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe(-32700);
      expect(calls).toEqual([]);
    });
  });

  it('rejects oversized bodies', async () => {
    await withServer({}, async (port, calls) => {
      const res = await post(port, 'x'.repeat(MAX_BODY_BYTES + 1));
      expect(res.status).toBe(413);
      expect(calls).toEqual([]);
    });
  });

  it('404s unknown routes', async () => {
    await withServer({}, async port => {
      expect((await fetch(`http://127.0.0.1:${port}/nope`)).status).toBe(404);
    });
  });
});

describe('registerAllTools', () => {
  it('returns the number of tools it registered', () => {
    const server = new McpServer({ name: 'test', version: '0' });
    const ctx: ToolContext = {
      memoryClient: null,
      localEngine: {},
      timpsAPI: async () => ({}),
      chat: async () => '',
      SERVER_MODE: false,
      TIMPS_USER_ID: 1,
    };
    const count = registerAllTools(server, ctx);
    expect(count).toBe(Object.keys((server as any)._registeredTools).length);
    expect(count).toBeGreaterThanOrEqual(60);
  });
});
