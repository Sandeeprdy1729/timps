// ── TIMPS Code — Core Types ──

// ═══════════════════════════════════════
// Messages & Conversations
// ═══════════════════════════════════════

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
      default?: unknown;
    }>;
    required?: string[];
  };
}

// ═══════════════════════════════════════
// Streaming
// ═══════════════════════════════════════

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_delta'; id: string; argumentsChunk: string }
  | { type: 'tool_end'; id: string }
  | { type: 'done'; stopReason?: string; usage?: TokenUsage }
  | { type: 'error'; message: string };

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'status'; message: string }
  | { type: 'plan'; plan: any }
  | { type: 'plan_complete'; plan: any }
  | { type: 'step_start'; step: string; description: string }
  | { type: 'step_complete'; step: string; result?: string }
  | { type: 'step_failed'; step: string; error: string }
  | { type: 'step_retry'; step: string; attempt: number }
  | { type: 'plan_step_start'; stepIndex: number; description: string }
  | { type: 'plan_step_done'; stepIndex: number; success: boolean }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; success: boolean; durationMs?: number }
  | { type: 'selfcorrect'; attempt: number; error: string }
  | { type: 'snapshot_created'; id: string; fileCount: number }
  | { type: 'context_compacted'; before: number; after: number }
  | { type: 'error'; message: string }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'memory_saved'; summary: string }
  | { type: 'ask_user'; question: string; callId: string };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;  // USD cost estimate
}

// ═══════════════════════════════════════
// Model Provider
// ═══════════════════════════════════════

export interface ModelProvider {
  name: string;
  model: string;
  supportsFunctionCalling: boolean;
  stream(messages: Message[], tools: ToolDefinition[], options?: StreamOptions): AsyncGenerator<StreamEvent>;
}

export interface StreamOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type ProviderName = 'claude' | 'openai' | 'gemini' | 'ollama' | 'openrouter' | 'opencode' | 'hybrid' | 'timps' | 'timps-coder';

// ═══════════════════════════════════════
// Planning
// ═══════════════════════════════════════

export interface PlanStep {
  id?: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: string;
  dependsOn?: string[];
  verification?: string;
  attempts?: number;
}

// ═══════════════════════════════════════
// Memory — 3 layers
// ═══════════════════════════════════════

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'fact' | 'pattern' | 'preference' | 'error_lesson' | 'architecture' | 'convention';
  content: string;
  tags: string[];
  confidence: number;
  accessCount: number;
}

export interface EpisodicMemory {
  timestamp: number;
  summary: string;
  filesChanged: string[];
  toolsUsed: string[];
  outcome: 'success' | 'partial' | 'failed';
}

export interface WorkingMemory {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

// ═══════════════════════════════════════
// Snapshots & Undo
// ═══════════════════════════════════════

export interface FileSnapshot {
  id: string;
  timestamp: number;
  description: string;
  files: { path: string; content: string; existed: boolean }[];
}

// ═══════════════════════════════════════
// Permissions
// ═══════════════════════════════════════

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TrustLevel = 'cautious' | 'normal' | 'trust' | 'yolo';

export interface PathRule {
  glob: string;
  trust: TrustLevel;
}

// ═══════════════════════════════════════
// Configuration
// ═══════════════════════════════════════

export interface TechStack {
  languages: string[];       // e.g. ['TypeScript', 'Python']
  frameworks: string[];      // e.g. ['React', 'FastAPI']
  libraries: string[];       // e.g. ['Tailwind CSS', 'Prisma']
  patterns: string[];        // e.g. ['REST API', 'MVC', 'functional']
  rules: string[];           // e.g. ['no class components', 'always use async/await']
}

export interface TeamConfig {
  projectName: string;
  memberName: string;
  joinedAt: number;
}

export interface TeamSession {
  memberName: string;
  timestamp: number;
  summary: string;
  filesChanged: string[];
  toolsUsed: string[];
  techStack?: TechStack;
}

export interface TeamMemoryStore {
  projectName: string;
  createdAt: number;
  techStack: TechStack;
  members: string[];
  sessions: TeamSession[];
  sharedFacts: MemoryEntry[];
  progress: { task: string; status: string; assignee?: string; timestamp: number }[];
}

export interface TimpsConfig {
  defaultProvider: ProviderName;
  defaultModel?: string;
  trustLevel: TrustLevel;
  keys: Partial<Record<ProviderName, string>>;
  ollamaUrl?: string;
  maxContextTokens?: number;
  memoryEnabled?: boolean;
  autoCorrect?: boolean;
  pathRules?: PathRule[];
  customInstructions?: string;
  techStack?: TechStack;
  team?: TeamConfig;
}

// ── TIMPS Code — Core Types ──

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
      default?: unknown;
    }>;
    required?: string[];
  };
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_delta'; id: string; argumentsChunk: string }
  | { type: 'tool_end'; id: string }
  | { type: 'done'; stopReason?: string; usage?: TokenUsage }
  | { type: 'error'; message: string };

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'status'; message: string }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; success: boolean; durationMs?: number }
  | { type: 'selfcorrect'; attempt: number; error: string }
  | { type: 'context_compacted'; before: number; after: number }
  | { type: 'error'; message: string }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'memory_saved'; summary: string }
  | { type: 'ask_user'; question: string; callId: string };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
}

export interface StreamOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ModelProvider {
  name: ProviderName;
  model: string;
  supportsFunctionCalling: boolean;
  stream(
    messages: Message[],
    tools: ToolDefinition[],
    options?: StreamOptions
  ): AsyncGenerator<StreamEvent>;
}

export type ProviderName =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'hybrid';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TrustLevel = 'cautious' | 'normal' | 'trust' | 'yolo';

export interface TimpsConfig {
  defaultProvider: ProviderName;
  defaultModel: string;
  trustLevel: TrustLevel;
  keys: Partial<Record<ProviderName, string>>;
  ollamaUrl?: string;
  memoryEnabled: boolean;
  autoCorrect: boolean;
  maxContextTokens: number;
  searxngUrl?: string;
  mcpServers?: McpServerConfig[];
}

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'fact' | 'pattern' | 'convention' | 'error' | 'decision';
  content: string;
  tags: string[];
  project?: string;
}

export interface EpisodicMemory {
  timestamp: number;
  summary: string;
  filesChanged: string[];
  toolsUsed: string[];
  outcome: 'success' | 'partial' | 'failed';
}

export interface WorkingMemory {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  result?: string;
  toolsUsed?: string[];
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  createdAt: number;
  completedAt?: number;
  outcome?: 'success' | 'partial' | 'failed';
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: number;
  completedAt?: number;
  tags?: string[];
}

// ═══════════════════════════════════════════════════════════
// TIMPS Command Registry Types (Hermes-inspired)
// ═══════════════════════════════════════════════════════════

export type CommandCategory = 'Session' | 'Configuration' | 'Tools' | 'Info' | 'Exit';

export interface CommandDef {
  name: string;
  description: string;
  category: CommandCategory;
  aliases: string[];
  argsHint: string;
  subcommands: string[];
  cliOnly: boolean;
  gatewayOnly: boolean;
}
