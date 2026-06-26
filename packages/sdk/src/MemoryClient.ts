import { EventEmitter } from 'node:events';
import type { MemoryOptions, MemoryEntry as PublicMemoryEntry, RecallOptions, MemoryStats, MemoryEventType, MemoryEventHandler } from './types.js';
import type { ProviderConfig } from './types.js';
import { resolveProviderConfig } from './defaults.js';

type MemoryEntry = import('@timps/memory-core').MemoryEntry;
type MemoryEngine = import('@timps/memory-core').MemoryEngine;
type MemoryEngineOptions = import('@timps/memory-core').MemoryEngineOptions;
type SearchOptions = import('@timps/memory-core').SearchOptions;
type FileBackend = import('@timps/memory-core').FileBackend;

export class MemoryClient {
  private _engine: MemoryEngine | null = null;
  private _events = new EventEmitter();
  private _options: MemoryOptions;
  private _provider: ProviderConfig | null;

  constructor(options: MemoryOptions) {
    this._options = options;
    this._provider = resolveProviderConfig(options.provider);
  }

  async initialize(): Promise<void> {
    const { MemoryEngine } = await import('@timps/memory-core');
    const { FileBackend } = await import('@timps/memory-core');

    const backend = new FileBackend({ baseDir: this._options.dir ?? this._options.projectPath });

    const engineOptions: MemoryEngineOptions = {
      backend,
      dir: this._options.dir,
    };

    if (this._provider) {
      engineOptions.embedding = {
        provider: this._provider.name,
        apiKey: this._provider.apiKey,
        model: this._provider.model,
        baseUrl: this._provider.baseUrl,
        dims: this._provider.name === 'openai' ? 768 : 384,
        enabled: true,
      };
    }

    this._engine = new MemoryEngine(this._options.projectPath, engineOptions);
  }

  private get engine(): MemoryEngine {
    if (!this._engine) throw new Error('MemoryClient not initialized. Call createMemory() first.');
    return this._engine;
  }

  async store(content: string, metadata?: Record<string, any>): Promise<void> {
    const type = metadata?.type ?? 'fact';
    const tags = metadata?.tags ?? [];
    this.engine.store({ content, type, tags });
    this._events.emit('stored', { id: '', timestamp: Date.now(), type, content, tags });

    if (metadata?.episode) {
      this.engine.storeEpisode({
        summary: metadata.episodeSummary ?? content.slice(0, 200),
        outcome: metadata.outcome ?? 'success',
        durationMs: metadata.durationMs,
        tags: metadata.tags,
      });
    }
  }

  async recall(query: string, options?: RecallOptions): Promise<PublicMemoryEntry[]> {
    const searchOpts: SearchOptions = {
      limit: options?.limit ?? 10,
      type: options?.type as any,
      tags: options?.tags,
      since: options?.since,
    };

    const results = await this.engine.recall(query, searchOpts);
    return results.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      content: r.content,
      tags: r.tags,
      score: r.score,
    }));
  }

  async delete(id: string): Promise<void> {
    this.engine.consolidate();
  }

  async storeBatch(entries: Array<{ content: string; metadata?: Record<string, any> }>): Promise<void> {
    for (const entry of entries) {
      await this.store(entry.content, entry.metadata);
    }
  }

  on(event: MemoryEventType, handler: MemoryEventHandler): void {
    this._events.on(event, handler);
  }

  off(event: MemoryEventType, handler: MemoryEventHandler): void {
    this._events.off(event, handler);
  }

  getStats(): MemoryStats {
    const stats = this.engine.getStats();
    return {
      totalMemories: stats.semanticCount,
      episodes: stats.episodeCount,
      workingFiles: stats.workingFiles,
      workingPatterns: stats.workingPatterns,
      lastUpdated: Date.now(),
    };
  }

  async dispose(): Promise<void> {
    await this.engine.dispose();
    this._engine = null;
    this._events.removeAllListeners();
  }
}
