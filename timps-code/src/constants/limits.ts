// ── TIMPS Code — API Limits & Constants
// Rate limits, token budgets, and system limits

export const API_LIMITS = {
  MAX_CONTEXT_TOKENS: 200000,
  MAX_OUTPUT_TOKENS: 8192,
  MAX_TOOL_CALLS_PER_TURN: 50,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_MS: 120000,
};

export const COST_PER_1K_TOKENS = {
  // Claude models (approximate)
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-20250514': { input: 0.8, output: 4 },

  // OpenAI models (approximate)
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'o1': { input: 15, output: 60 },
  'o3-mini': { input: 1.1, output: 4.4 },

  // Gemini models (approximate)
  'gemini-2.0-flash': { input: 0, output: 0 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },

  // Local/other (free)
  'ollama': { input: 0, output: 0 },
  'openrouter': { input: 0, output: 0 },
  'deepseek': { input: 0.27, output: 1.1 },
  'groq': { input: 0, output: 0 },
};

export const MEMORY_LIMITS = {
  MAX_SEMANTIC_ENTRIES: 10000,
  MAX_EPISODE_LENGTH: 100,
  MAX_WORKING_FILES: 50,
  MAX_CONTEXT_COMPRESS_BUDGET: 4000,
  DECAY_THRESHOLD: 0.3,
  DECAY_INTERVAL_MS: 86400000, // 24 hours
  ARCHIVE_AGE_DAYS: 30,
};

export const TOOL_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_BASH_TIMEOUT: 300000, // 5 minutes
  MAX_GREP_RESULTS: 1000,
  MAX_GLOB_RESULTS: 500,
};

export const SESSION_LIMITS = {
  MAX_HISTORY: 1000,
  MAX_SNAPSHOTS: 50,
  MAX_TODOS: 100,
  SESSION_TIMEOUT_MS: 3600000, // 1 hour idle
  AUTO_SAVE_INTERVAL_MS: 60000, // 1 minute
};

export const MCP_LIMITS = {
  MAX_MCP_SERVERS: 20,
  MAX_MCP_TOOLS: 200,
  MAX_MCP_RESOURCES: 100,
  MCP_TIMEOUT_MS: 30000,
};

export const FEATURE_DEFAULTS = {
  SWARM_ENABLED: true,
  MCP_ENABLED: true,
  MEMORY_VSS: true,
  KNOWLEDGE_GRAPH: true,
  PREDICTIVE_PREFETCHER: true,
  BUG_PATTERN_PROPHET: true,
  TECH_DEBT_SEISMOGRAPH: true,
  THINKBACK: true,
  PROMPT_SUGGESTION: true,
  REPL_MODE: true,
  FAST_MODE: false,
  BRIEF_MODE: false,
  VOICE_MODE: false,
};
