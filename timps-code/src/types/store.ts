// ── TIMPS Code — State Store
// Reactive state management with selector-based subscriptions

export type StateSelector<S, T> = (state: S) => T;
export type StateListener<S> = (prev: S, next: S) => void;

export interface Store<S extends object> {
  getState(): S;
  setState(updater: Partial<S> | ((prev: S) => Partial<S>)): void;
  subscribe(listener: StateListener<S>): () => void;
  subscribeSelector<T>(selector: StateSelector<S, T>, listener: (value: T, prev: T) => void): () => void;
}

export class StateStore<S extends object> implements Store<S> {
  private state: S;
  private listeners = new Set<StateListener<S>>();
  private selectorListeners = new Map<StateSelector<S, any>, Set<(value: any, prev: any) => void>>();

  constructor(initialState: S) {
    this.state = initialState;
  }

  getState(): S {
    return this.state;
  }

  setState(updater: Partial<S> | ((prev: S) => Partial<S>)): void {
    const prev = this.state;
    const update = typeof updater === 'function' ? updater(prev) : updater;
    this.state = { ...prev, ...update };

    // Notify all listeners
    for (const listener of this.listeners) {
      listener(prev, this.state);
    }

    // Notify selector listeners
    for (const [selector, subs] of this.selectorListeners) {
      const prevValue = selector(prev);
      const nextValue = selector(this.state);
      if (prevValue !== nextValue) {
        for (const listener of subs) {
          listener(nextValue, prevValue);
        }
      }
    }
  }

  subscribe(listener: StateListener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeSelector<T>(selector: StateSelector<S, T>, listener: (value: T, prev: T) => void): () => void {
    if (!this.selectorListeners.has(selector)) {
      this.selectorListeners.set(selector, new Set());
    }
    this.selectorListeners.get(selector)!.add(listener);
    return () => {
      this.selectorListeners.get(selector)?.delete(listener);
    };
  }
}

// ── App State Types ────────────────────────────────────────────────────────────

export interface AppState {
  settings: import('./settings.js').SettingsJson;
  verbose: boolean;
  expandedView: 'none' | 'tasks' | 'teammates';
  isBriefOnly: boolean;
  thinkingEnabled: boolean;
  promptSuggestionEnabled: boolean;
  remoteSessionUrl?: string;
  remoteConnectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  fastMode?: boolean;
  model?: string;
  statusLineText?: string;
  footerSelection?: string;
  toolPermissionMode?: 'auto' | 'ask' | 'yes' | 'no';
  agent?: string;
}

export interface McpState {
  clients: McpClientConnection[];
  tools: import('../config/types.js').ToolDefinition[];
  commands: import('./command.js').CommandDef[];
  resources: Record<string, import('./mcp.js').ServerResource[]>;
  pluginReconnectKey: number;
}

export interface McpClientConnection {
  name: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  serverInfo?: {
    name: string;
    version: string;
  };
  tools: import('../config/types.js').ToolDefinition[];
  resources: import('./mcp.js').ServerResource[];
  lastError?: string;
}

export interface ServerResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface Notification {
  key: string;
  text: string;
  priority?: 'normal' | 'immediate' | 'low';
  timeoutMs?: number;
}

export interface TaskState {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: number;
  completedAt?: number;
  output?: string;
}

export interface FileHistoryState {
  snapshots: FileSnapshot[];
  trackedFiles: Set<string>;
  snapshotSequence: number;
}

export interface FileSnapshot {
  id: string;
  timestamp: number;
  description: string;
  files: { path: string; content: string; existed: boolean }[];
}

export function createStore<S extends object>(initialState: S): Store<S> {
  return new StateStore(initialState);
}
