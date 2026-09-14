/**
 * TIMPS Desktop - IPC Bridge
 * Secure communication between renderer and Rust backend.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';

export type InvokeCmd = 
  | 'project_hash'
  | 'load_semantic'
  | 'load_episodes'
  | 'load_working'
  | 'get_memory_stats'
  | 'list_projects'
  | 'search_memory'
  | 'store_memory'
  | 'delete_memory'
  | 'chat'
  | 'get_version'
  | 'get_provider'
  | 'set_provider'
  | 'get_provider_config'
  | 'set_provider_config'
  | 'install_update'
  | 'gmail_status'
  | 'gmail_import_credentials'
  | 'gmail_oauth_start'
  | 'gmail_oauth_finish'
  | 'gmail_oauth_cancel'
  | 'gmail_disconnect'
  | 'gmail_sync'
  | 'gmail_recent'
  | 'gmail_query'
  | 'gmail_set_autosync'
  | 'gmail_autosync_status'
  | 'gmail_reset';

interface InvokeOptions {
  timeout?: number;
  retries?: number;
}

export class IPC {
  private timeout = 30000;
  private retries = 3;

  constructor(options?: InvokeOptions) {
    if (options?.timeout) this.timeout = options.timeout;
    if (options?.retries) this.retries = options.retries;
  }

  async invoke<T>(cmd: InvokeCmd, args?: Record<string, unknown>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.retries; i++) {
      try {
        const result = await invoke<T>(cmd, args);
        return result;
      } catch (error) {
        lastError = error as Error;
        if (i < this.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }

  async emit(event: string, payload?: unknown): Promise<void> {
    await emit(event, payload);
  }

  async listen<T>(
    event: string, 
    handler: (payload: T) => void
  ): Promise<() => void> {
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.retries = retries;
  }
}

export const ipc = new IPC();

// Convenience methods
export const ipcMethods = {
  projectHash: (path: string) => ipc.invoke<string>('project_hash', { projectPath: path }),
  loadSemantic: (path: string) => ipc.invoke('load_semantic', { projectPath: path }),
  loadEpisodes: (path: string, count: number) => ipc.invoke('load_episodes', { projectPath: path, count }),
  loadWorking: (path: string) => ipc.invoke('load_working', { projectPath: path }),
  getMemoryStats: (path: string) => ipc.invoke('get_memory_stats', { projectPath: path }),
  listProjects: () => ipc.invoke<string[]>('list_projects'),
  searchMemory: (path: string, query: string, limit: number) => 
    ipc.invoke('search_memory', { projectPath: path, query, limit }),
  storeMemory: (path: string, key: string, value: string, importance: number, tags: string[]) =>
    ipc.invoke('store_memory', { projectPath: path, key, value, importance, tags }),
  deleteMemory: (path: string, key: string) =>
    ipc.invoke<number>('delete_memory', { projectPath: path, key }),
  chat: (prompt: string, path?: string, provider?: string) =>
    ipc.invoke<string>('chat', { prompt, projectPath: path, provider }),
  getVersion: () => ipc.invoke<string>('get_version'),
  getProvider: () => ipc.invoke<string>('get_provider'),
  setProvider: (provider: string) => ipc.invoke('set_provider', { provider }),
  getProviderConfig: () => ipc.invoke<{ provider: string; model: string; baseUrl: string; apiKey: string }>('get_provider_config'),
  saveProviderConfig: (cfg: { provider: string; model: string; baseUrl: string; apiKey: string }) =>
    ipc.invoke('set_provider_config', { ...cfg }),
  installUpdate: () => ipc.invoke('install_update'),
  gmailStatus: () => ipc.invoke('gmail_status'),
  gmailImportCredentials: (filePath: string) => ipc.invoke('gmail_import_credentials', { filePath }),
  gmailOauthStart: () => ipc.invoke('gmail_oauth_start'),
  gmailOauthFinish: () => ipc.invoke('gmail_oauth_finish'),
  gmailOauthCancel: () => ipc.invoke('gmail_oauth_cancel'),
  gmailDisconnect: () => ipc.invoke('gmail_disconnect'),
  gmailSync: () => ipc.invoke('gmail_sync'),
  gmailRecent: (limit: number) => ipc.invoke('gmail_recent', { limit }),
  gmailQuery: (query: string, limit: number) => ipc.invoke('gmail_query', { query, limit }),
  gmailSetAutosync: (enabled: boolean) => ipc.invoke('gmail_set_autosync', { enabled }),
  gmailAutosyncStatus: () => ipc.invoke('gmail_autosync_status'),
  gmailReset: () => ipc.invoke('gmail_reset'),
};