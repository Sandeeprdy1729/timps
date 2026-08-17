#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

// @modelcontextprotocol/sdk exports map has a "./*" wildcard (./{path} →
// ./dist/cjs/{path}), so subpath imports resolve in both CJS and when bundling.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as http from 'node:http';

import { MemoryEngine, MemoryClient } from '@timps-ai/memory-core';

import { registerAllTools, type ToolContext } from './registerTools.js';

// ── Runtime mode ────────────────────────────────────────────────────────────
// LOCAL mode: TIMPS_URL is not set (or TIMPS_LOCAL=true).  All tools use
//   @timps/memory-core for deterministic, file-based intelligence — no server.
// SERVER mode: TIMPS_URL is set.  Tools proxy to the packages/server HTTP API for
//   full LLM-powered intelligence (manifesto, dead reckoning, etc.).

const SERVER_MODE = !!(process.env.TIMPS_URL && process.env.TIMPS_URL !== '' && process.env.TIMPS_LOCAL !== 'true');
const TIMPS_URL = process.env.TIMPS_URL || 'http://localhost:3000';
const TIMPS_USER_ID = parseInt(process.env.TIMPS_USER_ID || '1', 10);
const PROJECT_PATH = process.env.TIMPS_PROJECT_PATH || process.cwd();

// MemoryClient for canonical MemoryServer (used when TIMPS_MEMORY_URL is set)
const memoryClient = SERVER_MODE && process.env.TIMPS_MEMORY_URL
  ? new MemoryClient({ baseUrl: process.env.TIMPS_MEMORY_URL, token: process.env.TIMPS_API_KEY })
  : null;

// Local memory engine (used in LOCAL mode)
const localEngine = new MemoryEngine(PROJECT_PATH);

async function timpsAPI(path: string, method = 'GET', body?: unknown): Promise<any> {
  // Validate path to prevent path traversal
  if (!path.startsWith('/') || path.includes('..') || /[<>"|]/.test(path)) {
    throw new Error(`Invalid API path: ${path}`);
  }
  const res = await fetch(`${TIMPS_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`TIMPs API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function chat(message: string, username?: string): Promise<string> {
  const data = await timpsAPI('/chat', 'POST', { userId: TIMPS_USER_ID, username, message });
  return data.response || 'No response from TIMPs';
}

async function main() {
  const args = process.argv.slice(2);
  const httpMode = args.includes('--http');
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : parseInt(process.env.TIMPS_MCP_PORT || '4200', 10);

  const toolCtx: ToolContext = {
    memoryClient,
    localEngine,
    timpsAPI,
    chat,
    SERVER_MODE,
    TIMPS_USER_ID,
  };

  if (httpMode) {
    // ── HTTP/SSE transport for Claude.ai custom connectors ──
    const httpServer = http.createServer(async (req, res) => {
      // CORS headers for Claude.ai
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, Mcp-Session-Id');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', transport: 'streamable-http', tools: 67 }));
        return;
      }

      // MCP endpoint: /mcp
      if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
        try {
          // Stateless mode — no session ID, each request is independent
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });

          // Parse body for POST requests
          let parsedBody: any = undefined;
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString();
            parsedBody = raw ? JSON.parse(raw) : undefined;
          }

          // DELETE — session termination (no-op in stateless mode)
          if (req.method === 'DELETE') {
            res.writeHead(200);
            res.end();
            return;
          }

          // Create a fresh server per request and register all tools
          const server = new McpServer({ name: 'timps-mcp', version: '1.0.0' });
          registerAllTools(server, toolCtx);

          // Connect and handle
          await server.connect(transport);
          await transport.handleRequest(req, res, parsedBody);
        } catch (err: any) {
          console.error('[HTTP] Error:', err.message);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use POST /mcp for MCP protocol.' }));
    });

    httpServer.listen(port, () => {
      console.error(`TIMPs MCP HTTP transport on http://localhost:${port}/mcp`);
    });
  } else {
    // ── Stdio transport (default, for local agents) ──
    const server = new McpServer({ name: 'timps-mcp', version: '1.0.0' });
    registerAllTools(server, toolCtx);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`TIMPs MCP v1.0.0 → ${TIMPS_URL} (user ${TIMPS_USER_ID})`);
  }
}

main().catch((err) => {
  console.error('TIMPs MCP failed:', err.message);
  process.exit(1);
});
