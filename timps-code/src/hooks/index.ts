// ── TIMPS Code — React Hooks System
// Hooks for state management inspired by Claude Code

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type React from 'react';
import type { TimpsConfig, TrustLevel } from '../config/types.js';
import type { McpServerConfig } from '../config/types.js';
import type { TaskState } from '../types/store.js';
import type { McpClientConnection } from '../types/mcp.js';
import { loadConfig, saveConfig } from '../config/config.js';

type AppState = {
  settings: { voiceEnabled: boolean };
  voiceState: 'idle';
  promptSuggestion: { text: string | null; promptId: string | null; shownAt: number; acceptedAt: number; generationRequestId: string | null };
  teamContext: null | { teamName?: string; selfAgentName?: string; teammates?: Record<string, unknown> };
  tasks: Record<string, any>;
  viewSelectionMode: string;
  viewingAgentTaskId: string | null;
  selectedIPAgentIndex: number;
  inbox: { messages: Array<{ text: string; status: string }> };
};

const mockAppState: AppState = {
  settings: { voiceEnabled: false },
  voiceState: 'idle',
  promptSuggestion: { text: null, promptId: null, shownAt: 0, acceptedAt: 0, generationRequestId: null },
  teamContext: null,
  tasks: {},
  viewSelectionMode: 'none',
  viewingAgentTaskId: null,
  selectedIPAgentIndex: -1,
  inbox: { messages: [] },
};

export function useAppState<T>(selector: (s: AppState) => T): T {
  return selector(mockAppState);
}

export function useSetAppState(): (fn: (prev: AppState) => AppState) => void {
  return (fn: (prev: AppState) => AppState) => { void fn(mockAppState); };
}

export function useAppStateStore(): { getState: () => AppState; subscribe: (fn: () => void) => () => void } {
  return {
    getState: () => mockAppState,
    subscribe: (fn: () => void) => () => { void fn; },
  };
}

// ── Settings Hook ──────────────────────────────────────────────────────────────

