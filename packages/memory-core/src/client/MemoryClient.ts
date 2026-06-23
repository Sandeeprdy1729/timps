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
import { MemoryGrpcClient } from './grpc';
import type { GrpcClientOptions } from './grpc';

export type TransportMode = 'grpc' | 'rest' | 'auto';

export interface MemoryClientOptions {
  /** MemoryServer base URL (default: http://localhost:4100) */
  baseUrl?: string;
  /** Auth token. If not provided, anonymous access is used. */
  token?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** WebSocket path for real-time events (default: /ws) */
  wsPath?: string;
  /** Transport mode: 'grpc' (default), 'rest' (fallback), or 'auto' (try gRPC, fallback to REST) */
  transport?: TransportMode;
  /** gRPC server address (default: localhost:4101) */
  grpcAddress?: string;
}

/**
 * Dual-transport client for the MemoryServer.
 *
 * Uses gRPC by default for low-latency binary communication.
 * Falls back to REST if gRPC is unavailable.
 * WebSocket is kept for event subscriptions.
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
  private transport: TransportMode;
  private grpcClient: MemoryGrpcClient | null = null;
  private grpcFailed = false;

  constructor(options: MemoryClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:4100';
    this.token = options.token;
    this.timeout = options.timeout ?? 30000;
    this.wsPath = options.wsPath ?? '/ws';
    this.transport = options.transport ?? 'grpc';

    // Initialize gRPC client if transport allows
    if (this.transport !== 'rest') {
      try {
        this.grpcClient = new MemoryGrpcClient({
          address: options.grpcAddress ?? 'localhost:4101',
          token: this.token,
          timeout: this.timeout,
        });
      } catch {
        this.grpcFailed = true;
      }
    }
  }

  private get useGrpc(): boolean {
    if (this.transport === 'rest') return false;
    if (this.transport === 'grpc') return this.grpcClient !== null;
    // 'auto' mode: try gRPC, fall back to REST
    return this.grpcClient !== null && !this.grpcFailed;
  }

  private async grpcOrRest<T>(
    grpcFn: () => Promise<T>,
    restFn: () => Promise<T>,
  ): Promise<T> {
    if (this.useGrpc) {
      try {
        return await grpcFn();
      } catch (err: any) {
        this.grpcFailed = true;
        console.warn(`[MemoryClient] gRPC failed (${err.message}), falling back to REST`);
        return restFn();
      }
    }
    return restFn();
  }

  /** Switch transport mode at runtime */
  setTransport(mode: TransportMode): void {
    this.transport = mode;
    if (mode !== 'rest' && !this.grpcClient && !this.grpcFailed) {
      try {
        this.grpcClient = new MemoryGrpcClient({
          address: 'localhost:4101',
          token: this.token,
          timeout: this.timeout,
        });
      } catch {
        this.grpcFailed = true;
      }
    }
  }

  /** Get the underlying gRPC client for direct streaming access */
  getGrpcClient(): MemoryGrpcClient | null {
    return this.grpcClient;
  }

  /** Ping both transports and return status */
  async ping(): Promise<{ grpc: boolean; rest: boolean }> {
    const results = { grpc: false, rest: false };
    if (this.grpcClient) {
      results.grpc = await this.grpcClient.ping();
    }
    try {
      await this.health();
      results.rest = true;
    } catch {
      results.rest = false;
    }
    return results;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** Set or update the auth token */
  setToken(token: string | undefined): void {
    this.token = token;
    // Update gRPC metadata
    if (this.grpcClient) {
      this.grpcClient = new MemoryGrpcClient({
        address: 'localhost:4101',
        token: this.token,
        timeout: this.timeout,
      });
    }
  }

  /** Authenticate with userId + secret and store the returned token */
  async authenticate(userId: string, secret: string): Promise<string> {
    const res = await this.fetch('/auth/token', {
      method: 'POST',
      body: { userId, secret },
    });
    this.token = res.token;
    // Re-init gRPC client with token
    if (this.grpcClient) {
      this.grpcClient = new MemoryGrpcClient({
        address: 'localhost:4101',
        token: this.token,
        timeout: this.timeout,
      });
    }
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

  // ── Core Memory Operations ──────────────────────────────────────────────

  /** Store a semantic memory entry */
  async store(entry: { content: string; type?: string; tags?: string[] }): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.store(entry.content, entry.type, entry.tags).then(() => {}),
        () => this.fetch('/memory/store', { method: 'POST', body: entry }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/store', { method: 'POST', body: entry });
    }
  }

  /** Store an episode */
  async storeEpisode(episode: Omit<EpisodicEntry, 'id'>): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.storeEpisode(episode as any).then(() => {}),
        () => this.fetch('/memory/episode', { method: 'POST', body: episode }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/episode', { method: 'POST', body: episode });
    }
  }

  /** Recall memories matching a query */
  async recall(query: string, options?: SearchOptions): Promise<ScoredMemoryEntry[]> {
    if (this.useGrpc && this.grpcClient) {
      const res = await this.grpcOrRest(
        () => this.grpcClient!.recall(query, options as any),
        () => this.fetch('/memory/recall', { method: 'POST', body: { query, ...options } }),
      );
      // Normalize gRPC response to ScoredMemoryEntry[]
      if (res.results) {
        return res.results.map((r: any) => ({
          id: r.entry?.id ?? '',
          timestamp: r.entry?.timestamp ?? 0,
          type: r.entry?.type ?? 'fact',
          content: r.entry?.content ?? '',
          tags: r.entry?.tags ?? [],
          score: r.entry?.score ?? 0,
          calibratedConfidence: r.calibrated_confidence ?? 0.5,
          falseMemoryRisk: r.false_memory_risk ?? 0,
          sourceReliability: r.source_reliability ?? 0.5,
          sourceKind: r.source_kind ?? 'unknown',
          contextBoost: r.context_boost ?? 0,
          rehearsalBoost: r.rehearsal_boost ?? 0,
        }));
      }
      return [];
    }
    const res = await this.fetch('/memory/recall', {
      method: 'POST',
      body: { query, ...options },
    });
    return res.results ?? [];
  }

  /** Get memory statistics */
  async getStats(): Promise<MemoryStats> {
    return this.grpcOrRest(
      async () => {
        const r = await this.grpcClient!.getStats();
        return {
          semanticCount: r.semantic_count,
          episodeCount: r.episode_count,
          workingFiles: r.working_files,
          workingPatterns: r.working_patterns,
        };
      },
      () => this.fetch('/memory/stats'),
    );
  }

  /** Get working memory state */
  async getWorkingMemory(): Promise<{ currentGoal?: string; activeFiles: string[]; recentErrors: string[]; discoveredPatterns: string[] }> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.getWorking(),
        () => this.fetch('/memory/working'),
      );
      return {
        currentGoal: r.current_goal || undefined,
        activeFiles: r.active_files ?? [],
        recentErrors: r.recent_errors ?? [],
        discoveredPatterns: r.discovered_patterns ?? [],
      };
    }
    return this.fetch('/memory/working');
  }

  /** Set current goal */
  async setGoal(goal: string): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.setGoal(goal).then(() => {}),
        () => this.fetch('/memory/working/goal', { method: 'POST', body: { goal } }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/working/goal', { method: 'POST', body: { goal } });
    }
  }

  /** Track active file */
  async trackFile(filePath: string): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.trackFile(filePath).then(() => {}),
        () => this.fetch('/memory/working/file', { method: 'POST', body: { filePath } }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/working/file', { method: 'POST', body: { filePath } });
    }
  }

  /** Track error */
  async trackError(error: string): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.trackError(error).then(() => {}),
        () => this.fetch('/memory/working/error', { method: 'POST', body: { error } }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/working/error', { method: 'POST', body: { error } });
    }
  }

  /** Clear working memory */
  async clearWorking(): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.clearWorking().then(() => {}),
        () => this.fetch('/memory/working/clear', { method: 'POST' }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/working/clear', { method: 'POST' });
    }
  }

  /** Get context string for prompt injection */
  async getContextString(task?: string): Promise<string> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.getContext(task),
        () => this.fetch('/memory/context', { method: 'POST', body: { task: task ?? '' } }),
      );
      return r.context;
    }
    const res = await this.fetch('/memory/context', { method: 'POST', body: { task: task ?? '' } });
    return res.context;
  }

  /** Load recent episodes */
  async loadEpisodes(count?: number): Promise<EpisodicEntry[]> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.loadEpisodes(count),
        () => this.fetch(`/memory/episodes?count=${count ?? 10}`),
      );
      return (r.episodes ?? []).map((e: any) => ({
        id: e.id,
        timestamp: e.timestamp,
        summary: e.summary,
        outcome: e.outcome,
        durationMs: e.duration_ms || undefined,
        errorCount: e.error_count || undefined,
        tags: e.tags ?? [],
      }));
    }
    const res = await this.fetch(`/memory/episodes?count=${count ?? 10}`);
    return res.episodes ?? [];
  }

  /** Extract facts from a conversation turn */
  async extractFacts(userMessage: string, assistantResponse: string): Promise<void> {
    if (this.useGrpc && this.grpcClient) {
      await this.grpcOrRest(
        () => this.grpcClient!.extractFacts(userMessage, assistantResponse).then(() => {}),
        () => this.fetch('/memory/extract-facts', { method: 'POST', body: { userMessage, assistantResponse } }).then(() => {}),
      );
    } else {
      await this.fetch('/memory/extract-facts', { method: 'POST', body: { userMessage, assistantResponse } });
    }
  }

  /** Consolidate (deduplicate) semantic entries */
  async consolidate(): Promise<number> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.consolidate(),
        () => this.fetch('/memory/consolidate', { method: 'POST' }),
      );
      return r.skipped_duplicates ?? r.duplicatesRemoved ?? 0;
    }
    const res = await this.fetch('/memory/consolidate', { method: 'POST' });
    return res.duplicatesRemoved ?? 0;
  }

  /** Export all memory as a pack */
  async exportMemory(): Promise<MemoryPack> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.exportMemory(),
        () => this.fetch('/memory/export'),
      );
      return {
        version: r.version ?? '1.0',
        projectHash: r.project_hash ?? '',
        exportedAt: r.exported_at ?? Date.now(),
        working: {
          currentGoal: r.working?.current_goal || undefined,
          activeFiles: r.working?.active_files ?? [],
          recentErrors: r.working?.recent_errors ?? [],
          discoveredPatterns: r.working?.discovered_patterns ?? [],
        },
        episodic: (r.episodic ?? []).map((e: any) => ({
          id: e.id, timestamp: e.timestamp, summary: e.summary,
          outcome: e.outcome, durationMs: e.duration_ms, errorCount: e.error_count, tags: e.tags,
        })),
        semantic: (r.semantic ?? []).map((e: any) => ({
          id: e.id, timestamp: e.timestamp, type: e.type,
          content: e.content, tags: e.tags, score: e.score,
        })),
        signature: r.signature ?? '',
      };
    }
    return this.fetch('/memory/export');
  }

  /** Import a memory pack */
  async importMemory(pack: MemoryPack): Promise<MergeResult> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.importMemory(pack),
        () => this.fetch('/memory/import', { method: 'POST', body: pack }),
      );
    }
    return this.fetch('/memory/import', { method: 'POST', body: pack });
  }

  /** Snapshot current memory */
  async snapshot(branchName: string): Promise<MemorySnapshot> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.snapshot(branchName),
        () => this.fetch('/memory/snapshot', { method: 'POST', body: { branchName } }),
      );
      return {
        branchName: r.branch_name,
        createdAt: r.created_at,
        pack: r.pack,
      };
    }
    return this.fetch('/memory/snapshot', { method: 'POST', body: { branchName } });
  }

  /** Delete memory by id or content match */
  async deleteMemory(idOrContent: { id?: string; content?: string }): Promise<number> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.deleteMemory(idOrContent.id, idOrContent.content),
        () => this.fetch('/memory/delete', { method: 'DELETE', body: idOrContent }),
      );
      return r.deleted ?? 0;
    }
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
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.checkContradiction(text, autoStore),
        () => this.fetch('/memory/intelligence/contradiction', { method: 'POST', body: { text, autoStore } }),
      );
    }
    return this.fetch('/memory/intelligence/contradiction', { method: 'POST', body: { text, autoStore } });
  }

  /** Get burnout risk analysis */
  async analyzeBurnout(): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.analyzeBurnout(),
        () => this.fetch('/memory/intelligence/burnout'),
      );
    }
    return this.fetch('/memory/intelligence/burnout');
  }

  /** Check bug pattern match */
  async checkBugPattern(context: string): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.checkBugPattern(context),
        () => this.fetch('/memory/intelligence/bug-pattern', { method: 'POST', body: { context } }),
      );
    }
    return this.fetch('/memory/intelligence/bug-pattern', { method: 'POST', body: { context } });
  }

  /** Check tech debt pattern */
  async checkTechDebt(pattern: string, projectId?: string): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.checkTechDebt(pattern, projectId),
        () => this.fetch('/memory/intelligence/tech-debt', { method: 'POST', body: { pattern, projectId } }),
      );
    }
    return this.fetch('/memory/intelligence/tech-debt', { method: 'POST', body: { pattern, projectId } });
  }

  /** Detect architecture drift */
  async detectArchitectureDrift(currentPatterns?: string[], projectId?: string): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.detectArchitectureDrift(currentPatterns, projectId),
        () => this.fetch('/memory/intelligence/architecture-drift', { method: 'POST', body: { currentPatterns, projectId } }),
      );
    }
    return this.fetch('/memory/intelligence/architecture-drift', { method: 'POST', body: { currentPatterns, projectId } });
  }

  /** Learn a pattern */
  async learnPattern(observation: string, tags?: string[]): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.learnPattern(observation, tags),
        () => this.fetch('/memory/intelligence/learn-pattern', { method: 'POST', body: { observation, tags } }),
      );
    }
    return this.fetch('/memory/intelligence/learn-pattern', { method: 'POST', body: { observation, tags } });
  }

  // ── Forge layer API ──────────────────────────────────────────────────────

  /** Verify engram chain integrity */
  async verifyEngramChain(): Promise<{ valid: boolean; brokenAt?: number }> {
    if (this.useGrpc && this.grpcClient) {
      const r = await this.grpcOrRest(
        () => this.grpcClient!.verifyEngramChain(),
        () => this.fetch('/memory/forge/engram/verify'),
      );
      return { valid: r.valid ?? false, brokenAt: r.broken_at >= 0 ? r.broken_at : undefined };
    }
    return this.fetch('/memory/forge/engram/verify');
  }

  /** Run consolidation engine */
  async runConsolidation(opts?: { sinceMs?: number; dryRun?: boolean }): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.runConsolidation(opts),
        () => this.fetch('/memory/forge/consolidate', { method: 'POST', body: opts }),
      );
    }
    return this.fetch('/memory/forge/consolidate', { method: 'POST', body: opts });
  }

  /** Run synaptic pruner sweep */
  async runPruneSweep(): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.runPruneSweep(),
        () => this.fetch('/memory/forge/prune', { method: 'POST' }),
      );
    }
    return this.fetch('/memory/forge/prune', { method: 'POST' });
  }

  /** Get provenance for a memory */
  async getProvenance(id: string): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.getProvenance(id),
        () => this.fetch(`/memory/forge/provenance/${id}`),
      );
    }
    return this.fetch(`/memory/forge/provenance/${id}`);
  }

  /** Check content against constitutional guard */
  async guardCheck(content: string): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.guardCheck(content),
        () => this.fetch('/memory/forge/guard', { method: 'POST', body: { content } }),
      );
    }
    return this.fetch('/memory/forge/guard', { method: 'POST', body: { content } });
  }

  /** Run full memory audit */
  async runAudit(): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.runAudit(),
        () => this.fetch('/memory/forge/audit'),
      );
    }
    return this.fetch('/memory/forge/audit');
  }

  /** Reveal memory bias */
  async revealBias(): Promise<any> {
    if (this.useGrpc && this.grpcClient) {
      return this.grpcOrRest(
        () => this.grpcClient!.revealBias(),
        () => this.fetch('/memory/forge/bias'),
      );
    }
    return this.fetch('/memory/forge/bias');
  }

  // ── gRPC Streaming API ───────────────────────────────────────────────────

  /**
   * Open a server-streaming context stream (gRPC only).
   * Server pushes MemoryInsight objects as they become available.
   * Falls back to WebSocket if gRPC is unavailable.
   */
  streamContext(
    projectId: string,
    options: { userId?: string; layers?: string[]; minConfidence?: number } = {},
    onInsight: (insight: any) => void,
    onError?: (err: Error) => void,
  ): () => void {
    if (this.grpcClient && !this.grpcFailed) {
      return this.grpcClient.streamContext(projectId, options, onInsight, onError);
    }
    // Fallback: use WebSocket
    console.warn('[MemoryClient] gRPC unavailable for streamContext, WebSocket fallback has no context push. Connect via WebSocket and listen for insight events.');
    this.connectWs();
    const unsub = this.on('insight', (data: any) => {
      onInsight({
        type: 'insight',
        layer: 'ws',
        title: data.payload?.title ?? 'WebSocket Insight',
        description: data.payload?.description ?? '',
        confidence: 0.5,
        timestamp: Date.now(),
        metadata: data.payload ?? {},
      });
    });
    return () => { unsub(); };
  }

  /**
   * Open a bidirectional agent stream (gRPC only).
   * Send AgentEvent objects and receive AgentStreamMessage objects.
   */
  agentStream(
    onMessage: (msg: any) => void,
    onError?: (err: Error) => void,
  ): { send: (event: any) => boolean; cancel: () => void } | null {
    if (this.grpcClient && !this.grpcFailed) {
      return this.grpcClient.agentStream(onMessage, onError);
    }
    console.warn('[MemoryClient] gRPC unavailable for agentStream. Connect via gRPC transport.');
    return null;
  }

  /**
   * Batch ingest episodes via gRPC client streaming.
   */
  async ingestEpisodes(episodes: any[]): Promise<{ accepted: number; deduplicated: number; errors: number }> {
    if (this.grpcClient && !this.grpcFailed) {
      try {
        return await this.grpcClient.ingestEpisodes(episodes);
      } catch (err: any) {
        this.grpcFailed = true;
        console.warn(`[MemoryClient] gRPC ingestEpisodes failed (${err.message}), falling back to REST`);
      }
    }
    // Fallback: store episodes one by one via REST
    let accepted = 0;
    let errors = 0;
    for (const ep of episodes) {
      try {
        await this.storeEpisode(ep);
        accepted++;
      } catch {
        errors++;
      }
    }
    return { accepted, deduplicated: 0, errors };
  }

  // ── WebSocket ────────────────────────────────────────────────────────────

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

  on(eventType: string, listener: (data: any) => void): () => void {
    if (!this.wsListeners.has(eventType)) {
      this.wsListeners.set(eventType, new Set());
    }
    this.wsListeners.get(eventType)!.add(listener);
    return () => {
      this.wsListeners.get(eventType)?.delete(listener);
    };
  }

  get isWsConnected(): boolean {
    return this.wsConnected;
  }
}
