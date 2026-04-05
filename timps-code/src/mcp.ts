import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();

  async loadConfig(configPath: string) {
    if (!fs.existsSync(configPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const mcpServers: Record<string, MCPServerConfig> = data.mcpServers || {};
      for (const [name, config] of Object.entries(mcpServers)) {
        await this.connectServer(name, config);
      }
    } catch (e) {
      console.error(`Failed to load MCP config: ${(e as Error).message}`);
    }
  }

  async connectServer(name: string, config: MCPServerConfig) {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...(process.env as Record<string, string>), ...config.env }
    });

    const client = new Client({
      name: 'timps-code-client',
      version: '1.0.0'
    }, { capabilities: {} });

    await client.connect(transport);
    this.clients.set(name, client);
    this.transports.set(name, transport);
  }

  getAvailableServers() {
    return Array.from(this.clients.keys());
  }

  async getToolsForServer(serverName: string) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not found: ${serverName}`);
    return await client.listTools();
  }

  async callTool(serverName: string, toolName: string, args: any) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not found: ${serverName}`);
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  }

  async shutdown() {
    for (const [name, transport] of this.transports.entries()) {
      await transport.close();
    }
    this.clients.clear();
    this.transports.clear();
  }
}

export const mcpManager = new MCPManager();