export interface UseSettingsResult {
  settings: TimpsConfig;
  updateSetting: <K extends keyof TimpsConfig>(key: K, value: TimpsConfig[K]) => void;
  updateSettings: (updates: Partial<TimpsConfig>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<TimpsConfig>(() => loadConfig());
  const [isLoading, setIsLoading] = useState(false);

  const updateSetting = useCallback(<K extends keyof TimpsConfig>(
    key: K,
    value: TimpsConfig[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      saveConfig(updated);
      return updated;
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<TimpsConfig>) => {
    setSettings(prev => {
      const updated = { ...prev, ...updates };
      saveConfig(updated);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(loadConfig());
  }, []);

  return { settings, updateSetting, updateSettings, resetSettings, isLoading };
}

// ── MCP Hook ───────────────────────────────────────────────────────────────────

export interface UseMcpResult {
  clients: McpClientConnection[];
  tools: any[];
  isConnecting: boolean;
  error: string | null;
  connect: (config: McpServerConfig) => Promise<void>;
  disconnect: (name: string) => Promise<void>;
  reconnect: (name: string) => Promise<void>;
  callTool: (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<string>;
}

export function useMcp(): UseMcpResult {
  const [clients, setClients] = useState<McpClientConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (config: McpServerConfig) => {
    setIsConnecting(true);
    setError(null);
    try {
      const mcpManager = await import('../utils/mcp.js').then(m => m.getMcpManager());
      await mcpManager.connect({ ...config, scope: 'user', enabled: true } as any);
      setClients(mcpManager.getClients());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (name: string) => {
    try {
      const mcpManager = await import('../utils/mcp.js').then(m => m.getMcpManager());
      await mcpManager.disconnect(name);
      setClients(mcpManager.getClients());
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const reconnect = useCallback(async (name: string) => {
    try {
      const mcpManager = await import('../utils/mcp.js').then(m => m.getMcpManager());
      const client = mcpManager.getClient(name);
      if (client) {
        await mcpManager.disconnect(name);
        await mcpManager.connect({ name, command: '', scope: 'user', enabled: true } as any);
        setClients(mcpManager.getClients());
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const callTool = useCallback(async (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ) => {
    try {
      const mcpManager = await import('../utils/mcp.js').then(m => m.getMcpManager());
      return await mcpManager.callTool(serverName, toolName, args);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);

  const tools = useMemo(() => {
    return clients.flatMap(c => c.tools || []);
  }, [clients]);

  return { clients, tools, isConnecting, error, connect, disconnect, reconnect, callTool };
}

// ── Tasks Hook ─────────────────────────────────────────────────────────────────

export interface UseTasksResult {
  tasks: TaskState[];
  addTask: (title: string, priority?: 'low' | 'medium' | 'high' | 'urgent') => string;
  updateTask: (id: string, updates: Partial<TaskState>) => void;
  completeTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<TaskState[]>([]);

  const addTask = useCallback((
    title: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): string => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: TaskState = {
      id,
      title,
      status: 'todo',
      priority,
      createdAt: Date.now(),
    };
    setTasks(prev => [...prev, task]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<TaskState>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const completeTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'completed' as const, completedAt: Date.now() } : t
    ));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'));
  }, []);

  return { tasks, addTask, updateTask, completeTask, removeTask, clearCompleted };
}

// ── Command Queue Hook ─────────────────────────────────────────────────────────

export interface QueuedCommand {
  id: string;
  command: string;
  args: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'done';
}

export function useCommandQueue(): {
  queue: QueuedCommand[];
  add: (cmd: string, args: string) => void;
  clear: () => void;
} {
  const [queue, setQueue] = useState<QueuedCommand[]>([]);

  const add = useCallback((command: string, args: string) => {
    const item: QueuedCommand = {
      id: `cmd_${Date.now()}`,
      command,
      args,
      timestamp: Date.now(),
      status: 'pending',
    };
    setQueue(prev => [...prev, item]);
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  return { queue, add, clear };
}

// ── Merged Tools Hook ─────────────────────────────────────────────────────────

export function useMergedTools(initialTools: any[], mcpTools: any[]): any[] {
  return useMemo(() => {
    const toolMap = new Map<string, any>();
    for (const tool of initialTools) {
      toolMap.set(tool.name, tool);
    }
    for (const tool of mcpTools) {
      if (!toolMap.has(tool.name)) {
        toolMap.set(tool.name, tool);
      }
    }
    return Array.from(toolMap.values());
  }, [initialTools, mcpTools]);
}

// ── Text Input Hook ────────────────────────────────────────────────────────────

export interface TextInputState {
  value: string;
  cursorPosition: number;
  history: string[];
  historyIndex: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onHistoryUp: () => void;
  onHistoryDown: () => void;
  onClear: () => void;
}

export function useTextInput(
  initialValue: string = '',
  onSubmit?: (value: string) => void
): TextInputState {
  const [value, setValue] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const onChange = useCallback((newValue: string) => {
    setValue(newValue);
    setCursorPosition(newValue.length);
  }, []);

  const onSubmitCallback = useCallback(() => {
    if (value.trim()) {
      setHistory(prev => [...prev, value]);
      setHistoryIndex(-1);
      onSubmit?.(value);
      setValue('');
    }
  }, [value, onSubmit]);

  const onHistoryUp = useCallback(() => {
    if (history.length === 0) return;
    const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
    setHistoryIndex(newIndex);
    setValue(history[history.length - 1 - newIndex] || '');
  }, [history, historyIndex]);

  const onHistoryDown = useCallback(() => {
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      setValue('');
    } else {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setValue(history[history.length - 1 - newIndex] || '');
    }
  }, [history, historyIndex]);

  const onClear = useCallback(() => {
    setValue('');
    setCursorPosition(0);
  }, []);

  return {
    value,
    cursorPosition,
    history,
    historyIndex,
    onChange,
    onSubmit: onSubmitCallback,
    onHistoryUp,
    onHistoryDown,
    onClear,
  };
}

// ── Notifications Hook ────────────────────────────────────────────────────────

export interface Notification {
  key: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timeoutMs?: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [...prev, notification]);
    if (notification.timeoutMs) {
      setTimeout(() => {
        removeNotification(notification.key);
      }, notification.timeoutMs);
    }
  }, []);

  const removeNotification = useCallback((key: string) => {
    setNotifications(prev => prev.filter(n => n.key !== key));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, addNotification, removeNotification, clearNotifications };
}

// ── Tool Permission Hook ──────────────────────────────────────────────────────

export type PermissionMode = 'auto' | 'ask' | 'yes' | 'no';

export interface ToolPermissionContext {
  mode: PermissionMode;
  cwd: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
}

export function useToolPermission(): {
  mode: PermissionMode;
  setMode: (mode: PermissionMode) => void;
  canUseTool: (toolName: string, risk: string) => boolean;
  requestPermission: (toolName: string) => Promise<boolean>;
} {
  const [mode, setModeState] = useState<PermissionMode>('auto');

  const setMode = useCallback((newMode: PermissionMode) => {
    setModeState(newMode);
    const cfg = loadConfig();
    cfg.trustLevel = newMode as TrustLevel;
    saveConfig(cfg);
  }, []);

  const canUseTool = useCallback((toolName: string, risk: string): boolean => {
    if (mode === 'yes') return true;
    if (mode === 'no') return false;
    if (risk === 'low' || risk === 'medium') return true;
    return mode === 'ask';
  }, [mode]);

  const requestPermission = useCallback(async (toolName: string): Promise<boolean> => {
    return true;
  }, []);

  return { mode, setMode, canUseTool, requestPermission };
}

// ── Session Hook ─────────────────────────────────────────────────────────────

export interface SessionState {
  id: string;
  startedAt: number;
  lastActivity: number;
  messageCount: number;
  tokenCount: number;
}

export function useSession() {
  const [session, setSession] = useState<SessionState>({
    id: `session_${Date.now()}`,
    startedAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    tokenCount: 0,
  });

  const updateActivity = useCallback(() => {
    setSession(prev => ({ ...prev, lastActivity: Date.now() }));
  }, []);

  const incrementMessages = useCallback((tokens = 0) => {
    setSession(prev => ({
      ...prev,
      lastActivity: Date.now(),
      messageCount: prev.messageCount + 1,
      tokenCount: prev.tokenCount + tokens,
    }));
  }, []);

  return { session, updateActivity, incrementMessages };
}

// ── Ide Connection Hook ──────────────────────────────────────────────────────

export type IdeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useIdeConnection() {
  const [status, setStatus] = useState<IdeConnectionStatus>('disconnected');
  const [ideType, setIdeType] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const connect = useCallback(async (ide: string) => {
    setStatus('connecting');
    setIdeType(ide);
    try {
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setLastError((err as Error).message);
    }
  }, []);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
    setIdeType(null);
  }, []);

  return { status, ideType, lastError, connect, disconnect };
}

// ── OAuth Hook ─────────────────────────────────────────────────────────────────

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface UseOAuthResult {
  isAuthenticated: boolean;
  tokens: OAuthTokens | null;
  isLoading: boolean;
  error: string | null;
  login: (options?: { skipBrowserOpen?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export function useOAuth(): UseOAuthResult {
  const [tokens, setTokens] = useState<OAuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = tokens !== null && tokens.expiresAt > Date.now();

  const login = useCallback(async (options?: { skipBrowserOpen?: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { oauthService } = await import('../services/oauth/index.js');
      const result = await oauthService.authenticate(options);
      setTokens(result);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setTokens(null);
  }, []);

  const refreshTokens = useCallback(async () => {
    if (!tokens?.refreshToken) return;
    setIsLoading(true);
    try {
      const { refreshOAuthToken } = await import('../services/oauth/index.js');
      const result = await refreshOAuthToken(tokens.refreshToken);
      setTokens(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [tokens?.refreshToken]);

  return { isAuthenticated, tokens, isLoading, error, login, logout, refreshTokens };
}

// ── Settings Sync Hook ─────────────────────────────────────────────────────────

export interface UseSettingsSyncResult {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
  sync: () => Promise<void>;
  upload: () => Promise<void>;
  download: () => Promise<boolean>;
}

export function useSettingsSync(): UseSettingsSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const { syncSettings } = await import('../services/settingsSync/index.js');
      await syncSettings();
      setLastSync(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const upload = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { uploadUserSettingsInBackground } = await import('../services/settingsSync/index.js');
      await uploadUserSettingsInBackground();
      setLastSync(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const download = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const { downloadUserSettings } = await import('../services/settingsSync/index.js');
      const result = await downloadUserSettings();
      if (result) setLastSync(Date.now());
      return result;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { isSyncing, lastSync, error, sync, upload, download };
}

// ── Coordinator Hook ───────────────────────────────────────────────────────────

export interface UseCoordinatorResult {
  isEnabled: boolean;
  workers: Array<{ id: string; description: string; status: string }>;
  pendingTasks: number;
  enable: () => void;
  disable: () => void;
  createWorker: (description: string) => string;
  stopWorker: (workerId: string) => boolean;
  getStatus: () => { mode: boolean; workers: { total: number; running: number; completed: number; failed: number }; tasks: { total: number; pending: number } };
}

export function useCoordinator(): UseCoordinatorResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [workers, setWorkers] = useState<Array<{ id: string; description: string; status: string }>>([]);
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    const service = getCoordinatorService();

    const updateState = () => {
      setIsEnabled(service.isEnabled());
      setWorkers(service.getAllWorkers().map((w: any) => ({
        id: w.id,
        description: w.description,
        status: w.status,
      })));
      setPendingTasks(service.getPendingTaskCount());
    };

    updateState();
    service.on('modeChanged', updateState);
    service.on('workerUpdated', updateState);
    service.on('workerStopped', updateState);
    service.on('taskSubmitted', updateState);

    return () => {
      service.off('modeChanged', updateState);
      service.off('workerUpdated', updateState);
      service.off('workerStopped', updateState);
      service.off('taskSubmitted', updateState);
    };
  }, []);

  const enable = useCallback(() => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    getCoordinatorService().enable();
  }, []);

  const disable = useCallback(() => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    getCoordinatorService().disable();
  }, []);

  const createWorker = useCallback((description: string) => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    return getCoordinatorService().createWorker(description);
  }, []);

  const stopWorker = useCallback((workerId: string) => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    return getCoordinatorService().stopWorker(workerId);
  }, []);

  const getStatus = useCallback(() => {
    const { getCoordinatorService } = require('../services/coordinator/index.js');
    return getCoordinatorService().getStatus();
  }, []);

  return { isEnabled, workers, pendingTasks, enable, disable, createWorker, stopWorker, getStatus };
}

// ── Plugin Hook ────────────────────────────────────────────────────────────────

export interface LoadedPlugin {
  name: string;
  description: string;
  version?: string;
  enabled: boolean;
  isBuiltin: boolean;
  source: string;
}

export interface UsePluginsResult {
  plugins: LoadedPlugin[];
  enabledPlugins: LoadedPlugin[];
  errors: string[];
  loadPlugin: (name: string) => Promise<void>;
  unloadPlugin: (name: string) => Promise<void>;
  installPlugin: (name: string, repo: string) => Promise<boolean>;
  removePlugin: (name: string) => Promise<boolean>;
  enablePlugin: (name: string) => void;
  disablePlugin: (name: string) => void;
  discoverPlugins: () => Promise<void>;
  getCommands: () => Array<{ name: string; description: string }>;
  getSkills: () => Array<{ name: string; description: string }>;
}

export function usePlugins(): UsePluginsResult {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const refreshPlugins = useCallback(() => {
    const { getPluginManager, getPluginErrorMessage } = require('../services/plugins/index.js');
    const manager = getPluginManager();
    const result = manager.getLoadResult();
    setPlugins(result.enabled.map((p: any) => ({
      name: p.name,
      description: p.manifest?.description || '',
      version: p.manifest?.version,
      enabled: p.enabled,
      isBuiltin: p.isBuiltin,
      source: p.source,
    })));
    setErrors(result.errors.map(getPluginErrorMessage));
  }, []);

  useEffect(() => {
    refreshPlugins();
  }, [refreshPlugins]);

  const loadPlugin = useCallback(async (name: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    await getPluginManager().loadPlugin(name);
    refreshPlugins();
  }, [refreshPlugins]);

  const unloadPlugin = useCallback(async (name: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    await getPluginManager().unloadPlugin(name);
    refreshPlugins();
  }, [refreshPlugins]);

  const installPlugin = useCallback(async (name: string, repo: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    const result = await getPluginManager().installPlugin(name, repo);
    refreshPlugins();
    return result;
  }, [refreshPlugins]);

  const removePlugin = useCallback(async (name: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    const result = await getPluginManager().removePlugin(name);
    refreshPlugins();
    return result;
  }, [refreshPlugins]);

  const enablePlugin = useCallback((name: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    getPluginManager().enablePlugin(name);
    refreshPlugins();
  }, [refreshPlugins]);

  const disablePlugin = useCallback((name: string) => {
    const { getPluginManager } = require('../services/plugins/index.js');
    getPluginManager().disablePlugin(name);
    refreshPlugins();
  }, [refreshPlugins]);

  const discoverPlugins = useCallback(async () => {
    const { getPluginManager } = require('../services/plugins/index.js');
    await getPluginManager().discoverPlugins();
    refreshPlugins();
  }, [refreshPlugins]);

  const getCommands = useCallback(() => {
    const { getPluginManager } = require('../services/plugins/index.js');
    return getPluginManager().getPluginCommands();
  }, []);

  const getSkills = useCallback(() => {
    const { getPluginManager } = require('../services/plugins/index.js');
    return getPluginManager().getPluginSkills();
  }, []);

  return {
    plugins,
    enabledPlugins: plugins.filter(p => p.enabled),
    errors,
    loadPlugin,
    unloadPlugin,
    installPlugin,
    removePlugin,
    enablePlugin,
    disablePlugin,
    discoverPlugins,
    getCommands,
    getSkills,
  };
}

// ── Arrow Key History Hook ────────────────────────────────────────────────────

export interface UseArrowKeyHistoryResult {
  position: number;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  reset: () => void;
  current: string | null;
  push: (item: string) => void;
}

export function useArrowKeyHistory(): UseArrowKeyHistoryResult {
  const [history, setHistory] = useState<string[]>([]);
  const [position, setPosition] = useState(-1);

  const push = useCallback((item: string) => {
    setHistory(prev => {
      if (prev[prev.length - 1] === item) return prev;
      return [...prev.slice(0, position + 1), item];
    });
    setPosition(-1);
  }, [position]);

  const goBack = useCallback(() => {
    setPosition(prev => {
      const newPos = prev + 1;
      return Math.min(newPos, history.length - 1);
    });
  }, [history.length]);

  const goForward = useCallback(() => {
    setPosition(prev => {
      const newPos = prev - 1;
      return Math.max(newPos, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setPosition(-1);
  }, []);

  const current = position >= 0 && position < history.length ? history[history.length - 1 - position] : null;

  return {
    position,
    canGoBack: position < history.length - 1,
    canGoForward: position >= 0,
    goBack,
    goForward,
    reset,
    current,
    push,
  };
}

// ── Diff in IDE Hook ──────────────────────────────────────────────────────────

export interface DiffChange {
  file: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
  applied: boolean;
}

export function useDiffInIDE() {
  const [diffs, setDiffs] = useState<DiffChange[]>([]);
  const [activeDiff, setActiveDiff] = useState<string | null>(null);

  const showDiff = useCallback((file: string, oldContent: string, newContent: string) => {
    const change: DiffChange = {
      file,
      oldContent,
      newContent,
      timestamp: Date.now(),
      applied: false,
    };
    setDiffs(prev => [...prev, change]);
    setActiveDiff(file);
  }, []);

  const applyDiff = useCallback((file: string) => {
    setDiffs(prev => prev.map(d =>
      d.file === file ? { ...d, applied: true } : d
    ));
  }, []);

  const dismissDiff = useCallback((file: string) => {
    setDiffs(prev => prev.filter(d => d.file !== file));
    setActiveDiff(prev => prev === file ? null : prev);
  }, []);

  return { diffs, activeDiff, showDiff, applyDiff, dismissDiff };
}

// ── Clipboard Image Hint Hook ──────────────────────────────────────────────────

export interface ClipboardImageHint {
  detected: boolean;
  hasImage: boolean;
  imageType?: string;
  imageSize?: number;
  preview?: string;
}

export function useClipboardImageHint(): {
  hint: ClipboardImageHint;
  check: () => Promise<ClipboardImageHint>;
  copyImage: (imageData: string) => Promise<boolean>;
} {
  const [hint, setHint] = useState<ClipboardImageHint>({ detected: false, hasImage: false });

  const check = useCallback(async (): Promise<ClipboardImageHint> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const items = await navigator.clipboard.read();
        const hasImage = items.some(item =>
          item.types.some(type => type.startsWith('image/'))
        );

        const result: ClipboardImageHint = { detected: true, hasImage };
        if (hasImage) {
          const imageType = items[0].types.find(t => t.startsWith('image/'));
          result.imageType = imageType?.replace('image/', '');
        }
        setHint(result);
        return result;
      }
    } catch {
      setHint({ detected: true, hasImage: false });
    }
    return { detected: true, hasImage: false };
  }, []);

  const copyImage = useCallback(async (imageData: string): Promise<boolean> => {
    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { hint, check, copyImage };
}

// ── Swarm Initialization Hook ───────────────────────────────────────────────

export interface UseSwarmInitializationOptions {
  setAppState: (f: (prevState: any) => any) => void;
  initialMessages?: any[];
  enabled?: boolean;
}

export function useSwarmInitialization({
  setAppState,
  initialMessages,
  enabled = true,
}: UseSwarmInitializationOptions): void {
  useEffect(() => {
    if (!enabled) return;
    
    // Check for resumed agent session
    const firstMessage = initialMessages?.[0];
    if (firstMessage && 'teamName' in firstMessage && 'agentName' in firstMessage) {
      const teamName = firstMessage.teamName as string | undefined;
      const agentName = firstMessage.agentName as string | undefined;
      if (teamName && agentName) {
        // Would initialize teammate context from session
        console.log('[Swarm] Resumed session:', teamName, agentName);
      }
    }
  }, [setAppState, initialMessages, enabled]);
}

// ── Task List Watcher Hook ───────────────────────────────────────────────

export interface TaskListWatcherOptions {
  taskListId?: string;
  isLoading: boolean;
  onSubmitTask: (prompt: string) => boolean;
}

export function useTaskListWatcher({
  taskListId,
  isLoading,
  onSubmitTask,
}: TaskListWatcherOptions): void {
  const currentTaskRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taskListId) return;

    const checkForTasks = async (): Promise<void> => {
      if (isLoading) return;
      // Task checking logic would go here
      console.log('[TaskListWatcher] Checking for tasks');
    };

    const debouncedCheck = (): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(checkForTasks, 1000);
    };

    debouncedCheck();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [taskListId, isLoading, onSubmitTask]);
}

// ── Voice Hook ───────────────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'recording' | 'processing';

export interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  enabled: boolean;
  focusMode?: boolean;
}

export interface UseVoiceReturn {
  state: VoiceState;
  handleKeyEvent: (fallbackMs?: number) => void;
}

export function useVoice({
  onTranscript,
  onError,
  enabled,
  focusMode = false,
}: UseVoiceOptions): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const stateRef = useRef<VoiceState>('idle');
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateState = useCallback((newState: VoiceState) => {
    stateRef.current = newState;
    setState(newState);
  }, []);

  const cleanup = useCallback(() => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const handleKeyEvent = useCallback((fallbackMs = 600) => {
    if (!enabled) return;

    const currentState = stateRef.current;

    if (currentState === 'idle') {
      updateState('recording');
    } else if (currentState === 'recording') {
      // Reset release timer
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
      releaseTimerRef.current = setTimeout(() => {
        updateState('processing');
        setTimeout(() => {
          updateState('idle');
        }, 500);
      }, fallbackMs);
    }
  }, [enabled, updateState]);

  useEffect(() => {
    if (!enabled && stateRef.current !== 'idle') {
      cleanup();
      updateState('idle');
    }
    return cleanup;
  }, [enabled, cleanup, updateState]);

  return { state, handleKeyEvent };
}

// ── Voice Enabled Hook ────────────────────────────────────────────────────────

export function useVoiceEnabled(): boolean {
  const voiceEnabledSetting = useAppState(s => s.settings.voiceEnabled);
  return voiceEnabledSetting === true;
}

// ── Voice Integration Hook ────────────────────────────────────────────

export interface UseVoiceIntegrationOptions {
  setInputValueRaw: React.Dispatch<React.SetStateAction<string>>;
  inputValueRef: React.RefObject<string>;
  insertTextRef: React.RefObject<{ insert: (text: string) => void; setInputWithCursor: (value: string, cursor: number) => void; cursorOffset: number } | null>;
}

export interface UseVoiceIntegrationResult {
  stripTrailing: (maxStrip: number, opts?: { char?: string; anchor?: boolean; floor?: number }) => number;
  resetAnchor: () => void;
  handleKeyEvent: (fallbackMs?: number) => void;
  interimRange: { start: number; end: number } | null;
}

export function useVoiceIntegration({
  setInputValueRaw,
  inputValueRef,
  insertTextRef,
}: UseVoiceIntegrationOptions): UseVoiceIntegrationResult {
  const voicePrefixRef = useRef<string | null>(null);
  const voiceSuffixRef = useRef<string>('');
  const lastSetInputRef = useRef<string | null>(null);

  const voiceEnabled = useVoiceEnabled();
  const voiceState = useAppState(s => s.voiceState) as VoiceState;

  const stripTrailing = useCallback((maxStrip: number, { char = ' ', anchor = false, floor = 0 } = {}) => {
    const prev = inputValueRef.current;
    const offset = insertTextRef.current?.cursorOffset ?? prev.length;
    const beforeCursor = prev.slice(0, offset);
    const afterCursor = prev.slice(offset);
    
    let trailing = 0;
    while (trailing < beforeCursor.length && beforeCursor[beforeCursor.length - 1 - trailing] === char) {
      trailing++;
    }
    
    const stripCount = Math.max(0, Math.min(trailing - floor, maxStrip));
    const remaining = trailing - stripCount;
    const stripped = beforeCursor.slice(0, beforeCursor.length - stripCount);
    
    let gap = '';
    if (anchor) {
      voicePrefixRef.current = stripped;
      voiceSuffixRef.current = afterCursor;
      if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
        gap = ' ';
      }
    }
    
    const newValue = stripped + gap + afterCursor;
    if (anchor) lastSetInputRef.current = newValue;
    if (newValue !== prev) {
      insertTextRef.current?.setInputWithCursor(newValue, stripped.length) ?? setInputValueRaw(newValue);
    }
    
    return remaining;
  }, [setInputValueRaw, inputValueRef, insertTextRef]);

  const resetAnchor = useCallback(() => {
    const prefix = voicePrefixRef.current;
    if (prefix === null) return;
    const suffix = voiceSuffixRef.current;
    voicePrefixRef.current = null;
    voiceSuffixRef.current = '';
    const restored = prefix + suffix;
    insertTextRef.current?.setInputWithCursor(restored, prefix.length) ?? setInputValueRaw(restored);
  }, [setInputValueRaw, insertTextRef]);

  const voice = useVoice({
    onTranscript: () => {},
    onError: () => {},
    enabled: voiceEnabled,
    focusMode: false,
  });

  const interimRange = useMemo((): { start: number; end: number } | null => {
    if (voicePrefixRef.current === null) return null;
    if (voiceState !== 'recording') return null;
    return null;
  }, [voiceState]);

  return { stripTrailing, resetAnchor, handleKeyEvent: voice.handleKeyEvent, interimRange };
}

// ── Scheduled Tasks Hook ────────────────────────────────────────────

export interface UseScheduledTasksOptions {
  isLoading: boolean;
  assistantMode?: boolean;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useScheduledTasks({
  isLoading,
  assistantMode = false,
  setMessages,
}: UseScheduledTasksOptions): void {
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    // Cron scheduler setup would go here
    console.log('[ScheduledTasks] Scheduler started');

    return () => {
      console.log('[ScheduledTasks] Scheduler stopped');
    };
  }, [assistantMode]);
}

// ── IDE Integration Hook ────────────────────────────────────────────

export interface UseIDEIntegrationOptions {
  autoConnectIdeFlag?: boolean;
  ideToInstallExtension?: string | null;
  setDynamicMcpConfig: React.Dispatch<React.SetStateAction<Record<string, any> | undefined>>;
  setShowIdeOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  setIDEInstallationState: React.Dispatch<React.SetStateAction<any | null>>;
}

export function useIDEIntegration({
  autoConnectIdeFlag,
  ideToInstallExtension,
  setDynamicMcpConfig,
  setShowIdeOnboarding,
  setIDEInstallationState,
}: UseIDEIntegrationOptions): void {
  useEffect(() => {
    const initializeIDE = async (): Promise<void> => {
      console.log('[IDEIntegration] Initializing IDE');
      
      if (autoConnectIdeFlag || ideToInstallExtension) {
        setDynamicMcpConfig(prev => ({
          ...prev,
          ide: {
            type: 'sse-ide',
            url: 'ws://localhost:3100',
            ideName: 'vscode',
            scope: 'dynamic',
          },
        }));
      }
    };

    void initializeIDE();
  }, [autoConnectIdeFlag, ideToInstallExtension, setDynamicMcpConfig, setShowIdeOnboarding, setIDEInstallationState]);
}

// ── Diff Data Hook ────────────────────────────────────────────────────────

export interface DiffFile {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  isBinary: boolean;
  isLargeFile: boolean;
  isTruncated: boolean;
  isNewFile?: boolean;
  isUntracked?: boolean;
}

export interface DiffData {
  stats: { added: number; removed: number; files: number } | null;
  files: DiffFile[];
  loading: boolean;
}

export function useDiffData(): DiffData {
  const [diffResult, setDiffResult] = useState<{ added: number; removed: number; files: number } | null>(null);
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadDiffData = async (): Promise<void> => {
      try {
        // Would fetch git diff here
        if (!cancelled) {
          setDiffResult({ added: 0, removed: 0, files: 0 });
          setFiles([]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDiffResult(null);
          setFiles([]);
          setLoading(false);
        }
      }
    };

    void loadDiffData();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ stats: diffResult, files, loading }), [diffResult, files, loading]);
}

// ── Prompt Suggestion Hook ────────────────────────────────────────────────

export interface UsePromptSuggestionOptions {
  inputValue: string;
  isAssistantResponding: boolean;
}

export interface UsePromptSuggestionResult {
  suggestion: string | null;
  markAccepted: () => void;
  markShown: () => void;
  logOutcomeAtSubmission: (finalInput: string, opts?: { skipReset: boolean }) => void;
}

export function usePromptSuggestion({
  inputValue,
  isAssistantResponding,
}: UsePromptSuggestionOptions): UsePromptSuggestionResult {
  const promptSuggestion = useAppState(s => s.promptSuggestion);
  const setAppState = useSetAppState();
  const suggestionText = promptSuggestion.text;
  const shownAt = promptSuggestion.shownAt;

  const suggestion = isAssistantResponding || inputValue.length > 0 ? null : suggestionText;
  const isValidSuggestion = suggestionText && shownAt > 0;

  const markAccepted = useCallback(() => {
    if (!isValidSuggestion) return;
    setAppState(prev => ({
      ...prev,
      promptSuggestion: {
        ...prev.promptSuggestion,
        acceptedAt: Date.now(),
      },
    }));
  }, [isValidSuggestion, setAppState]);

  const markShown = useCallback(() => {
    setAppState(prev => {
      if (prev.promptSuggestion.shownAt !== 0 || !prev.promptSuggestion.text) {
        return prev;
      }
      return {
        ...prev,
        promptSuggestion: {
          ...prev.promptSuggestion,
          shownAt: Date.now(),
        },
      };
    });
  }, [setAppState]);

  const logOutcomeAtSubmission = useCallback(
    (finalInput: string, opts?: { skipReset: boolean }) => {
      if (!isValidSuggestion) return;
      
      if (!opts?.skipReset) {
        setAppState(prev => ({
          ...prev,
          promptSuggestion: {
            text: null,
            promptId: null,
            shownAt: 0,
            acceptedAt: 0,
            generationRequestId: null,
          },
        }));
      }
    },
    [isValidSuggestion, setAppState],
  );

  return { suggestion, markAccepted, markShown, logOutcomeAtSubmission };
}

// ── Command Keybindings Hook ────────────────────────────────────────────────

export interface CommandKeybindingHandlersOptions {
  onSubmit: (input: string, helpers?: any, ...rest: any[]) => void;
  isActive?: boolean;
}

export function CommandKeybindingHandlers({
  onSubmit,
  isActive = true,
}: CommandKeybindingHandlersOptions): null {
  useEffect(() => {
    if (!isActive) return;
    // Command keybindings setup would go here
  }, [onSubmit, isActive]);

  return null;
}

// ── Exit On Ctrl+C/D Hook ────────────────────────────────────────────────

export interface ExitState {
  pending: boolean;
  keyName: 'Ctrl-C' | 'Ctrl-D' | null;
}

export interface UseExitOnCtrlCDOptions {
  useKeybindingsHook: (handlers: Record<string, () => void>, options?: any) => void;
  onInterrupt?: () => boolean;
  onExit?: () => void;
  isActive?: boolean;
}

export function useExitOnCtrlCD({
  useKeybindingsHook,
  onInterrupt,
  onExit,
  isActive = true,
}: UseExitOnCtrlCDOptions): ExitState {
  const [exitState, setExitState] = useState<ExitState>({
    pending: false,
    keyName: null,
  });
  const pendingRef = useRef(false);
  const exitFnRef = useRef(onExit);

  useEffect(() => {
    exitFnRef.current = () => {
      if (onInterrupt && onInterrupt()) return;
      pendingRef.current = true;
      setExitState({ pending: true, keyName: 'Ctrl-C' });
      setTimeout(() => {
        pendingRef.current = false;
        setExitState({ pending: false, keyName: null });
      }, 2000);
    };
  }, [onInterrupt]);

  const keybindingsHook = useKeybindingsHook;
  if (typeof keybindingsHook === 'function') {
    keybindingsHook(
      {
        'app:interrupt': () => { exitFnRef.current?.(); },
        'app:exit': () => { exitFnRef.current?.(); },
      },
      { context: 'Global', isActive },
    );
  }

  return exitState;
}

// ── Log Messages Hook ────────────────────────────────────────────────

export interface UseLogMessagesOptions {
  messages: any[];
  ignore?: boolean;
}

export function useLogMessages({
  messages,
  ignore = false,
}: UseLogMessagesOptions): void {
  const teamContext = useAppState(s => s.teamContext);
  const lastRecordedLengthRef = useRef(0);
  const firstMessageUuidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (ignore) return;

    const currentFirstUuid = messages[0]?.uuid;
    const prevLength = lastRecordedLengthRef.current;

    if (currentFirstUuid === undefined || prevLength >= messages.length) return;

    const startIndex = prevLength;
    const slice = messages.slice(startIndex);

    if (slice.length > 0) {
      // Would record to transcript here
      console.log('[LogMessages] Recording', slice.length, 'messages');
    }

    lastRecordedLengthRef.current = messages.length;
    firstMessageUuidRef.current = currentFirstUuid;
  }, [messages, ignore, teamContext?.teamName, teamContext?.selfAgentName]);
}

// ── Merged Commands Hook ────────────────────────────────────────────

export interface Command {
  name: string;
  description?: string;
  isHidden?: boolean;
}

export function useMergedCommands(
  initialCommands: Command[],
  mcpCommands: Command[],
): Command[] {
  return useMemo(() => {
    if (mcpCommands.length > 0) {
      const seen = new Map<string, Command>();
      for (const cmd of [...initialCommands, ...mcpCommands]) {
        if (!seen.has(cmd.name)) {
          seen.set(cmd.name, cmd);
        }
      }
      return Array.from(seen.values());
    }
    return initialCommands;
  }, [initialCommands, mcpCommands]);
}

// ── Typeahead Hook ─────────────────────────────────────────────

export interface SuggestionItem {
  id: string;
  displayText: string;
  description?: string;
  metadata?: any;
}

export interface UseTypeaheadOptions {
  onInputChange: (value: string) => void;
  onSubmit: (value: string, isSubmittingSlashCommand?: boolean) => void;
  setCursorOffset: (offset: number) => void;
  input: string;
  cursorOffset: number;
  commands: any[];
  mode: string;
  agents: any[];
  setSuggestionsState: (f: (prev: { suggestions: SuggestionItem[]; selectedSuggestion: number; commandArgumentHint?: string }) => {
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  }) => void;
  suggestionsState: {
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  };
  suppressSuggestions?: boolean;
  markAccepted?: () => void;
  onModeChange?: (mode: string) => void;
}

export interface UseTypeaheadResult {
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  handleKeyDown: (e: any) => void;
}

export function useTypeahead({
  onInputChange,
  onSubmit,
  setCursorOffset,
  input,
  cursorOffset,
  commands,
  mode,
  setSuggestionsState,
  suggestionsState,
  suppressSuggestions = false,
  markAccepted,
}: UseTypeaheadOptions): UseTypeaheadResult {
  const [suggestionType, setSuggestionType] = useState<string>('none');
  const prevInputRef = useRef(input);

  useEffect(() => {
    if (suppressSuggestions) return;
    if (prevInputRef.current === input) return;
    prevInputRef.current = input;

    // Typeahead logic here
  }, [input, suppressSuggestions]);

  const handleKeyDown = useCallback((e: any) => {
    if (e.key === 'Tab' && suggestionsState.suggestions.length > 0) {
      const selectedSuggestion = suggestionsState.selectedSuggestion >= 0 
        ? suggestionsState.selectedSuggestion 
        : 0;
      const suggestion = suggestionsState.suggestions[selectedSuggestion];
      if (suggestion) {
        onInputChange(suggestion.displayText);
        setCursorOffset(suggestion.displayText.length);
        markAccepted?.();
      }
    }
  }, [suggestionsState, onInputChange, setCursorOffset, markAccepted]);

  return {
    suggestions: suggestionsState.suggestions,
    selectedSuggestion: suggestionsState.selectedSuggestion,
    handleKeyDown,
  };
}

// ── Vim Input Hook ────────────────────────────────────────────────

export type VimMode = 'INSERT' | 'NORMAL';

export interface VimInputState {
  value: string;
  offset: number;
  onInput: (rawInput: string, key: any) => void;
  mode: VimMode;
  setMode: (mode: VimMode) => void;
}

export interface UseVimInputOptions {
  value: string;
  onChange: (value: string) => void;
  columns?: number;
  onModeChange?: (mode: VimMode) => void;
  onUndo?: () => void;
  inputFilter?: (input: string, key: any) => string;
}

export function useVimInput({
  value,
  onChange,
  columns = 80,
  onModeChange,
  onUndo,
  inputFilter,
}: UseVimInputOptions): VimInputState {
  const vimStateRef = useRef({ mode: 'INSERT' as VimMode, insertedText: '' });
  const [mode, setMode] = useState<VimMode>('INSERT');

  const switchToInsertMode = useCallback((offset?: number): void => {
    vimStateRef.current = { mode: 'INSERT', insertedText: '' };
    setMode('INSERT');
    onModeChange?.('INSERT');
  }, [onModeChange]);

  const switchToNormalMode = useCallback((): void => {
    vimStateRef.current = { mode: 'NORMAL' as const, insertedText: '' };
    setMode('NORMAL');
    onModeChange?.('NORMAL');
  }, [onModeChange]);

  const handleInput = useCallback((rawInput: string, key: any): void => {
    const filtered = inputFilter ? inputFilter(rawInput, key) : rawInput;
    const input = vimStateRef.current.mode === 'INSERT' ? filtered : rawInput;

    if (key.escape && vimStateRef.current.mode === 'INSERT') {
      switchToNormalMode();
      return;
    }

    if (vimStateRef.current.mode === 'INSERT') {
      if (key.backspace || key.delete) {
        if (vimStateRef.current.insertedText.length > 0) {
          vimStateRef.current = {
            mode: 'INSERT',
            insertedText: vimStateRef.current.insertedText.slice(0, -1),
          };
        }
      } else {
        vimStateRef.current = {
          mode: 'INSERT',
          insertedText: vimStateRef.current.insertedText + input,
        };
      }
      onChange(value + input);
    }
  }, [inputFilter, switchToNormalMode, onChange, value]);

  const setModeExternal = useCallback((newMode: VimMode) => {
    vimStateRef.current = { mode: newMode, insertedText: '' };
    setMode(newMode);
    onModeChange?.(newMode);
  }, [onModeChange]);

  return {
    value,
    offset: 0,
    onInput: handleInput,
    mode,
    setMode: setModeExternal,
  };
}

// ── Virtual Scroll Hook ──────────────────────────────────────

export interface VirtualScrollOptions {
  scrollRef: React.RefObject<{ subscribe: (fn: () => void) => () => void; getScrollTop: () => number; getViewportHeight: () => number; isSticky: () => boolean } | null>;
  itemKeys: readonly string[];
  columns: number;
}

export interface VirtualScrollResult {
  range: readonly [number, number];
  topSpacer: number;
  bottomSpacer: number;
  measureRef: (key: string) => (el: any) => void;
  spacerRef: React.RefObject<any | null>;
  offsets: ArrayLike<number>;
  getItemTop: (index: number) => number;
  getItemElement: (index: number) => any;
  getItemHeight: (index: number) => number | undefined;
  scrollToIndex: (i: number) => void;
}

export function useVirtualScroll({
  scrollRef,
  itemKeys,
  columns,
}: VirtualScrollOptions): VirtualScrollResult {
  const heightCache = useRef(new Map<string, number>());
  const offsetVersionRef = useRef(0);
  const offsetsRef = useRef<Float64Array>(new Float64Array(0));
  const itemRefs = useRef(new Map<string, any>());
  const refCache = useRef(new Map<string, (el: any) => void>());
  const prevColumns = useRef(columns);
  const listOriginRef = useRef(0);
  const spacerRef = useRef<any | null>(null);

  useEffect(() => {
    if (prevColumns.current !== columns) {
      const ratio = prevColumns.current / columns;
      prevColumns.current = columns;
      for (const [k, h] of heightCache.current) {
        heightCache.current.set(k, Math.max(1, Math.round(h * ratio)));
      }
      offsetVersionRef.current++;
    }
  }, [columns]);

  const n = itemKeys.length;
  if (offsetsRef.current.length !== n + 1) {
    offsetsRef.current = new Float64Array(n + 1);
  }
  offsetsRef.current[0] = 0;
  for (let i = 0; i < n; i++) {
    offsetsRef.current[i + 1] = offsetsRef.current[i] + (heightCache.current.get(itemKeys[i]) ?? 3);
  }

  const scrollTop = scrollRef.current?.getScrollTop() ?? 0;
  const viewportH = scrollRef.current?.getViewportHeight() ?? 0;
  const isSticky = scrollRef.current?.isSticky() ?? true;

  const totalHeight = offsetsRef.current[n]!;
  let start = 0;
  let end = n;

  if (isSticky) {
    start = Math.max(0, n - 30);
    end = n;
  } else {
    const budget = viewportH + 160;
    start = n;
    while (start > 0 && totalHeight - offsetsRef.current[start - 1]! < budget) {
      start--;
    }
    end = Math.min(n, start + 300);
  }

  const measureRef = useCallback((key: string) => {
    let fn = refCache.current.get(key);
    if (!fn) {
      fn = (el: any) => {
        if (el?.yogaNode) {
          const h = el.yogaNode.getComputedHeight();
          if (h > 0 && heightCache.current.get(key) !== h) {
            heightCache.current.set(key, h);
            offsetVersionRef.current++;
          }
          itemRefs.current.set(key, el);
        } else {
          itemRefs.current.delete(key);
        }
      };
      refCache.current.set(key, fn);
    }
    return fn;
  }, []);

  const getItemTop = useCallback((index: number) => {
    const el = itemRefs.current.get(itemKeys[index]);
    if (!el?.yogaNode) return -1;
    return el.yogaNode.getComputedTop();
  }, [itemKeys]);

  const getItemElement = useCallback((index: number) => itemRefs.current.get(itemKeys[index]) ?? null, [itemKeys]);
  const getItemHeight = useCallback((index: number) => heightCache.current.get(itemKeys[index]), [itemKeys]);

  const scrollToIndex = useCallback((i: number) => {
    if (i < 0 || i >= n) return;
    const target = scrollRef.current;
    if (target && 'scrollTo' in target) {
      (target as any).scrollTo(offsetsRef.current[i]! + listOriginRef.current);
    }
  }, [scrollRef, n]);

  const effBottomSpacer = totalHeight - offsetsRef.current[end]!;
  const effTopSpacer = offsetsRef.current[start]!;

  return {
    range: [start, end] as const,
    topSpacer: effTopSpacer,
    bottomSpacer: effBottomSpacer,
    measureRef,
    spacerRef,
    offsets: offsetsRef.current,
    getItemTop,
    getItemElement,
    getItemHeight,
    scrollToIndex,
  };
}

// ── Background Task Navigation Hook ────────────────────────────────

export interface UseBackgroundTaskNavigationOptions {
  onOpenBackgroundTasks?: () => void;
}

export interface UseBackgroundTaskNavigationResult {
  handleKeyDown: (e: any) => void;
}

export function useBackgroundTaskNavigation({
  onOpenBackgroundTasks,
}: UseBackgroundTaskNavigationOptions): UseBackgroundTaskNavigationResult {
  const tasks = useAppState(s => s.tasks);
  const viewSelectionMode = useAppState(s => s.viewSelectionMode);
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId);
  const selectedIPAgentIndex = useAppState(s => s.selectedIPAgentIndex);
  const setAppState = useSetAppState();

  const handleKeyDown = useCallback((e: any): void => {
    if (e.key === 'escape' && viewSelectionMode === 'viewing-agent') {
      e.preventDefault();
      setAppState(prev => ({
        ...prev,
        viewSelectionMode: 'none',
        viewingAgentTaskId: null,
      }));
      return;
    }

    if (e.key === 'escape' && viewSelectionMode === 'selecting-agent') {
      e.preventDefault();
      setAppState(prev => ({
        ...prev,
        viewSelectionMode: 'none',
        selectedIPAgentIndex: -1,
      }));
      return;
    }

    if (e.shift && (e.key === 'up' || e.key === 'down')) {
      e.preventDefault();
      const teammateCount = Object.keys(tasks).filter(t => t.startsWith('teammate-')).length;
      if (teammateCount > 0) {
        setAppState(prev => {
          const maxIdx = teammateCount;
          const cur = prev.selectedIPAgentIndex;
          const next = e.key === 'down' 
            ? (cur >= maxIdx ? -1 : cur + 1)
            : (cur <= -1 ? maxIdx : cur - 1);
          return {
            ...prev,
            viewSelectionMode: 'selecting-agent',
            selectedIPAgentIndex: next,
          };
        });
      } else {
        onOpenBackgroundTasks?.();
      }
      return;
    }

    if (e.key === 'return' && viewSelectionMode === 'selecting-agent') {
      e.preventDefault();
      if (selectedIPAgentIndex === -1) {
        setAppState(prev => ({
          ...prev,
          viewSelectionMode: 'none',
          viewingAgentTaskId: null,
        }));
      }
      return;
    }
  }, [tasks, viewSelectionMode, viewingAgentTaskId, selectedIPAgentIndex, setAppState, onOpenBackgroundTasks]);

  return { handleKeyDown };
}

// ── History Search Hook ──────────────────────────────────────────

export interface UseHistorySearchOptions {
  onAcceptHistory: (entry: { display: string; pastedContents?: any }) => void;
  currentInput: string;
  onInputChange: (input: string) => void;
  onCursorChange: (cursorOffset: number) => void;
  currentCursorOffset: number;
  onModeChange: (mode: string) => void;
  currentMode: string;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  setPastedContents: (contents: any) => void;
  currentPastedContents: any;
}

export interface UseHistorySearchResult {
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  historyMatch: { display: string; pastedContents?: any } | undefined;
  historyFailedMatch: boolean;
  handleKeyDown: (e: any) => void;
}

export function useHistorySearch({
  onAcceptHistory,
  currentInput,
  onInputChange,
  onCursorChange,
  currentCursorOffset,
  onModeChange,
  currentMode,
  isSearching,
  setIsSearching,
  setPastedContents,
  currentPastedContents,
}: UseHistorySearchOptions): UseHistorySearchResult {
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFailedMatch, setHistoryFailedMatch] = useState(false);
  const [originalInput, setOriginalInput] = useState(currentInput);
  const [originalCursorOffset, setOriginalCursorOffset] = useState(currentCursorOffset);
  const [originalMode, setOriginalMode] = useState(currentMode);
  const [originalPastedContents, setOriginalPastedContents] = useState(currentPastedContents);
  const [historyMatch, setHistoryMatch] = useState<{ display: string; pastedContents?: any } | undefined>(undefined);

