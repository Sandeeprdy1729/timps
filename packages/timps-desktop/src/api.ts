/**
 * Typed wrappers over Tauri invoke commands exposed by src-tauri/src/lib.rs
 * In a browser/test env the invoke import is mocked via __TAURI__ check.
 */

// ── Types (mirror Rust structs) ────────────────────────────────────────────

export interface SemanticEntry {
  id: string;
  timestamp: number;
  type: 'fact' | 'pattern' | 'error' | 'architecture' | string;
  content: string;
  tags: string[];
  score?: number;
}

export interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: string;
  tags: string[];
}

export interface WorkingState {
  goals: string[];
  activeFiles: string[];
  recentErrors: string[];
}

export interface MemoryStats {
  project_hash: string;
  semantic_count: number;
  episode_count: number;
  working_goals: number;
}

// ── Invoke helper — falls back in non-Tauri context ───────────────────────

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Tauri context: window.__TAURI_INTERNALS__ is injected at runtime
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__']) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }
  // Browser-dev / Vitest stub — return sensible defaults
  const stubs: Record<string, unknown> = {
    project_hash: 'devcafe123456',
    load_semantic: [],
    load_episodes: [],
    load_working: { goals: [], activeFiles: [], recentErrors: [] },
    get_memory_stats: { project_hash: 'devcafe123456', semantic_count: 0, episode_count: 0, working_goals: 0 },
    list_projects: [],
    search_memory: [],
    chat: '(stub) timps-server not running in dev mode',
    store_memory: undefined,
    delete_memory: 0,
  };
  return Promise.resolve(stubs[cmd] as T);
}

// ── API ────────────────────────────────────────────────────────────────────

export const api = {
  projectHash: (projectPath: string) =>
    invoke<string>('project_hash', { projectPath }),

  loadSemantic: (projectPath: string) =>
    invoke<SemanticEntry[]>('load_semantic', { projectPath }),

  loadEpisodes: (projectPath: string, count = 50) =>
    invoke<EpisodicEntry[]>('load_episodes', { projectPath, count }),

  loadWorking: (projectPath: string) =>
    invoke<WorkingState>('load_working', { projectPath }),

  getMemoryStats: (projectPath: string) =>
    invoke<MemoryStats>('get_memory_stats', { projectPath }),

  listProjects: () =>
    invoke<string[]>('list_projects'),

  searchMemory: (projectPath: string, query: string, limit = 20) =>
    invoke<SemanticEntry[]>('search_memory', { projectPath, query, limit }),

  chat: (prompt: string, projectPath?: string, provider?: string) =>
    invoke<string>('chat', { prompt, projectPath, provider }),

  storeMemory: (
    projectPath: string,
    key: string,
    value: string,
    importance: number,
    tags: string[],
  ) => invoke<void>('store_memory', { projectPath, key, value, importance, tags }),

  deleteMemory: (projectPath: string, key: string) =>
    invoke<number>('delete_memory', { projectPath, key }),
};
