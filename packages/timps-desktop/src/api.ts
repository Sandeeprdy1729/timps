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

export interface KnowledgeNode {
  id: string;
  entity: string;
  entityType: string;
  attributes: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeEdge {
  id: string;
  subject: string;
  relation: string;
  object: string;
  weight: number;
  timestamp: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface LensLink {
  id: string;
  url: string;
  link_type: 'github' | 'huggingface' | string;
  title: string | null;
  timestamp: number;
  analyzed: boolean;
  analysis: string | null;
}

export interface GitHubMeta {
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  open_issues: number;
  topics: string[];
  updated_at: string;
  default_branch: string;
  license: string | null;
}

export interface HuggingFaceMeta {
  model_id: string;
  author: string | null;
  downloads: number | null;
  likes: number | null;
  tags: string[];
  pipeline_tag: string | null;
  library_name: string | null;
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
    chat: '(stub) Ollama not available in dev mode',
    chatStream: undefined,
    listOllamaModels: [],
    store_memory: undefined,
    delete_memory: 0,
    passive_store: 'stub_id',
    store_episode: undefined,
    enable_autostart: undefined,
    disable_autostart: undefined,
    is_autostart_enabled: false,
    start_clipboard_watcher: undefined,
    stop_clipboard_watcher: undefined,
    run_background_summarizer: 0,
    check_proactive_notifications: [],
    load_knowledge_graph: { nodes: [], edges: [] },
    detect_link_type: 'other',
    save_to_lens_queue: 'stub_lens_id',
    get_lens_queue: [],
    remove_from_lens_queue: undefined,
    mark_lens_analyzed: undefined,
    get_lens_history: [],
    fetch_github_meta: null,
    fetch_hf_meta: null,
    analyze_lens_link: '(stub) TIMPS server not running in dev mode',
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

  loadKnowledgeGraph: (projectPath: string) =>
    invoke<KnowledgeGraph>('load_knowledge_graph', { projectPath }),

  getMemoryStats: (projectPath: string) =>
    invoke<MemoryStats>('get_memory_stats', { projectPath }),

  listProjects: () =>
    invoke<string[]>('list_projects'),

  searchMemory: (projectPath: string, query: string, limit = 20) =>
    invoke<SemanticEntry[]>('search_memory', { projectPath, query, limit }),

  /** Chat with Ollama — returns full response text. Wraps streaming events. */
  chat: (prompt: string, projectPath?: string, model?: string): Promise<string> =>
    new Promise((resolve, reject) => {
      api.chatStream(prompt, {
        onDone: (text) => resolve(text),
        onError: (msg) => reject(new Error(msg)),
      }, model, projectPath);
    }),

  /** Chat with Ollama via streaming events. Calls invoke('chat') then
   *  listens for chat:token / chat:done / chat:error events on the Tauri
   *  event bus. Returns an unsubscribe function. */
  chatStream: (
    prompt: string,
    callbacks: {
      onToken?: (token: string) => void;
      onDone?: (text: string, inputTokens: number, outputTokens: number) => void;
      onError?: (message: string) => void;
    },
    model?: string,
    projectPath?: string,
  ): (() => void) => {
    let unlistenToken: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    // Register listeners FIRST, then invoke (avoid race)
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      unlistenToken = await listen('chat:token', (event) => {
        const payload = event.payload as { token: string };
        callbacks.onToken?.(payload.token);
      });
      unlistenDone = await listen('chat:done', (event) => {
        const payload = event.payload as { text: string; inputTokens: number; outputTokens: number };
        callbacks.onDone?.(payload.text, payload.inputTokens, payload.outputTokens);
      });
      unlistenError = await listen('chat:error', (event) => {
        const payload = event.payload as { message: string };
        callbacks.onError?.(payload.message);
      });

      // Start the Ollama chat (fires events)
      invoke<void>('chat', { prompt, model: model ?? null, projectPath: projectPath ?? null })
        .catch((err) => callbacks.onError?.(String(err)));
    });

    return () => {
      unlistenToken?.();
      unlistenDone?.();
      unlistenError?.();
    };
  },

  /** List Ollama models available locally. */
  listOllamaModels: () =>
    invoke<string[]>('list_ollama_models'),

  storeMemory: (
    projectPath: string,
    key: string,
    value: string,
    importance: number,
    tags: string[],
  ) => invoke<void>('store_memory', { projectPath, key, value, importance, tags }),

  deleteMemory: (projectPath: string, key: string) =>
    invoke<number>('delete_memory', { projectPath, key }),

  // ── Passive background learning ──────────────────────────────────────────

  /** Store a passive observation (chat message, typed input, etc.) silently. */
  passiveStore: (
    projectPath: string,
    content: string,
    kind = 'observation',
    tags: string[] = [],
  ) => invoke<string>('passive_store', { projectPath, content, kind, tags }),

  /** Append an episodic memory entry (conversation summary) to episodes.jsonl */
  storeEpisode: (
    projectPath: string,
    summary: string,
    outcome: string,
    tags: string[] = [],
  ) => invoke<void>('store_episode', { projectPath, summary, outcome, tags }),

  // ── Autostart (launch at login) ──────────────────────────────────────────

  enableAutostart: () => invoke<void>('enable_autostart'),
  disableAutostart: () => invoke<void>('disable_autostart'),
  isAutostartEnabled: () => invoke<boolean>('is_autostart_enabled'),

  // ── Clipboard watcher (opt-in) ───────────────────────────────────────────

  /** Start watching the clipboard for copied text. Captured clips go into passive memory. */
  startClipboardWatcher: (projectPath: string) =>
    invoke<void>('start_clipboard_watcher', { projectPath }),

  /** Stop the clipboard watcher. */
  stopClipboardWatcher: () =>
    invoke<void>('stop_clipboard_watcher'),

  // ── Background summarizer ────────────────────────────────────────────────

  /** Extract patterns from recent episodes and store as synthesized semantic facts.
   *  Returns the number of new facts created. */
  runBackgroundSummarizer: (projectPath: string) =>
    invoke<number>('run_background_summarizer', { projectPath }),

  // ── Proactive notifications ──────────────────────────────────────────────

  /** Scan memory and return notification items worth surfacing to the user. */
  checkProactiveNotifications: (projectPath: string) =>
    invoke<Array<{ title: string; body: string; kind: string }>>('check_proactive_notifications', { projectPath }),

  // ── Lens — frictionless link analysis ───────────────────────────────────

  detectLinkType: (url: string) =>
    invoke<string>('detect_link_type', { url }),

  saveToLensQueue: (url: string, linkType: string, title?: string) =>
    invoke<string>('save_to_lens_queue', { url, linkType, title: title ?? null }),

  getLensQueue: () =>
    invoke<LensLink[]>('get_lens_queue'),

  removeFromLensQueue: (id: string) =>
    invoke<void>('remove_from_lens_queue', { id }),

  markLensAnalyzed: (id: string, analysis: string) =>
    invoke<void>('mark_lens_analyzed', { id, analysis }),

  getLensHistory: (days = 7) =>
    invoke<LensLink[]>('get_lens_history', { days }),

  fetchGithubMeta: (url: string) =>
    invoke<GitHubMeta>('fetch_github_meta', { url }),

  fetchHfMeta: (url: string) =>
    invoke<HuggingFaceMeta>('fetch_hf_meta', { url }),

  analyzeLensLink: (url: string, linkType: string, metadataJson: string, extraPrompt?: string) =>
    invoke<string>('analyze_lens_link', { url, linkType, metadataJson, extraPrompt: extraPrompt ?? null }),
};