  const handleKeyDown = useCallback((e: any): void => {
    if (!isSearching) return;

    if (e.key === 'backspace' && historyQuery === '') {
      e.preventDefault();
      onInputChange(originalInput);
      onCursorChange(originalCursorOffset);
      setPastedContents(originalPastedContents);
      setIsSearching(false);
    }

    if (e.key === 'return') {
      if (historyMatch) {
        onAcceptHistory({
          display: historyMatch.display,
          pastedContents: historyMatch.pastedContents,
        });
      } else {
        onInputChange(originalInput);
      }
      setIsSearching(false);
      setHistoryQuery('');
    }
  }, [isSearching, historyQuery, historyMatch, originalInput, originalCursorOffset, originalPastedContents, onInputChange, onCursorChange, onAcceptHistory, setPastedContents, setIsSearching]);

  useEffect(() => {
    if (isSearching) {
      setOriginalInput(currentInput);
      setOriginalCursorOffset(currentCursorOffset);
      setOriginalMode(currentMode);
      setOriginalPastedContents(currentPastedContents);
    }
  }, [isSearching, currentInput, currentCursorOffset, currentMode, currentPastedContents]);

  return {
    historyQuery,
    setHistoryQuery,
    historyMatch,
    historyFailedMatch,
    handleKeyDown,
  };
}

