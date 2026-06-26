export type { MemoryOptions, Provider, ProviderConfig, ProviderName, MemoryEntry, RecallOptions, MemoryStats, MemoryEventType, MemoryEventHandler } from './types.js';

import { MemoryClient } from './MemoryClient.js';
import type { MemoryOptions } from './types.js';

export interface Memory {
  store(content: string, metadata?: Record<string, any>): Promise<void>;
  recall(query: string, options?: import('./types.js').RecallOptions): Promise<import('./types.js').MemoryEntry[]>;
  delete(id: string): Promise<void>;
  storeBatch(entries: Array<{ content: string; metadata?: Record<string, any> }>): Promise<void>;
  on(event: import('./types.js').MemoryEventType, handler: import('./types.js').MemoryEventHandler): void;
  off(event: import('./types.js').MemoryEventType, handler: import('./types.js').MemoryEventHandler): void;
  getStats(): import('./types.js').MemoryStats;
  dispose(): Promise<void>;
}

export async function createMemory(options: MemoryOptions): Promise<Memory> {
  const client = new MemoryClient(options);
  await client.initialize();
  return client;
}
