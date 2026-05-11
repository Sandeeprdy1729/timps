// TIMPS Code — Plugin System Types

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: PluginAuthor;
  repository?: string;
  commands?: PluginCommand[];
  skills?: PluginSkill[];
  hooks?: PluginHook[];
  mcpServers?: Record<string, PluginMcpServer>;
  dependencies?: string[];
}

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PluginCommand {
  name: string;
  description: string;
  path: string;
}

export interface PluginSkill {
  name: string;
  description: string;
  path: string;
}

export interface PluginHook {
  name: string;
  path: string;
}

export interface PluginMcpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface LoadedPlugin {
  name: string;
  manifest: PluginManifest;
  path: string;
  source: string;
  enabled: boolean;
  isBuiltin: boolean;
  commands?: PluginCommand[];
  skills?: PluginSkill[];
  hooks?: PluginHook[];
  mcpServers?: Record<string, PluginMcpServer>;
}

export interface PluginRepository {
  url: string;
  branch: string;
  lastUpdated?: string;
  commitSha?: string;
}

export interface PluginConfig {
  repositories: Record<string, PluginRepository>;
  enabledPlugins: string[];
  disabledPlugins: string[];
}

export type PluginError =
  | { type: 'plugin-not-found'; pluginId: string }
  | { type: 'manifest-invalid'; error: string }
  | { type: 'load-failed'; error: string }
  | { type: 'dependency-missing'; dependency: string }
  | { type: 'generic-error'; error: string };

export interface PluginLoadResult {
  enabled: LoadedPlugin[];
  disabled: LoadedPlugin[];
  errors: PluginError[];
}

export const DEFAULT_MARKETPLACE = 'https://registry.timps.ai/plugins';