// ── Inbox Poller Hook ─────────────────────────────────────────────

export interface UseInboxPollerOptions {
  enabled: boolean;
  isLoading: boolean;
  focusedInputDialog?: string;
  onSubmitMessage: (formatted: string) => boolean;
}

export function useInboxPoller({
  enabled,
  isLoading,
  focusedInputDialog,
  onSubmitMessage,
}: UseInboxPollerOptions): void {
  const store = useAppStateStore();
  const setAppState = useSetAppState();
  const inboxMessageCount = useAppState(s => s.inbox.messages.length);

  const poll = useCallback(async () => {
    if (!enabled) return;

    const currentAppState = store.getState();
    const teamContext = currentAppState.teamContext;

    if (!teamContext?.teammates) return;

    console.log('[InboxPoller] Polling');
  }, [enabled, store]);

  useEffect(() => {
    if (!enabled) return;
    if (isLoading || focusedInputDialog) return;

    const pendingMessages = store.getState().inbox.messages.filter(m => m.status === 'pending');
    if (pendingMessages.length === 0) return;

    const formatted = pendingMessages.map(m => m.text).join('\n\n');
    const submitted = onSubmitMessage(formatted);
    if (submitted) {
      setAppState(prev => ({
        ...prev,
        inbox: { messages: [] },
      }));
    }
  }, [enabled, isLoading, focusedInputDialog, onSubmitMessage, setAppState, inboxMessageCount, store]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      void poll();
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, poll]);
}
