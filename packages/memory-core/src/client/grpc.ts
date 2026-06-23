import * as path from 'node:path';
import * as fs from 'node:fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

function findProtoFile(): string {
  const candidates = [
    path.resolve(__dirname, '../../proto/timps/memory/v1/memory.proto'),
    path.resolve(process.cwd(), 'proto/timps/memory/v1/memory.proto'),
    path.resolve(__dirname, '../../../proto/timps/memory/v1/memory.proto'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const PROTO_PATH = findProtoFile();

export interface GrpcClientOptions {
  /** gRPC server address (default: localhost:4101) */
  address?: string;
  /** Use insecure credentials (default: true) */
  insecure?: boolean;
  /** Auth token for interceptor */
  token?: string;
  /** Max message size in bytes (default: 4MB) */
  maxMessageLength?: number;
  /** Client-side timeout in ms for unary calls (default: 30000) */
  timeout?: number;
}

function loadClient(): any {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  return proto.timps.memory.v1;
}

export class MemoryGrpcClient {
  private client: any;
  private options: GrpcClientOptions;
  private metadata: grpc.Metadata;
  private deadline: number;

  constructor(options: GrpcClientOptions = {}) {
    this.options = {
      address: 'localhost:4101',
      insecure: true,
      timeout: 30000,
      ...options,
    };

    const proto = loadClient();
    const credentials = this.options.insecure
      ? grpc.credentials.createInsecure()
      : grpc.credentials.createSsl();

    this.client = new proto.MemoryService(
      this.options.address,
      credentials,
    );

    this.metadata = new grpc.Metadata();
    if (this.options.token) {
      this.metadata.set('authorization', `Bearer ${this.options.token}`);
    }

    this.deadline = this.options.timeout ?? 30000;
  }

  private getCallOptions(): grpc.CallOptions {
    return {
      deadline: Date.now() + this.deadline,
    };
  }

  private promisify<T>(method: string, request: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.client[method](request, this.metadata, this.getCallOptions(), (err: any, response: any) => {
        if (err) {
          reject(new Error(`gRPC ${method}: ${err.details ?? err.message}`));
        } else {
          resolve(response);
        }
      });
    });
  }

  close(): void {
    this.client.close();
  }

  // ── Core Memory Operations ──

  store(content: string, type?: string, tags?: string[]): Promise<{ status: string; kind: string }> {
    return this.promisify('Store', { content, type: type ?? 'fact', tags: tags ?? [] });
  }

  storeEpisode(episode: { summary: string; outcome: string; durationMs?: number; errorCount?: number; tags?: string[] }): Promise<{ status: string; kind: string }> {
    return this.promisify('StoreEpisode', {
      summary: episode.summary,
      outcome: episode.outcome,
      duration_ms: episode.durationMs ?? 0,
      error_count: episode.errorCount ?? 0,
      tags: episode.tags ?? [],
    });
  }

  recall(query: string, options?: { limit?: number; type?: string; tags?: string[]; minConfidence?: number; maxFalseMemoryRisk?: number }): Promise<any> {
    return this.promisify('Recall', {
      query,
      limit: options?.limit ?? 10,
      type: options?.type ?? '',
      tags: options?.tags ?? [],
      min_confidence: options?.minConfidence ?? 0,
      max_false_memory_risk: options?.maxFalseMemoryRisk ?? 1,
    });
  }

  getStats(): Promise<{ semantic_count: number; episode_count: number; working_files: number; working_patterns: number }> {
    return this.promisify('GetStats', {});
  }

  deleteMemory(id?: string, content?: string): Promise<{ status: string; deleted: number }> {
    return this.promisify('DeleteMemory', { id: id ?? '', content: content ?? '' });
  }

  getWorking(): Promise<{ current_goal: string; active_files: string[]; recent_errors: string[]; discovered_patterns: string[] }> {
    return this.promisify('GetWorking', {});
  }

  setGoal(goal: string): Promise<{ status: string; kind: string }> {
    return this.promisify('SetGoal', { goal });
  }

  trackFile(filePath: string): Promise<{ status: string; kind: string }> {
    return this.promisify('TrackFile', { file_path: filePath });
  }

  trackError(error: string): Promise<{ status: string; kind: string }> {
    return this.promisify('TrackError', { error });
  }

  clearWorking(): Promise<{ status: string; kind: string }> {
    return this.promisify('ClearWorking', {});
  }

  getContext(task?: string): Promise<{ context: string }> {
    return this.promisify('GetContext', { task: task ?? '' });
  }

  loadEpisodes(count?: number): Promise<{ episodes: any[]; count: number }> {
    return this.promisify('LoadEpisodes', { count: count ?? 10 });
  }

  extractFacts(userMessage: string, assistantResponse: string): Promise<{ status: string; kind: string }> {
    return this.promisify('ExtractFacts', { user_message: userMessage, assistant_response: assistantResponse });
  }

  consolidate(): Promise<{ added_semantic: number; added_episodic: number; skipped_duplicates: number }> {
    return this.promisify('Consolidate', {});
  }

  exportMemory(): Promise<any> {
    return this.promisify('ExportMemory', {});
  }

  importMemory(pack: any): Promise<{ added_semantic: number; added_episodic: number; skipped_duplicates: number }> {
    return this.promisify('ImportMemory', { pack });
  }

  snapshot(branchName: string): Promise<{ branch_name: string; created_at: number; pack: any }> {
    return this.promisify('Snapshot', { branch_name: branchName });
  }

  // ── Intelligence Operations ──

  checkContradiction(text: string, autoStore?: boolean): Promise<any> {
    return this.promisify('CheckContradiction', { text, auto_store: autoStore !== false });
  }

  analyzeBurnout(): Promise<{ risk_level: string; indicators: string[]; suggestion: string }> {
    return this.promisify('AnalyzeBurnout', {});
  }

  checkBugPattern(context: string): Promise<any> {
    return this.promisify('CheckBugPattern', { context });
  }

  checkTechDebt(pattern: string, projectId?: string): Promise<any> {
    return this.promisify('CheckTechDebt', { pattern, project_id: projectId ?? '' });
  }

  detectArchitectureDrift(currentPatterns?: string[], projectId?: string): Promise<any> {
    return this.promisify('DetectArchitectureDrift', {
      current_patterns: currentPatterns ?? [],
      project_id: projectId ?? '',
    });
  }

  learnPattern(observation: string, tags?: string[]): Promise<{ status: string; kind: string }> {
    return this.promisify('LearnPattern', { observation, tags: tags ?? [] });
  }

  // ── Forge Layer Operations ──

  verifyEngramChain(): Promise<{ valid: boolean; broken_at: number }> {
    return this.promisify('VerifyEngramChain', {});
  }

  runConsolidation(opts?: { sinceMs?: number; dryRun?: boolean }): Promise<any> {
    return this.promisify('RunConsolidation', {
      since_ms: opts?.sinceMs ?? 0,
      dry_run: opts?.dryRun ?? false,
    });
  }

  runPruneSweep(): Promise<{ entries_pruned: number }> {
    return this.promisify('RunPruneSweep', {});
  }

  getProvenance(id: string): Promise<any> {
    return this.promisify('GetProvenance', { id });
  }

  guardCheck(content: string): Promise<{ allowed: boolean; reason: string; json_payload: string }> {
    return this.promisify('GuardCheck', { content });
  }

  runAudit(): Promise<{ json_payload: string }> {
    return this.promisify('RunAudit', {});
  }

  revealBias(): Promise<{ json_payload: string }> {
    return this.promisify('RevealBias', {});
  }

  // ── Phase 2d: Conflict Resolution ──

  resolveConflict(conflictId: string, action: string, mergedContent?: string): Promise<any> {
    return this.promisify('ResolveConflict', {
      conflict_id: conflictId,
      action,
      merged_content: mergedContent ?? '',
      resolved_by: 'client',
    });
  }

  cancelConflict(conflictId: string): Promise<{ status: string; message: string }> {
    return this.promisify('CancelConflict', { conflict_id: conflictId });
  }

  listConflicts(): Promise<{ conflicts: any[] }> {
    return this.promisify('ListConflicts', {});
  }

  // ── Health ──

  health(): Promise<{ status: string; timestamp: number; engine: string; version: string }> {
    return this.promisify('Health', {});
  }

  // ── Streaming ──

  /**
   * Open a server-streaming context stream.
   * Server pushes MemoryInsight objects as they become available.
   * Returns a function to cancel the stream.
   */
  streamContext(
    projectId: string,
    options: { userId?: string; layers?: string[]; minConfidence?: number } = {},
    onInsight: (insight: any) => void,
    onError?: (err: Error) => void,
    onEnd?: () => void,
  ): () => void {
    const call = this.client.StreamContext({
      project_id: projectId,
      user_id: options.userId ?? '',
      layers: options.layers ?? [],
      min_confidence: options.minConfidence ?? 0,
    }, this.metadata);

    call.on('data', (insight: any) => {
      try {
        onInsight(insight);
      } catch { /* ignore handler errors */ }
    });

    call.on('error', (err: Error) => {
      if (onError) onError(err);
    });

    call.on('end', () => {
      if (onEnd) onEnd();
    });

    return () => call.cancel();
  }

  /**
   * Open a bidirectional agent stream.
   * Send AgentEvent objects and receive AgentStreamMessage objects.
   * Returns an object with send() and cancel() methods.
   */
  agentStream(
    onMessage: (msg: any) => void,
    onError?: (err: Error) => void,
    onEnd?: () => void,
  ): { send: (event: any) => boolean; cancel: () => void } {
    const call = this.client.AgentStream(this.metadata);

    call.on('data', (msg: any) => {
      try {
        onMessage(msg);
      } catch { /* ignore handler errors */ }
    });

    call.on('error', (err: Error) => {
      if (onError) onError(err);
    });

    call.on('end', () => {
      if (onEnd) onEnd();
    });

    return {
      send: (event: any) => {
        if (call.writable) {
          call.write(event);
          return true;
        }
        return false;
      },
      cancel: () => call.cancel(),
    };
  }

  /**
   * Batch ingest episodes via client streaming.
   */
  ingestEpisodes(episodes: any[]): Promise<{ accepted: number; deduplicated: number; errors: number }> {
    return new Promise((resolve, reject) => {
      const call = this.client.IngestEpisodes((err: any, response: any) => {
        if (err) {
          reject(new Error(`gRPC IngestEpisodes: ${err.details ?? err.message}`));
        } else {
          resolve(response);
        }
      });

      // Send episodes in batches of 50
      const batchSize = 50;
      for (let i = 0; i < episodes.length; i += batchSize) {
        const batch = episodes.slice(i, i + batchSize);
        call.write({ episodes: batch.map((ep: any) => ({
          id: ep.id ?? '',
          timestamp: ep.timestamp ?? Date.now(),
          summary: ep.summary ?? '',
          outcome: ep.outcome ?? 'unknown',
          duration_ms: ep.durationMs ?? 0,
          error_count: ep.errorCount ?? 0,
          tags: ep.tags ?? [],
        })) });
      }
      call.end();
    });
  }

  /**
   * Check if the gRPC connection is healthy by making a Health call.
   */
  async ping(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }
}
