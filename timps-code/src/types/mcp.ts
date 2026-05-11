// ── TIMPS Code — MCP Types
// Model Context Protocol types and utilities

export interface McpServerInfo {
  name: string;
  version: string;
  description?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: { name: string; description: string; required?: boolean }[];
}

export interface McpCallToolResult {
  content: { type: 'text' | 'image' | 'resource' | 'audio'; text?: string; data?: string; mimeType?: string; uri?: string }[];
  isError?: boolean;
}

export interface McpListResourcesResult {
  resources: McpResource[];
  nextCursor?: string;
}

export interface McpListToolsResult {
  tools: McpTool[];
  nextCursor?: string;
}

export interface McpListPromptsResult {
  prompts: McpPrompt[];
  nextCursor?: string;
}

export type McpClientStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface McpClientState {
  name: string;
  status: McpClientStatus;
  serverInfo?: McpServerInfo;
  lastError?: string;
  lastConnected?: number;
}

export interface McpClientConnection {
  name: string;
  status: McpClientStatus;
  serverInfo?: McpServerInfo;
  tools: import('../config/types.js').ToolDefinition[];
  resources: McpResource[];
  lastError?: string;
}

// Standard MCP tool call structure
export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Resource template
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Re-export for convenience
export type ServerResource = McpResource;
