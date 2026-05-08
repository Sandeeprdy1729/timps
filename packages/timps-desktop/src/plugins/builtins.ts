import { Plugin, PluginManifest, PluginCapabilities, PluginAPI, PERMISSIONS } from '../core/types';

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
}

export interface KeyboardPluginConfig {
  shortcuts: KeyboardShortcut[];
  enabled: boolean;
}

export class KeyboardPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/keyboard',
    name: 'Keyboard Shortcuts',
    version: '1.0.0',
    description: 'Provides global keyboard shortcut management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['keyboard', 'shortcuts', 'hotkeys'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      globalShortcuts: true,
    },
  };

  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled = true;

  async onInit(): Promise<void> {
    this.registerDefaultShortcuts();
    this.attachEventListeners();
  }

  async onEnable(): Promise<void> {
    this.enabled = true;
  }

  async onDisable(): Promise<void> {
    this.enabled = false;
  }

  private registerDefaultShortcuts(): void {
    const defaults: KeyboardShortcut[] = [
      {
        id: 'quick-capture',
        key: 'n',
        ctrl: true,
        shift: true,
        action: () => this.emitQuickCapture(),
        description: 'Open quick capture',
      },
      {
        id: 'search',
        key: 'k',
        ctrl: true,
        shift: true,
        action: () => this.emitSearch(),
        description: 'Open search',
      },
      {
        id: 'settings',
        key: ',',
        ctrl: true,
        action: () => this.emitSettings(),
        description: 'Open settings',
      },
    ];

    defaults.forEach(shortcut => this.register(shortcut));
  }

  private attachEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    for (const shortcut of this.shortcuts.values()) {
      if (this.matchShortcut(event, shortcut)) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  };

  private matchShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
      event.code.toLowerCase() === shortcut.key.toLowerCase();

    const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
    const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = shortcut.alt ? event.altKey : !event.altKey;
    const metaMatch = shortcut.meta ? event.metaKey : true;

    return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
  }

  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  get(id: string): KeyboardShortcut | undefined {
    return this.shortcuts.get(id);
  }

  private emitQuickCapture(): void {
    window.dispatchEvent(new CustomEvent('plugin:quick-capture'));
  }

  private emitSearch(): void {
    window.dispatchEvent(new CustomEvent('plugin:search'));
  }

  private emitSettings(): void {
    window.dispatchEvent(new CustomEvent('plugin:settings'));
  }
}

export interface ClipboardPluginConfig {
  historySize: number;
  autoSave: boolean;
}

export class ClipboardPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/clipboard',
    name: 'Clipboard Manager',
    version: '1.0.0',
    description: 'Provides clipboard read/write and history',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['clipboard', 'copy', 'paste'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      clipboard: true,
    },
  };

  private history: string[] = [];
  private maxHistory = 20;
  private autoSave = true;

  async onEnable(): Promise<void> {
    this.loadHistory();
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('clipboard-history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    }
  }

  private saveHistory(): void {
    if (this.autoSave) {
      localStorage.setItem('clipboard-history', JSON.stringify(this.history));
    }
  }

  async write(text: string): Promise<void> {
    try {
      await navigatorClipboard.writeText(text);
      this.history.unshift(text);
      if (this.history.length > this.maxHistory) {
        this.history.pop();
      }
      this.saveHistory();
    } catch (error) {
      throw new Error(`Failed to write to clipboard: ${error}`);
    }
  }

  async read(): Promise<string> {
    try {
      const text = await navigatorClipboard.readText();
      return text;
    } catch (error) {
      throw new Error(`Failed to read from clipboard: ${error}`);
    }
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  hasPermission(): Promise<boolean> {
    return navigatorClipboard.readText().then(() => true).catch(() => false);
  }
}

export interface NotificationPluginConfig {
  position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  maxVisible: number;
  duration: number;
}

export class NotificationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/notifications',
    name: 'Notifications',
    version: '1.0.0',
    description: 'Provides system notifications',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['notifications', 'alerts'],
  };

  public capabilities: PluginCapabilities = {
    api: {
      notifications: true,
    },
  };

  private queue: Notification[] = [];
  private maxVisible = 5;
  private duration = 3000;

  async show(options: { title: string; body?: string; icon?: string }): Promise<void> {
    if (Notification.permission === 'granted') {
      new Notification(options.title, {
        body: options.body,
        icon: options.icon,
      });
    } else if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon,
        });
      }
    }
  }

  async showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
    const event = new CustomEvent('plugin:toast', {
      detail: { message, type },
    });
    window.dispatchEvent(event);
  }

  requestPermission(): Promise<NotificationPermission> {
    return Notification.requestPermission();
  }
}

export class StoragePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/storage',
    name: 'Storage',
    version: '1.0.0',
    description: 'Provides persistent storage for plugins',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['storage', 'persistence'],
  };

  public capabilities: PluginCapabilities = {
    data: {
      storage: true,
    },
  };

  private store: Map<string, unknown> = new Map();

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const value = this.store.get(key);
    return (value as T) ?? defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

export class ThemePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/theme',
    name: 'Theme Manager',
    version: '1.0.0',
    description: 'Provides theme management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['theme', 'dark', 'light'],
  };

  public capabilities: PluginCapabilities = {};

  private currentTheme = 'light';

  async onInit(): Promise<void> {
    this.loadTheme();
  }

  private loadTheme(): void {
    const saved = localStorage.getItem('theme');
    if (saved) {
      this.setTheme(saved as 'light' | 'dark');
    }
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  getTheme(): string {
    return this.currentTheme;
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }
}

export const keyboardPlugin = new KeyboardPlugin();
export const clipboardPlugin = new ClipboardPlugin();
export const notificationPlugin = new NotificationPlugin();
export const storagePlugin = new StoragePlugin();
export const themePlugin = new ThemePlugin();

export function registerBuiltinPlugins(): Plugin[] {
  return [
    keyboardPlugin,
    clipboardPlugin,
    notificationPlugin,
    storagePlugin,
    themePlugin,
  ];
}