import type { EmbeddingConfig, QueueItem, EmbeddingStatus } from './types.js';
import { EmbeddingService } from './EmbeddingService.js';
import type { StorageBackend } from '../backends/types.js';

const QUEUE_BACKUP_KEY = 'embedding_queue_backup';

export class EmbeddingQueue {
  private queue: QueueItem[] = [];
  private service: EmbeddingService;
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private backend?: StorageBackend;
  private _config: EmbeddingConfig;

  constructor(config: EmbeddingConfig, backend?: StorageBackend) {
    this._config = config;
    this.service = new EmbeddingService(config);
    this.backend = backend;
  }

  get serviceInstance(): EmbeddingService {
    return this.service;
  }

  get depth(): number {
    return this.queue.length;
  }

  start(upsertFn: (results: Array<{ id: string; vector: number[]; text: string; type: string; tags: string[]; orgScope?: { orgId: string; teamId?: string; projectId: string } }>) => Promise<void>): void {
    if (this.timer) return;
    this._restoreBackup();
    this.timer = setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;
      this.processing = true;
      try {
        await this._flush(upsertFn);
      } finally {
        this.processing = false;
      }
    }, this._config.queueIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._saveBackup();
  }

  enqueue(item: QueueItem): void {
    this.queue.push(item);
  }

  async processAll(upsertFn: (results: Array<{ id: string; vector: number[]; text: string; type: string; tags: string[]; orgScope?: { orgId: string; teamId?: string; projectId: string } }>) => Promise<void>): Promise<void> {
    while (this.queue.length > 0) {
      await this._flush(upsertFn);
    }
  }

  getStatus(): EmbeddingStatus {
    return {
      queueDepth: this.queue.length,
      provider: this.service.provider,
      model: this.service.model,
      totalEmbedded: this.service.totalEmbedded,
      lastError: this.service.lastError,
      isConnected: this.service.connected,
    };
  }

  private async _flush(
    upsertFn: (results: Array<{ id: string; vector: number[]; text: string; type: string; tags: string[]; orgScope?: { orgId: string; teamId?: string; projectId: string } }>) => Promise<void>,
  ): Promise<void> {
    const batch = this.queue.splice(0, this._config.batchSize);
    if (batch.length === 0) return;

    const texts = batch.map(i => i.text);
    const vectors = await this.service.computeEmbeddings(texts);

    const results = batch.map((item, idx) => ({
      id: item.id,
      vector: vectors[idx] ?? new Array(this._config.dimensions).fill(0),
      text: item.text,
      type: item.type,
      tags: item.tags,
      orgScope: item.orgScope,
    }));

    await upsertFn(results);
  }

  private async _saveBackup(): Promise<void> {
    if (!this.backend || this.queue.length === 0) return;
    try {
      await this.backend.write(QUEUE_BACKUP_KEY, this.queue);
    } catch {
      /* non-critical */
    }
  }

  private async _restoreBackup(): Promise<void> {
    if (!this.backend) return;
    try {
      const backup = await this.backend.read(QUEUE_BACKUP_KEY);
      if (Array.isArray(backup) && backup.length > 0) {
        this.queue.push(...backup);
      }
      await this.backend.delete(QUEUE_BACKUP_KEY);
    } catch {
      /* non-critical */
    }
  }
}
