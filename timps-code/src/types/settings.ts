// ── TIMPS Code — Settings Types
// Configuration schema and settings management

import type { ProviderName, TrustLevel } from '../config/types.js';

export interface SettingsJson {
  // Model
  defaultModel: string | null;
  preconfiguredModel: string | null;
  modelPrices: Record<string, { input: number; output: number }>;

  // Provider
  provider: ProviderName | null;

  // API
  apiKey?: string;
  apiKeyMetadata?: { source: string; updatedAt: number };
  baseUrl?: string;
  anthropicVersion?: string;

  // MCP
  mcpServers?: McpServerConfig[];
  mcpRoots?: string[];

  // Features
  thinkingEnabled?: boolean;
  fastMode?: boolean;
  verbose?: boolean;
  maxTokens?: number;
  temperature?: number;

  // Output
  outputStyle?: string;
  theme?: string;
  fontFamily?: string;
  fontSize?: number;

  // Permissions
  permissionMode?: 'auto' | 'ask' | 'yes' | 'no';
  allowedPaths?: string[];
  deniedPaths?: string[];

  // Git
  gitCommitAuthor?: string;
  gitCommitEmail?: string;

  // Editor
  editor?: string;
  diffFormat?: 'side-by-side' | 'unified';

  // Privacy
  disableHistory?: boolean;
  disableAnalytics?: boolean;
  reduceMotion?: boolean;

  // Advanced
  maxContextTokens?: number;
  idleTimeout?: number;
  retryAttempts?: number;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  scope?: 'user' | 'project' | 'dynamic';
}

export interface ScopedMcpServerConfig extends McpServerConfig {
  scope: 'user' | 'project' | 'dynamic';
  enabled: boolean;
  fromEnv?: boolean;
}

export interface SettingSource {
  type: 'default' | 'env' | 'config' | 'cli' | 'mdm' | 'policy';
  path?: string;
}

export function getDefaultSettings(): SettingsJson {
  return {
    defaultModel: null,
    preconfiguredModel: null,
    modelPrices: {},
    provider: null,
    thinkingEnabled: undefined,
    fastMode: false,
    verbose: false,
    outputStyle: 'default',
    theme: 'default',
    permissionMode: 'auto',
    maxContextTokens: 200000,
    idleTimeout: 3600,
    retryAttempts: 3,
  };
}
