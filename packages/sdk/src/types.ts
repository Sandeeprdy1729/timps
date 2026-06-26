export type ProviderName = 'ollama' | 'openai' | 'anthropic';

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export type Provider = ProviderName | ProviderConfig | null | undefined;

export interface MemoryOptions {
  projectPath: string;
  provider?: Provider;
  dir?: string;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string[];
  score?: number;
}

export interface RecallOptions {
  limit?: number;
  type?: string;
  tags?: string[];
  since?: number;
}

export interface MemoryStats {
  totalMemories: number;
  episodes: number;
  workingFiles: number;
  workingPatterns: number;
  storageSize?: number;
  lastUpdated?: number;
}

export type MemoryEventType = 'stored' | 'error';

export type MemoryEventHandler = (data: MemoryEntry | Error) => void;
