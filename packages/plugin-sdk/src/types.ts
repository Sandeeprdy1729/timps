// ─── Memory types (mirror of @timps/memory-core contracts) ───────────────────

export interface SemanticEntry {
  key: string;
  value: string;
  type: string;
  tags: string[];
  importance: number;
  lastAccessed: string;
}

export interface EpisodicEntry {
  ts: string;
  summary: string;
  outcome: 'success' | 'failure' | 'partial';
  tags: string[];
  toolsUsed: string[];
  filesChanged: string[];
  durationMs: number;
}

// ─── Plugin API types ─────────────────────────────────────────────────────────

/** Specification for a slash command added by a plugin */
export interface CommandSpec {
  /** Command name without leading slash, e.g. `"summarize"` */
  name: string;
  description: string;
  usage: string;
}

/** Specification for an agent tool added by a plugin */
export interface ToolSpec {
  /** Unique tool name, e.g. `"search_web"` */
  name: string;
  description: string;
  /** JSON Schema object describing the parameters */
  parameters: Record<string, unknown>;
}

/** Lifecycle hook event names the agent emits */
export type HookName =
  | 'before:run'
  | 'after:run'
  | 'before:tool'
  | 'after:tool'
  | 'on:error'
  | 'on:session:end';

/** Permissions a plugin can request */
export type Permission = 'network' | 'memory:read' | 'memory:write' | 'fs:read' | 'fs:write' | 'env:read' | 'process:spawn';

/** Static metadata declared by a plugin */
export interface PluginManifest {
  /** Unique plugin identifier, e.g. `"@timps/plugin-echo"` */
  name: string;
  /** Semver string, e.g. `"0.1.0"` */
  version: string;
  description: string;
  author?: string;
  license?: string;
  commands?: CommandSpec[];
  tools?: ToolSpec[];
  hooks?: HookName[];
  /** TIMPS-specific metadata */
  timps?: {
    /** Compatible TIMPS version range */
    version?: string;
    /** Declared permissions */
    permissions?: Permission[];
    /** Plugin dependencies `{ name: version }` */
    dependencies?: Record<string, string>;
    /** Lifecycle hooks this plugin subscribes to */
    hooks?: HookName[];
    /** Tools this plugin exposes */
    tools?: string[];
  };
}

// ─── Runtime context passed to every handler ──────────────────────────────────

export interface MemoryAPI {
  loadSemantic(projectPath: string): Promise<SemanticEntry[]>;
  saveSemantic(projectPath: string, entries: SemanticEntry[]): Promise<void>;
  loadEpisodes(projectPath: string, count?: number): Promise<EpisodicEntry[]>;
  appendEpisode(projectPath: string, entry: EpisodicEntry): Promise<void>;
}

export interface PluginContext {
  /** Absolute path to the active project */
  projectPath: string;
  /** Access to the TIMPS memory layer */
  memory: MemoryAPI;
  /** Structured log — forwarded to the agent's UI */
  log: (msg: string) => void;
}

// ─── Handler function signatures ─────────────────────────────────────────────

export type CommandHandler = (
  args: string[],
  ctx: PluginContext,
) => Promise<string>;

export interface ToolResult {
  output: string;
  error?: string;
}

export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: PluginContext,
) => Promise<ToolResult>;

export type HookHandler = (
  event: HookName,
  payload: unknown,
  ctx: PluginContext,
) => Promise<void>;

// ─── The Plugin contract ──────────────────────────────────────────────────────

/**
 * A TIMPS plugin.
 *
 * @example
 * ```ts
 * import type { Plugin } from '@timps/plugin-sdk';
 *
 * const myPlugin: Plugin = {
 *   manifest: { name: '@acme/plugin-hello', version: '1.0.0', description: 'Says hello' },
 *   commands: {
 *     async hello(args, _ctx) { return `Hello, ${args[0] ?? 'world'}!`; },
 *   },
 * };
 * export default myPlugin;
 * ```
 */
export interface Plugin {
  manifest: PluginManifest;
  /** Map of command name → handler (keys must match manifest.commands[].name) */
  commands?: Record<string, CommandHandler>;
  /** Map of tool name → handler (keys must match manifest.tools[].name) */
  tools?: Record<string, ToolHandler>;
  /** Map of hook name → handler */
  hooks?: Partial<Record<HookName, HookHandler>>;
  /** Called once when the plugin is activated */
  setup?(ctx: PluginContext): Promise<void>;
  /** Called once when the session ends or the plugin is unloaded */
  teardown?(ctx: PluginContext): Promise<void>;
}
