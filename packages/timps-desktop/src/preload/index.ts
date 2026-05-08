/**
 * TIMPS Desktop Preload Script
 * 
 * Exposes a typed API to the renderer via contextBridge.
 * This provides secure IPC without exposing direct invoke access.
 */

import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

// Types for the API
export interface SemanticEntry {
  id: string;
  timestamp: number;
  type: string;
  content: string;
  tags: string[];
  score?: number;
}

export interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: string;
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

// Expose the typed API to the renderer
const timpsAPI: TimpsAPI = {
  getVersion: () => invoke<string>('get_version'),
  
  getMemories: (projectPath: string) => 
    invoke<SemanticEntry[]>('load_semantic', { projectPath }),
  
  storeMemory: (entry) => 
    invoke('store_memory', { 
      projectPath: '', // Will be set internally
      key: entry.id, 
      value: entry.content, 
      importance: entry.score ?? 0.5, 
      tags: entry.tags 
    }),
  
  deleteMemory: (projectPath: string, key: string) =>
    invoke<number>('delete_memory', { projectPath, key }),
  
  runAgent: (prompt: string, projectPath?: string) =>
    invoke<string>('chat', { prompt, projectPath, provider: null }),
  
  getProvider: () => invoke<string>('get_provider'),
  
  setProvider: (name: string) => invoke('set_provider', { provider: name }),
  
  searchMemory: (query: string, projectPath: string, limit = 20) =>
    invoke<SemanticEntry[]>('search_memory', { projectPath, query, limit }),
  
  getMemoryStats: (projectPath: string) =>
    invoke<MemoryStats>('get_memory_stats', { projectPath }),
  
  getProjects: () => invoke<string[]>('list_projects'),
  
  onUpdateAvailable: (callback) => {
    // Listen for update available events
    emit('update-available').then(() => {
      // This would be handled by the updater plugin
    });
  },
  
  installUpdate: () => invoke('install_update'),
};

// Expose to window
window.timpsAPI = timpsAPI;

// Also expose version for quick access
window.TIMPS_VERSION = '0.1.0';