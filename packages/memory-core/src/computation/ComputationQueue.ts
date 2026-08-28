import type { StorageBackend } from '../backends/types.js';
import type { ComputationTask, ComputationConfig, ComputationStatus, ComputationTaskType, ComputationHandlers } from './types.js';

const QUEUE_BACKUP_KEY = 'computation_queue_backup';

const DEFAULT_CONFIG: ComputationConfig = {
  batchSize: 16,
  queueIntervalMs: 500,
};

export class ComputationQueue {
  private queue: ComputationTask[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private backend?: StorageBackend;
  private config: ComputationConfig;
  private handlers: ComputationHandlers;
  private _tasksProcessed = 0;
  private _lastError: string | null = null;

  constructor(handlers: ComputationHandlers, backend?: StorageBackend, config?: Partial<ComputationConfig>) {
    this.handlers = handlers;
    this.backend = backend;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get depth(): number {
    return this.queue.length;
  }

  get tasksProcessed(): number {
    return this._tasksProcessed;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  start(): void {
    if (this.timer) return;
    this._restoreBackup();
    this.timer = setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;
      this.processing = true;
      try {
        await this._flush();
      } finally {
        this.processing = false;
      }
    }, this.config.queueIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._saveBackup();
  }

  enqueue(item: Omit<ComputationTask, 'id' | 'createdAt'>): void {
    this.queue.push({
      ...item,
      id: `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    });
  }

  async processAll(): Promise<void> {
    while (this.queue.length > 0) {
      await this._flush();
    }
  }

  getStatus(): ComputationStatus {
    return {
      queueDepth: this.queue.length,
      lastRun: Date.now(),
      tasksProcessed: this._tasksProcessed,
      lastError: this._lastError,
    };
  }

  private async _flush(): Promise<void> {
    const batch = this.queue.splice(0, this.config.batchSize);
    if (batch.length === 0) return;

      for (const task of batch) {
        try {
          const handler = this.handlers[task.type];
          if (handler) {
            await handler(task);
          }
          this._tasksProcessed++;
        } catch (err) {
          this._lastError = err instanceof Error ? err.message : String(err);
        }
      }
  }

  private async _saveBackup(): Promise<void> {
    if (!this.backend || this.queue.length === 0) return;
    try {
      await this.backend.write(QUEUE_BACKUP_KEY, this.queue);
    } catch { /* non-critical */ }
  }

  private async _restoreBackup(): Promise<void> {
    if (!this.backend) return;
    try {
      const backup = await this.backend.read(QUEUE_BACKUP_KEY);
      if (Array.isArray(backup) && backup.length > 0) {
        this.queue.push(...backup);
      }
      await this.backend.delete(QUEUE_BACKUP_KEY);
    } catch { /* non-critical */ }
  }
}
