import type {
  MemoryEntry,
  EpisodicEntry,
  SearchOptions,
  ScoredMemoryEntry,
  MemoryPack,
  MemorySnapshot,
  MergeResult,
  MemoryStats,
} from '../types';

export interface MemoryClientOptions {
  /** MemoryServer base URL (default: http://localhost:4100) */
  baseUrl?: string;
  /** Auth token. If not provided, anonymous access is used. */
  token?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** WebSocket path for real-time events (default: /ws) */
  wsPath?: string;
}

/**
 * Thin client for the MemoryServer.
 *
 * This is the ONLY class that CLI, MCP, web dashboard, and mobile
 * should use to talk to memory. It never imports MemoryEngine directly.
 */
export class MemoryClient {
  private baseUrl: string;
  private token: string | undefined;
  private timeout: number;
  private ws: WebSocket | null = null;
  private wsListeners = new Map<string, Set<(data: any) => void>>();
  private wsConnected = false;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsPath: string;

  constructor(options: MemoryClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:4100';
    this.token = options.token;
    this.timeout = options.timeout ?? 30000;
    this.wsPath = options.wsPath ?? '/ws';
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** Set or update the auth token */
  setToken(token: string | undefined): void {
    this.token = token;
  }

  /** Authenticate with userId + secret and store the returned token */
  async authenticate(userId: string, secret: string): Promise<string> {
    const res = await this.fetch('/auth/token', {
      method: 'POST',
      body: { userId, secret },
    });
    this.token = res.token;
    return res.token;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  private async fetch(path: string, opts: { method?: string; body?: unknown } = {}): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: opts.method ?? 'GET',
        headers: this.headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`MemoryServer ${res.status}: ${text}`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ── REST API ─────────────────────────────────────────────────────────────

  /** Store a semantic memory entry */
  async store(entry: { content: string; type?: string; tags?: string[] }): Promise<void> {
    await this.fetch('/memory/store', { method: 'POST', body: entry });
  }

  /** Store an episode */
  async storeEpisode(episode: Omit<EpisodicEntry, 'id'>): Promise<void> {
    await this.fetch('/memory/episode', { method: 'POST', body: episode });
  }

  /** Recall memories matching a query */
  async recall(query: string, options?: SearchOptions): Promise<ScoredMemoryEntry[]> {
    const res = await this.fetch('/memory/recall', {
      method: 'POST',
      body: { query, ...options },
    });
    return res.results ?? [];
  }

  /** Get memory statistics */
  async getStats(): Promise<MemoryStats> {
    return this.fetch('/memory/stats');
  }

  /** Get working memory state */
  async getWorkingMemory(): Promise<{ currentGoal?: string; activeFiles: string[]; recentErrors: string[]; discoveredPatterns: string[] }> {
    return this.fetch('/memory/working');
  }

  /** Set current goal */
  async setGoal(goal: string): Promise<void> {
    await this.fetch('/memory/working/goal', { method: 'POST', body: { goal } });
  }

  /** Track active file */
  async trackFile(filePath: string): Promise<void> {
    await this.fetch('/memory/working/file', { method: 'POST', body: { filePath } });
  }

  /** Track error */
  async trackError(error: string): Promise<void> {
    await this.fetch('/memory/working/error', { method: 'POST', body: { error } });
  }

  /** Clear working memory */
  async clearWorking(): Promise<void> {
    await this.fetch('/memory/working/clear', { method: 'POST' });
  }

  /** Get context string for prompt injection */
  async getContextString(task?: string): Promise<string> {
    const res = await this.fetch('/memory/context', { method: 'POST', body: { task: task ?? '' } });
    return res.context;
  }

  /** Load recent episodes */
  async loadEpisodes(count?: number): Promise<EpisodicEntry[]> {
    const res = await this.fetch(`/memory/episodes?count=${count ?? 10}`);
    return res.episodes ?? [];
  }

  /** Extract facts from a conversation turn */
  async extractFacts(userMessage: string, assistantResponse: string): Promise<void> {
    await this.fetch('/memory/extract-facts', {
      method: 'POST',
      body: { userMessage, assistantResponse },
    });
  }

  /** Consolidate (deduplicate) semantic entries */
  async consolidate(): Promise<number> {
    const res = await this.fetch('/memory/consolidate', { method: 'POST' });
    return res.duplicatesRemoved ?? 0;
  }

  /** Export all memory as a pack */
  async exportMemory(): Promise<MemoryPack> {
    return this.fetch('/memory/export');
  }

  /** Import a memory pack */
  async importMemory(pack: MemoryPack): Promise<MergeResult> {
    return this.fetch('/memory/import', { method: 'POST', body: pack });
  }

  /** Snapshot current memory */
  async snapshot(branchName: string): Promise<MemorySnapshot> {
    return this.fetch('/memory/snapshot', { method: 'POST', body: { branchName } });
  }

  /** Delete memory by id or content match */
  async deleteMemory(idOrContent: { id?: string; content?: string }): Promise<number> {
    const res = await this.fetch('/memory/delete', { method: 'DELETE', body: idOrContent });
    return res.deleted ?? 0;
  }

  /** Check health */
  async health(): Promise<{ status: string; timestamp: number }> {
    return this.fetch('/health');
  }

  // ── Intelligence API ─────────────────────────────────────────────────────

  /** Check if a statement contradicts stored positions */
  async checkContradiction(text: string, autoStore = true): Promise<any> {
    return this.fetch('/memory/intelligence/contradiction', {
      method: 'POST',
      body: { text, autoStore },
    });
  }

  /** Get burnout risk analysis */
  async analyzeBurnout(): Promise<any> {
    return this.fetch('/memory/intelligence/burnout');
  }

  /** Check bug pattern match */
  async checkBugPattern(context: string): Promise<any> {
    return this.fetch('/memory/intelligence/bug-pattern', {
      method: 'POST',
      body: { context },
    });
  }

  /** Check tech debt pattern */
  async checkTechDebt(pattern: string, projectId?: string): Promise<any> {
    return this.fetch('/memory/intelligence/tech-debt', {
      method: 'POST',
      body: { pattern, projectId },
    });
  }

  /** Detect architecture drift */
  async detectArchitectureDrift(currentPatterns?: string[], projectId?: string): Promise<any> {
    return this.fetch('/memory/intelligence/architecture-drift', {
      method: 'POST',
      body: { currentPatterns, projectId },
    });
  }

  /** Learn a pattern */
  async learnPattern(observation: string, tags?: string[]): Promise<any> {
    return this.fetch('/memory/intelligence/learn-pattern', {
      method: 'POST',
      body: { observation, tags },
    });
  }

  // ── Forge layer API ──────────────────────────────────────────────────────

  /** Verify engram chain integrity */
  async verifyEngramChain(): Promise<{ valid: boolean; brokenAt?: number }> {
    return this.fetch('/memory/forge/engram/verify');
  }

  /** Run consolidation engine */
  async runConsolidation(opts?: { sinceMs?: number; dryRun?: boolean }): Promise<any> {
    return this.fetch('/memory/forge/consolidate', { method: 'POST', body: opts });
  }

  /** Run synaptic pruner sweep */
  async runPruneSweep(): Promise<any> {
    return this.fetch('/memory/forge/prune', { method: 'POST' });
  }

  /** Get provenance for a memory */
  async getProvenance(id: string): Promise<any> {
    return this.fetch(`/memory/forge/provenance/${id}`);
  }

  /** Check content against constitutional guard */
  async guardCheck(content: string): Promise<any> {
    return this.fetch('/memory/forge/guard', { method: 'POST', body: { content } });
  }

  /** Run full memory audit */
  async runAudit(): Promise<any> {
    return this.fetch('/memory/forge/audit');
  }

  /** Reveal memory bias */
  async revealBias(): Promise<any> {
    return this.fetch('/memory/forge/bias');
  }

  // ── WebSocket ────────────────────────────────────────────────────────────

  /**
   * Connect to the WebSocket event stream.
   * Events are delivered to listeners registered via on().
   */
  connectWs(): void {
    if (this.wsConnected || this.ws) return;

    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    const params = new URLSearchParams();
    if (this.token) params.set('token', this.token);

    let WS: any;
    try {
      WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');
    } catch {
      console.warn('[MemoryClient] WebSocket not available in this environment');
      return;
    }

    const ws: WebSocket = new WS(`${wsUrl}${this.wsPath}?${params}`);
    this.ws = ws;

    ws.onopen = () => {
      this.wsConnected = true;
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        const listeners = this.wsListeners.get(data.type);
        if (listeners) {
          listeners.forEach(fn => fn(data));
        }
        const allListeners = this.wsListeners.get('*');
        if (allListeners) {
          allListeners.forEach(fn => fn(data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.wsConnected = false;
      this.ws = null;
      this.wsReconnectTimer = setTimeout(() => this.connectWs(), 5000);
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  /**
   * Disconnect from the WebSocket event stream.
   */
  disconnectWs(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
  }

  /**
   * Register a listener for a WebSocket event type.
   * Use '*' to listen for all events.
   */
  on(eventType: string, listener: (data: any) => void): () => void {
    if (!this.wsListeners.has(eventType)) {
      this.wsListeners.set(eventType, new Set());
    }
    this.wsListeners.get(eventType)!.add(listener);
    return () => {
      this.wsListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Check if WebSocket is currently connected.
   */
  get isWsConnected(): boolean {
    return this.wsConnected;
  }
}
