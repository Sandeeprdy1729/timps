/**
 * TIMPS Desktop API Type Declarations
 */

export interface SemanticEntry {
  id: string;
  timestamp: number;
  type: 'fact' | 'pattern' | 'error' | 'architecture' | string;
  content: string;
  tags: string[];
  score?: number;
}

export interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: 'success' | 'failure' | 'partial' | string;
  tags: string[];
}

export interface WorkingState {
  goals: string[];
  activeFiles: string[];
  recentErrors: string[];
}

export interface MemoryStats {
  project_hash: string;
  semantic_count: number;
  episode_count: number;
  working_goals: number;
}

export interface TimpsAPI {
  getVersion: () => Promise<string>;
  getMemories: (projectPath: string) => Promise<SemanticEntry[]>;
  storeMemory: (entry: Omit<SemanticEntry, 'timestamp'>) => Promise<void>;
  deleteMemory: (projectPath: string, key: string) => Promise<number>;
  runAgent: (prompt: string, projectPath?: string) => Promise<string>;
  getProvider: () => Promise<string>;
  setProvider: (name: string) => Promise<void>;
  searchMemory: (query: string, projectPath: string, limit?: number) => Promise<SemanticEntry[]>;
  getMemoryStats: (projectPath: string) => Promise<MemoryStats>;
  getProjects: () => Promise<string[]>;
  onUpdateAvailable: (callback: (version: string) => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    timpsAPI: TimpsAPI;
    TIMPS_VERSION: string;
  }
}

export {};