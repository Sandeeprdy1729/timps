export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  main?: string;
  entry?: string;
  icon?: string;
  screenshots?: string[];
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface PluginMetadata extends PluginManifest {
  installedAt?: number;
  updatedAt?: number;
  enabled: boolean;
  loaded: boolean;
  source: 'core' | 'builtin' | 'local' | 'registry' | 'npm';
  path?: string;
  size?: number;
  checksums?: Record<string, string>;
}

export interface PluginConfig {
  enabled: boolean;
  autoEnable?: boolean;
  config?: Record<string, unknown>;
  permissions?: string[];
}

export interface PluginCapabilities {
  triggers?: { id: string; name: string; description: string }[];
  actions?: { id: string; name: string; description: string }[];
  ui?: {
    toolbar?: boolean;
    sidebar?: boolean;
    panel?: boolean;
    modal?: boolean;
    statusBar?: boolean;
    contextMenu?: boolean;
    commands?: boolean;
  };
  api?: {
    filesystem?: boolean;
    network?: boolean;
    clipboard?: boolean;
    notifications?: boolean;
    systemTray?: boolean;
    globalShortcuts?: boolean;
    ipc?: boolean;
    menu?: boolean;
    dialog?: boolean;
  };
  data?: {
    storage?: boolean;
    database?: boolean;
    cache?: boolean;
  };
}

export interface PluginHooks {
  onInit?: () => void | Promise<void>;
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
  onUninstall?: () => void | Promise<void>;
  onConfigChange?: (config: Record<string, unknown>) => void;
  onInstall?: (version?: string) => void | Promise<void>;
  onUpdate?: (oldVersion: string, newVersion: string) => void | Promise<void>;
}

export interface PluginAPI {
  id: string;
  version: string;
  config: {
    get: <T>(key: string, defaultValue?: T) => T;
    set: <T>(key: string, value: T) => void;
    delete: (key: string) => void;
    has: (key: string) => boolean;
    clear: () => void;
  };
  storage: {
    get: <T>(key: string, defaultValue?: T) => Promise<T>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    keys: () => Promise<string[]>;
  };
  ui: {
    render: (component: React.ReactNode, container?: string) => void;
    unmount: (container?: string) => void;
    showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    showModal: (options: ModalOptions) => Promise<boolean>;
    createPanel: (options: PanelOptions) => string;
    removePanel: (id: string) => void;
    registerCommand: (command: CommandDefinition) => void;
    unregisterCommand: (id: string) => void;
    createContextMenu: (items: ContextMenuItem[], position: { x: number; y: number }) => void;
  };
  events: {
    on: (event: string, handler: EventHandler) => void;
    off: (event: string, handler?: EventHandler) => void;
    emit: (event: string, data?: unknown) => void;
    once: (event: string, handler: EventHandler) => void;
  };
  ipc: {
    send: (channel: string, data?: unknown) => void;
    invoke: <T>(channel: string, data?: unknown) => Promise<T>;
    on: (channel: string, handler: IpcHandler) => void;
    off: (channel: string, handler?: IpcHandler) => void;
  };
  system: {
    openExternal: (url: string) => Promise<void>;
    showItemInFolder: (path: string) => void;
    getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents') => Promise<string>;
    notification: (options: NotificationOptions) => Promise<void>;
  };
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  http: {
    get: <T>(url: string, options?: HttpOptions) => Promise<HttpResponse<T>>;
    post: <T>(url: string, data?: unknown, options?: HttpOptions) => Promise<HttpResponse<T>>;
  };
}

export interface Plugin {
  manifest: PluginManifest;
  capabilities?: PluginCapabilities;
  hooks?: PluginHooks;
  api?: PluginAPI;
}

export type EventHandler = (data?: unknown) => void;
export type IpcHandler = (event: IpcEvent, data?: unknown) => unknown;

export interface IpcEvent {
  sender: string;
  id: string;
}

export interface ModalOptions {
  title?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  closable?: boolean;
  maskClosable?: boolean;
  width?: number | string;
  height?: number | string;
}

export interface PanelOptions {
  id?: string;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
  width?: number;
  height?: number;
  render: () => React.ReactNode;
}

export interface CommandDefinition {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  action?: () => void;
  submenu?: ContextMenuItem[];
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'low' | 'normal' | 'critical';
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface PluginError extends Error {
  pluginId?: string;
  code?: string;
}

export class PluginError extends Error implements PluginError {
  constructor(
    message: string,
    public pluginId?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export const PLUGIN_EVENTS = {
  READY: 'plugin:ready',
  LOADED: 'plugin:loaded',
  UNLOADED: 'plugin:unloaded',
  ENABLED: 'plugin:enabled',
  DISABLED: 'plugin:disabled',
  INSTALLED: 'plugin:installed',
  UNINSTALLED: 'plugin:uninstalled',
  UPDATED: 'plugin:updated',
  ERROR: 'plugin:error',
} as const;

export const DEFAULT_PLUGINS = {
  KEYBOARD: '@timps/keyboard',
  CLIPBOARD: '@timps/clipboard',
  NOTIFICATIONS: '@timps/notifications',
  STORAGE: '@timps/storage',
  THEME: '@timps/theme',
} as const;

export const PERMISSIONS = {
  FILESYSTEM_READ: 'filesystem:read',
  FILESYSTEM_WRITE: 'filesystem:write',
  FILESYSTEM_READ_WRITE: 'filesystem:readWrite',
  NETWORK_REQUEST: 'network:request',
  NETWORK_CLIENT: 'network:client',
  CLIPBOARD_READ: 'clipboard:read',
  CLIPBOARD_WRITE: 'clipboard:write',
  NOTIFICATIONS: 'notifications',
  SYSTEM_TRAY: 'systemTray',
  GLOBAL_SHORTCUTS: 'globalShortcuts',
  IPC_SEND: 'ipc:send',
  IPC_RECEIVE: 'ipc:receive',
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE: 'dialog:save',
  PROCESS_SPAWN: 'process:spawn',
} as const;