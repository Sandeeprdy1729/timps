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
import { parseCliArgs, usage, validateApiPath } from './options.js';
import { createHttpHandler, parseAllowedOrigins } from './httpTransport.js';

// Bundled at build time, so this is the published package's version.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VERSION: string = require('../package.json').version;

// ── Runtime mode ────────────────────────────────────────────────────────────
// LOCAL mode: TIMPS_URL is not set (or TIMPS_LOCAL=true).  All tools use
//   @timps/memory-core for deterministic, file-based intelligence — no server.
// SERVER mode: TIMPS_URL is set.  Tools proxy to the packages/server HTTP API for
//   full LLM-powered intelligence (manifesto, dead reckoning, etc.).

const SERVER_MODE = !!(process.env.TIMPS_URL && process.env.TIMPS_URL !== '' && process.env.TIMPS_LOCAL !== 'true');
const TIMPS_URL = process.env.TIMPS_URL || 'http://localhost:3000';
const TIMPS_USER_ID = parseInt(process.env.TIMPS_USER_ID || '1', 10);
const PROJECT_PATH = process.env.TIMPS_PROJECT_PATH || process.cwd();

async function timpsAPI(path: string, method = 'GET', body?: unknown): Promise<any> {
  validateApiPath(path);
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

function createServer(toolCtx: ToolContext): { server: McpServer; toolCount: number } {
  const server = new McpServer({ name: 'timps-mcp', version: VERSION });
  const toolCount = registerAllTools(server, toolCtx);
  return { server, toolCount };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseCliArgs(argv);
  if (opts.version) {
    console.log(VERSION);
    return;
  }
  if (opts.help) {
    console.log(usage(VERSION));
    return;
  }

  // Created only once we know we're serving, so --version/--help have no side effects.
  const toolCtx: ToolContext = {
    memoryClient: SERVER_MODE && process.env.TIMPS_MEMORY_URL
      ? new MemoryClient({ baseUrl: process.env.TIMPS_MEMORY_URL, token: process.env.TIMPS_API_KEY })
      : null,
    localEngine: new MemoryEngine(PROJECT_PATH),
    timpsAPI,
    chat,
    SERVER_MODE,
    TIMPS_USER_ID,
  };
  const modeLabel = SERVER_MODE ? `server mode → ${TIMPS_URL}` : `local mode → ${PROJECT_PATH}`;

  if (opts.http) {
    // ── Streamable HTTP transport (stateless: fresh server per request) ──
    const { toolCount } = createServer(toolCtx);
    const handler = createHttpHandler({
      security: {
        host: opts.host,
        allowedOrigins: parseAllowedOrigins(process.env.TIMPS_MCP_ALLOWED_ORIGINS),
        token: process.env.TIMPS_MCP_TOKEN || undefined,
      },
      toolCount,
      handleMcp: async (req, res, body) => {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        const { server } = createServer(toolCtx);
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      },
    });

    const httpServer = http.createServer(handler);
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(opts.port, opts.host, () => resolve());
    });
    console.error(`TIMPs MCP v${VERSION} (${modeLabel}, ${toolCount} tools) on http://${opts.host}:${opts.port}/mcp`);
    if (!process.env.TIMPS_MCP_TOKEN) {
      console.error('  No TIMPS_MCP_TOKEN set: any local process can use this endpoint.');
    }
  } else {
    // ── Stdio transport (default, for local agents) ──
    const { server, toolCount } = createServer(toolCtx);
    await server.connect(new StdioServerTransport());
    console.error(`TIMPs MCP v${VERSION} (${modeLabel}, ${toolCount} tools)`);
  }
}

// Vitest imports this module to test it; only run as a program otherwise.
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error('TIMPs MCP failed:', err.message);
    process.exit(1);
  });
}
