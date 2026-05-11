// ── TIMPS Code — MCP Client & Discovery
// Model Context Protocol integration with auto-discovery

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool, Resource } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from '../config/types.js';
import type { McpServerConfig } from '../types/settings.js';
import type { McpClientConnection, McpResource } from '../types/mcp.js';
import { loadConfig } from '../config/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';

export interface DiscoveredMcpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  autoStart?: boolean;
}

export class McpClientManager extends EventEmitter {
  private clients = new Map<string, McpClientConnection>();
  private transports = new Map<string, StdioClientTransport>();
  private mcpClients = new Map<string, Client>();
  private config: McpServerConfig[] = [];

  constructor() {
    super();
    this.loadConfig();
  }

  private loadConfig(): void {
    const cfg = loadConfig();
    this.config = cfg.mcpServers || [];
  }

  async initialize(): Promise<void> {
    for (const server of this.config) {
      await this.connect(server);
    }
  }

  async connect(config: McpServerConfig): Promise<void> {
    const { name, command, args = [], env = {} } = config;

    try {
      const envRecord: Record<string, string> = {};
      for (const [k, v] of Object.entries(env)) {
        if (v !== undefined && v !== null) envRecord[k] = String(v);
      }

      const transport = new StdioClientTransport({
        command,
        args,
        env: { ...process.env, ...envRecord } as Record<string, string>,
      });

      const client = new Client({ name: `timps-${name}`, version: '2.0.0' }, {
        capabilities: { tools: {}, resources: {}, prompts: {} },
      } as any);

      await client.connect(transport);
      this.transports.set(name, transport);
      this.mcpClients.set(name, client);

      const toolsResult = await client.listTools();
      const resourcesResult = await client.listResources();

      this.clients.set(name, {
        name,
        status: 'connected',
        serverInfo: { name, version: '1.0.0' },
        tools: toolsResult.tools.map(t => this.mcpToolToDefinition(t)),
        resources: resourcesResult.resources.map(r => this.mcpResourceToResource(r)),
      });

      this.emit('connected', name);
    } catch (err) {
      this.clients.set(name, {
        name,
        status: 'error',
        lastError: (err as Error).message,
        tools: [],
        resources: [],
      });
      this.emit('error', name, err as Error);
    }
  }

  async disconnect(name: string): Promise<void> {
    const client = this.mcpClients.get(name);
    if (client) {
      await client.close();
      this.mcpClients.delete(name);
      this.transports.delete(name);
      this.clients.delete(name);
      this.emit('disconnected', name);
    }
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const client = this.mcpClients.get(serverName);
    if (!client) throw new Error(`MCP server "${serverName}" not connected`);

    const result = await client.callTool({ name: toolName, arguments: args });
    return this.formatToolResult(result);
  }

  getTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const conn of this.clients.values()) {
      if (conn.status === 'connected') {
        tools.push(...conn.tools);
      }
    }
    return tools;
  }

  getClients(): McpClientConnection[] {
    return Array.from(this.clients.values());
  }

  getClient(name: string): McpClientConnection | undefined {
    return this.clients.get(name);
  }

  private mcpToolToDefinition(tool: Tool): ToolDefinition {
    return {
      name: tool.name,
      description: tool.description || '',
      inputSchema: {
        type: 'object',
        properties: (tool.inputSchema as any)?.properties || {},
        required: (tool.inputSchema as any)?.required || [],
      },
    };
  }

  private mcpResourceToResource(resource: Resource): McpResource {
    return {
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType,
      description: resource.description,
    };
  }

  private formatToolResult(result: any): string {
    if (!result.content) return 'OK';
    return result.content
      .map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c))
      .join('\n');
  }
}

// ── MCP Server Discovery ─────────────────────────────────────────────────────

const OFFICIAL_SERVERS: DiscoveredMcpServer[] = [
  { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], description: 'File system operations', autoStart: true },
  { name: 'git', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'], description: 'Git operations', autoStart: true },
  { name: 'github', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], description: 'GitHub integration' },
  { name: 'slack', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], description: 'Slack messaging' },
  { name: 'postgres', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'], description: 'PostgreSQL database' },
  { name: 'brave-search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], description: 'Web search via Brave' },
  { name: 'memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], description: 'Persistent memory server' },
  { name: 'sentry', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sentry'], description: 'Sentry error tracking' },
];

export async function discoverMcpServers(cwd: string): Promise<DiscoveredMcpServer[]> {
  const discovered: DiscoveredMcpServer[] = [];

  // Check package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const mcpDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
        .filter(d => d.startsWith('@modelcontextprotocol/server-'));
      for (const dep of mcpDeps) {
        const serverName = dep.replace('@modelcontextprotocol/server-', '');
        discovered.push({ name: serverName, command: 'npx', args: ['-y', dep], description: `Discovered from ${pkgPath}`, autoStart: true });
      }
    } catch { /* ignore */ }
  }

  // Check .mcp.json
  const mcpConfigPath = path.join(cwd, '.mcp.json');
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      for (const [name, config] of Object.entries(mcpConfig.mcpServers || {})) {
        const c = config as any;
        discovered.push({ name, command: c.command, args: c.args, env: c.env, description: 'From .mcp.json' });
      }
    } catch { /* ignore */ }
  }

  return discovered;
}

export function getOfficialMcpServers(): DiscoveredMcpServer[] {
  return OFFICIAL_SERVERS;
}

export function getMcpServerTemplate(name: string): DiscoveredMcpServer | undefined {
  return OFFICIAL_SERVERS.find(s => s.name === name);
}

let mcpManager: McpClientManager | null = null;

export function getMcpManager(): McpClientManager {
  if (!mcpManager) {
    mcpManager = new McpClientManager();
  }
  return mcpManager;
}
