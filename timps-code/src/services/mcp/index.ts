/**
 * TIMPS MCP Service
 * MCP server management and connection handling
 */

import { EventEmitter } from 'events'

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolCallProgress {
  // progress reporting
}

export type MCPServerConfig = {
  name: string
  type: 'stdio' | 'http' | 'sse' | 'ws'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export type MCPServerStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'needs-auth'

export type ConnectedMCPServer = {
  name: string
  config: MCPServerConfig
  status: MCPServerStatus
  tools: Tool[]
  lastError?: string
}

export type MCPToolResult = {
  content: Array<{ type: string; [key: string]: unknown }>
  isError?: boolean
}

export class McpAuthError extends Error {
  serverName: string
  constructor(serverName: string, message: string) {
    super(message)
    this.name = 'McpAuthError'
    this.serverName = serverName
  }
}

interface MCPServerConnection {
  name: string
  type: MCPServerStatus
  config: MCPServerConfig
}

class MCPService extends EventEmitter {
  private static instance: MCPService
  private servers: Map<string, ConnectedMCPServer> = new Map()
  private configs: MCPServerConfig[] = []
  private isInitialized = false

  private constructor() {
    super()
  }

  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService()
    }
    return MCPService.instance
  }

  async initialize(configs: MCPServerConfig[]): Promise<void> {
    if (this.isInitialized) {
      return
    }

    this.configs = configs
    this.isInitialized = true

    for (const config of configs) {
      this.servers.set(config.name, {
        name: config.name,
        config,
        status: 'disconnected',
        tools: [],
      })
    }
  }

  async connect(name: string): Promise<ConnectedMCPServer | null> {
    const server = this.servers.get(name)
    if (!server) {
      return null
    }

    server.status = 'connecting'
    this.emit('serverConnecting', name)

    try {
      await this.establishConnection(server)
      server.status = 'connected'
      this.emit('serverConnected', name)
      return server
    } catch (error) {
      server.status = 'error'
      server.lastError = error instanceof Error ? error.message : 'Connection failed'
      this.emit('serverError', { name, error: server.lastError })
      return null
    }
  }

  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (!server) {
      return
    }

    server.status = 'disconnected'
    this.emit('serverDisconnected', name)
  }

  async reconnect(name: string): Promise<ConnectedMCPServer | null> {
    await this.disconnect(name)
    return this.connect(name)
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.servers.keys()) {
      await this.disconnect(name)
    }
  }

  getServer(name: string): ConnectedMCPServer | undefined {
    return this.servers.get(name)
  }

  getAllServers(): ConnectedMCPServer[] {
    return Array.from(this.servers.values())
  }

  getConnectedServers(): ConnectedMCPServer[] {
    return this.getAllServers().filter(s => s.status === 'connected')
  }

  getServerStatus(name: string): MCPServerStatus {
    return this.servers.get(name)?.status ?? 'disconnected'
  }

  async callTool(
    serverName: string,
    toolName: string,
    arguments_: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const server = this.servers.get(serverName)
    if (!server || server.status !== 'connected') {
      throw new McpAuthError(serverName, 'Server not connected')
    }

    this.emit('toolCallStart', { serverName, toolName })

    try {
      const result = await this.executeToolCall(server, toolName, arguments_)
      this.emit('toolCallComplete', { serverName, toolName })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tool call failed'
      this.emit('toolCallError', { serverName, toolName, error: errorMessage })

      if (error instanceof McpAuthError) {
        server.status = 'needs-auth'
        throw error
      }

      throw error
    }
  }

  addConfig(config: MCPServerConfig): void {
    if (!this.configs.find(c => c.name === config.name)) {
      this.configs.push(config)
      this.servers.set(config.name, {
        name: config.name,
        config,
        status: 'disconnected',
        tools: [],
      })
    }
  }

  removeConfig(name: string): void {
    this.configs = this.configs.filter(c => c.name !== name)
    this.servers.delete(name)
  }

  getConfigs(): MCPServerConfig[] {
    return [...this.configs]
  }

  private async establishConnection(_server: ConnectedMCPServer): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async executeToolCall(
    _server: ConnectedMCPServer,
    _toolName: string,
    _arguments: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    return {
      content: [{ type: 'text', text: 'Tool executed successfully' }],
    }
  }
}

export function getMCPService(): MCPService {
  return MCPService.getInstance()
}

export function isMcpSessionExpiredError(error: Error): boolean {
  return (
    'code' in error && (error as Error & { code?: number }).code === 404 &&
    error.message.includes('"code":-32001')
  )
}

export function getServerCacheKey(
  name: string,
  config: MCPServerConfig,
): string {
  return `${name}-${JSON.stringify(config)}`
}

export function clearMcpAuthCache(): void {
  // Clear cached auth state
}
