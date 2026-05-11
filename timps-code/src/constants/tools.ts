// ── TIMPS Code — Tool Constants
// Tool-related constants and registries

export const TOOL_NAMES = {
  // Core file tools
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  EDIT_FILE: 'edit_file',
  MULTI_EDIT: 'multi_edit',
  PATCH_FILE: 'patch_file',
  LIST_DIRECTORY: 'list_directory',

  // Search tools
  FIND_FILES: 'find_files',
  SEARCH_CODE: 'search_code',
  PROJECT_INFO: 'project_info',

  // Git tools
  GIT_STATUS: 'git_status',
  GIT_COMMIT: 'git_commit',
  GIT_DIFF: 'git_diff',
  GIT_LOG: 'git_log',
  GIT_STASH: 'git_stash',

  // Shell tools
  BASH: 'bash',

  // Web tools
  WEB_SEARCH: 'web_search',
  FETCH_URL: 'fetch_url',

  // Execution tools
  NOTEBOOK: 'notebook',
  RUN_DIAGNOSTICS: 'run_diagnostics',

  // Memory tools
  MEMORY_STORE: 'memory_store',
  MEMORY_SEARCH: 'memory_search',
  MEMORY_COMPRESS: 'memory_compress',
  MEMORY_KG_QUERY: 'memory_kg_query',
  MEMORY_TIMELINE: 'memory_timeline',
  MEMORY_PREDICT: 'memory_predict',
  MEMORY_STATS: 'memory_stats',
  MEMORY_DECAY: 'memory_decay',
  MEMORY_BENCHMARK: 'memory_benchmark',

  // Task tools
  TODO_WRITE: 'todo_write',
  TODO_READ: 'todo_read',

  // Reasoning
  THINK: 'think',
  ASK_USER: 'ask_user',
};

export const TOOL_CATEGORIES = {
  FILE: 'file',
  SEARCH: 'search',
  GIT: 'git',
  SHELL: 'shell',
  WEB: 'web',
  MEMORY: 'memory',
  TASK: 'task',
  REASONING: 'reasoning',
};

export const TOOL_RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const LOCAL_TOOLS = [
  'read_file',
  'write_file',
  'edit_file',
  'list_directory',
  'bash',
  'search_code',
  'find_files',
  'git_status',
  'git_diff',
  'git_log',
  'project_info',
  'think',
];

export const MEMORY_TOOLS = [
  'memory_store',
  'memory_search',
  'memory_compress',
  'memory_kg_query',
  'memory_timeline',
  'memory_predict',
  'memory_stats',
  'memory_decay',
  'memory_benchmark',
];

export const TASK_TOOLS = [
  'todo_write',
  'todo_read',
];

export const AGENT_DISALLOWED_TOOLS = [
  'ask_user',
  'think',
];

export function getToolsByCategory(category: string): string[] {
  switch (category) {
    case TOOL_CATEGORIES.FILE:
      return [TOOL_NAMES.READ_FILE, TOOL_NAMES.WRITE_FILE, TOOL_NAMES.EDIT_FILE,
              TOOL_NAMES.MULTI_EDIT, TOOL_NAMES.PATCH_FILE, TOOL_NAMES.LIST_DIRECTORY];
    case TOOL_CATEGORIES.SEARCH:
      return [TOOL_NAMES.FIND_FILES, TOOL_NAMES.SEARCH_CODE, TOOL_NAMES.PROJECT_INFO];
    case TOOL_CATEGORIES.GIT:
      return [TOOL_NAMES.GIT_STATUS, TOOL_NAMES.GIT_COMMIT, TOOL_NAMES.GIT_DIFF,
              TOOL_NAMES.GIT_LOG, TOOL_NAMES.GIT_STASH];
    case TOOL_CATEGORIES.SHELL:
      return [TOOL_NAMES.BASH];
    case TOOL_CATEGORIES.WEB:
      return [TOOL_NAMES.WEB_SEARCH, TOOL_NAMES.FETCH_URL];
    case TOOL_CATEGORIES.MEMORY:
      return MEMORY_TOOLS;
    case TOOL_CATEGORIES.TASK:
      return TASK_TOOLS;
    case TOOL_CATEGORIES.REASONING:
      return [TOOL_NAMES.THINK, TOOL_NAMES.ASK_USER];
    default:
      return [];
  }
}
