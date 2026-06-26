export interface EmbeddingConfig {
  provider: 'ollama' | 'openai' | 'none';
  model: string;
  dimensions: number;
  apiKey?: string;
  baseUrl?: string;
  batchSize: number;
  queueIntervalMs: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: 'ollama',
  model: 'nomic-embed-text',
  dimensions: 384,
  baseUrl: 'http://localhost:11434',
  batchSize: 16,
  queueIntervalMs: 500,
};

export interface EmbeddingResult {
  id: string;
  vector: number[];
  text: string;
}

export interface QueueItem {
  id: string;
  text: string;
  type: string;
  tags: string[];
  orgScope?: { orgId: string; teamId?: string; projectId: string };
}

export interface EmbeddingStatus {
  queueDepth: number;
  provider: string;
  model: string;
  totalEmbedded: number;
  lastError: string | null;
  isConnected: boolean;
}
