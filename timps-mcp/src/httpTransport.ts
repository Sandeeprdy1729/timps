// ── timps-mcp HTTP transport (opt-in via --http) ──
// The server used to listen on every interface with `Access-Control-Allow-Origin: *`
// and no auth, so anyone on the network — or any web page the user visited
// (directly or via DNS rebinding) — could read and write their memory. It now
// binds to loopback by default, rejects cross-site browser origins and foreign
// Host headers, and can require a bearer token.

import type * as http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface HttpSecurityOptions {
  /** Address the server is bound to. */
  host: string;
  /** Browser origins allowed in addition to loopback ones (TIMPS_MCP_ALLOWED_ORIGINS). */
  allowedOrigins: string[];
  /** When set, /mcp requests must send `Authorization: Bearer <token>` (TIMPS_MCP_TOKEN). */
  token?: string;
}

export interface HttpHandlerDeps {
  security: HttpSecurityOptions;
  toolCount: number;
  /** Serve one MCP request (stateless: a fresh server + transport per request). */
  handleMcp: (req: http.IncomingMessage, res: http.ServerResponse, body: unknown) => Promise<void>;
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

/** Strip the port from a Host header value, keeping IPv6 literals bracketed. */
export function hostnameFromHostHeader(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

/**
 * Browsers send an Origin header; agents and server-to-server connectors don't.
 * Allow requests without one, loopback origins (e.g. MCP Inspector) and
 * explicitly configured origins. Anything else is a web page reaching in.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** DNS-rebinding guard: when bound to loopback, the Host header must be loopback too. */
export function isHostAllowed(hostHeader: string | undefined, bindHost: string): boolean {
  if (!isLoopbackHostname(bindHost)) return true;
  if (!hostHeader) return false;
  return isLoopbackHostname(hostnameFromHostHeader(hostHeader));
}

export function isAuthorized(authorization: string | undefined, token: string | undefined): boolean {
  if (!token) return true;
  if (!authorization?.startsWith('Bearer ')) return false;
  const given = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(o => o.trim()).filter(Boolean);
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function jsonRpcError(code: number, message: string): unknown {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

class BodyTooLargeError extends Error {}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) tooLarge = true;
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(new BodyTooLargeError());
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

export function createHttpHandler(deps: HttpHandlerDeps): http.RequestListener {
  const { security } = deps;

  return async (req, res) => {
    const origin = req.headers.origin;
    if (!isHostAllowed(req.headers.host, security.host)) {
      sendJson(res, 403, { error: 'Forbidden: unexpected Host header' });
      return;
    }
    if (!isOriginAllowed(origin, security.allowedOrigins)) {
      sendJson(res, 403, { error: 'Forbidden: origin not allowed (set TIMPS_MCP_ALLOWED_ORIGINS)' });
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, Mcp-Session-Id, Mcp-Protocol-Version');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';
    if (req.method === 'GET' && url === '/health') {
      sendJson(res, 200, { status: 'ok', transport: 'streamable-http', tools: deps.toolCount });
      return;
    }

    if (url !== '/mcp' && !url.startsWith('/mcp?')) {
      sendJson(res, 404, { error: 'Not found. Use POST /mcp for MCP protocol.' });
      return;
    }

    if (!isAuthorized(req.headers.authorization, security.token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    // Session termination is a no-op in stateless mode.
    if (req.method === 'DELETE') {
      res.writeHead(200);
      res.end();
      return;
    }

    let body: unknown;
    if (req.method === 'POST') {
      let raw: string;
      try {
        raw = await readBody(req, MAX_BODY_BYTES);
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          sendJson(res, 413, jsonRpcError(-32600, 'Request body too large'));
        } else {
          sendJson(res, 400, jsonRpcError(-32600, 'Could not read request body'));
        }
        return;
      }
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          sendJson(res, 400, jsonRpcError(-32700, 'Parse error: request body is not valid JSON'));
          return;
        }
      }
    }

    try {
      await deps.handleMcp(req, res, body);
    } catch (err) {
      console.error('[HTTP] Error:', (err as Error).message);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}
