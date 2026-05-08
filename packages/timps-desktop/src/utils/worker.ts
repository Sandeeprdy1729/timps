/**
 * TIMPS Desktop - Worker pool
 * Web worker management for background tasks.
 */

type WorkerMessage = {
  type: string;
  payload: unknown;
};

type WorkerHandler = (payload: unknown) => unknown;

class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private handlers: Map<string, WorkerHandler> = new Map();

  register(name: string, worker: Worker): void {
    this.workers.set(name, worker);
  }

  onMessage(type: string, handler: WorkerHandler): void {
    this.handlers.set(type, handler);
  }

  postMessage(workerName: string, message: WorkerMessage): void {
    const worker = this.workers.get(workerName);
    if (worker) {
      worker.postMessage(message);
    }
  }

  terminate(workerName: string): void {
    const worker = this.workers.get(workerName);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerName);
    }
  }

  terminateAll(): void {
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
  }
}

export const workerPool = new WorkerPool();