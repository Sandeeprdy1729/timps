// MCP Server Integration
// Supports both: MCP client (connect to other MCP servers) and MCP server (expose TIMPS tools)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ALL_TOOLS } from '../tools/tools.js';
import type { ToolDefinition } from '../config/types.js';

const MCP_CONFIG_DIR = path.join(os.homedir(), '.timps', 'mcp');
const MCP_SERVERS_FILE = path.join(MCP_CONFIG_DIR, 'servers.json');

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPServerManifest {
  servers: Record<string, MCPServerConfig>;
  enabled: string[];
}

// ── MCP Server: Expose TIMPS tools to external agents ──

let mcpServerInstance: MCPServer | null = null;

export class MCPServer {
  private server: Server;
  private transport: StdioServerTransport | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'timps-code',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: ALL_TOOLS.map(tool => ({
          name: tool.definition.name,
          description: tool.definition.description,
          inputSchema: tool.definition.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Find the tool
      const tool = ALL_TOOLS.find(t => t.definition.name === name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      try {
        const result = await tool.execute(args as Record<string, unknown>, process.cwd());
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    console.log('MCP Server started on stdio');
  }

  async stop(): Promise<void> {
    // @ts-ignore - private method
    await this.server.close();
    mcpServerInstance = null;
  }
}

export async function startMCPServer(): Promise<void> {
  if (mcpServerInstance) {
    console.log('MCP Server already running');
    return;
  }
  
  mcpServerInstance = new MCPServer();
  await mcpServerInstance.start();
}

// ── MCP Client: Connect to external MCP servers ──

export class MCPClientRegistry {
  private clients: Map<string, Client> = new Map();
  private manifests: MCPServerManifest;

  constructor() {
    this.manifests = this.loadManifest();
  }

  private loadManifest(): MCPServerManifest {
    try {
      if (fs.existsSync(MCP_SERVERS_FILE)) {
        return JSON.parse(fs.readFileSync(MCP_SERVERS_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { servers: {}, enabled: [] };
  }

  private saveManifest(): void {
    fs.mkdirSync(MCP_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(MCP_SERVERS_FILE, JSON.stringify(this.manifests, null, 2), 'utf-8');
  }

  // List configured servers
  listServers(): { name: string; enabled: boolean; config: MCPServerConfig }[] {
    return Object.entries(this.manifests.servers).map(([name, config]) => ({
      name,
      enabled: this.manifests.enabled.includes(name),
      config,
    }));
  }

  // Add an MCP server
  addServer(name: string, config: MCPServerConfig): void {
    this.manifests.servers[name] = config;
    if (!this.manifests.enabled.includes(name)) {
      this.manifests.enabled.push(name);
    }
    this.saveManifest();
  }

  // Remove an MCP server
  removeServer(name: string): boolean {
    if (!this.manifests.servers[name]) return false;
    
    delete this.manifests.servers[name];
    const idx = this.manifests.enabled.indexOf(name);
    if (idx !== -1) this.manifests.enabled.splice(idx, 1);
    
    if (this.clients.has(name)) {
      this.disconnect(name);
    }
    
    this.saveManifest();
    return true;
  }

  // Enable/disable a server
  toggleServer(name: string, enabled: boolean): boolean {
    if (!this.manifests.servers[name]) return false;
    
    if (enabled && !this.manifests.enabled.includes(name)) {
      this.manifests.enabled.push(name);
    } else if (!enabled) {
      const idx = this.manifests.enabled.indexOf(name);
      if (idx !== -1) this.manifests.enabled.splice(idx, 1);
    }
    
    this.saveManifest();
    return true;
  }

  // Connect to an MCP server
  async connect(name: string): Promise<boolean> {
    const config = this.manifests.servers[name];
    if (!config) {
      console.error(`MCP server not found: ${name}`);
      return false;
    }

    if (this.clients.has(name)) {
      return true; // Already connected
    }

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: Object.fromEntries(
          Object.entries({ ...process.env, ...config.env }).filter(([, v]) => v !== undefined)
        ) as Record<string, string>,
      });

      const client = new Client(
        { name, version: '1.0' },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.clients.set(name, client);
      console.log(`Connected to MCP server: ${name}`);
      return true;
    } catch (err: any) {
      console.error(`Failed to connect to ${name}: ${err.message}`);
      return false;
    }
  }

  // Disconnect from an MCP server
  async disconnect(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) return false;

    try {
      // @ts-ignore - private method
      await client.close();
      this.clients.delete(name);
      return true;
    } catch {
      return false;
    }
  }

  // Call a tool on a connected MCP server
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Not connected to ${serverName}. Run: timps mcp connect ${serverName}`);
    }

    const response = await client.callTool({ name: toolName, arguments: args });

    const first = (response.content as Array<{type: string; text?: string; isError?: boolean}>)?.[0];
    if (first?.isError) throw new Error(first.text);
    return first?.text;
  }

  // List tools from all connected servers
  async listAllTools(): Promise<{ server: string; tools: unknown[] }[]> {
    const results: { server: string; tools: unknown[] }[] = [];
    
    for (const [name, client] of this.clients) {
      try {
        const response = await client.listTools();
        results.push({ server: name, tools: response.tools || [] });
      } catch { /* skip errors */ }
    }
    
    return results;
  }

  // Connect to all enabled servers
  async connectAll(): Promise<void> {
    for (const name of this.manifests.enabled) {
      await this.connect(name);
    }
  }

  // Disconnect all
  async disconnectAll(): Promise<void> {
    for (const name of this.clients.keys()) {
      await this.disconnect(name);
    }
  }
}

export const mcpRegistry = new MCPClientRegistry();

// ── CLI Commands for MCP ──

export function handleMCPCommand(args: string[]): string {
  if (args[0] === 'list') {
    const servers = mcpRegistry.listServers();
    if (servers.length === 0) return 'No MCP servers configured. Run: timps mcp add <name> <command>';
    
    return 'MCP Servers:\n' + servers.map(s => 
      `  ${s.enabled ? '✓' : '○'} ${s.name}`
    ).join('\n');
  }

  if (args[0] === 'add' && args[1] && args[2]) {
    const name = args[1];
    const command = args.slice(2).join(' ');
    mcpRegistry.addServer(name, {
      command: command.split(' ')[0],
      args: command.split(' ').slice(1),
    });
    return `Added MCP server: ${name}`;
  }

  if (args[0] === 'remove' && args[1]) {
    mcpRegistry.removeServer(args[1]);
    return `Removed MCP server: ${args[1]}`;
  }

  if (args[0] === 'connect' && args[1]) {
    mcpRegistry.connect(args[1]);
    return `Connecting to ${args[1]}...`;
  }

  if (args[0] === 'disconnect' && args[1]) {
    mcpRegistry.disconnect(args[1]);
    return `Disconnected from ${args[1]}`;
  }

  return `Usage: timps mcp <list|add|remove|connect|disconnect>`;
}