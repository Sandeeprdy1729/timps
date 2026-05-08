import { Plugin, PluginMetadata, Plugin, PluginCapabilities } from './types';

export interface Plugin {
  manifest: PluginManifest;
  capabilities?: PluginCapabilities;
  hooks?: PluginHooks;
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
    showModal: (options: {
      title?: string;
      content: React.ReactNode;
      footer?: React.ReactNode;
      closable?: boolean;
      maskClosable?: boolean;
      width?: number | string;
      height?: number | string;
    }) => Promise<boolean>;
  };
  events: {
    on: (event: string, handler: (data?: unknown) => void) => void;
    off: (event: string, handler?: (data?: unknown) => void) => void;
    emit: (event: string, data?: unknown) => void;
    once: (event: string, handler: (data?: unknown) => void) => void;
  };
  ipc: {
    send: (channel: string, data?: unknown) => void;
    invoke: <T>(channel: string, data?: unknown) => Promise<T>;
    on: (channel: string, handler: (event: unknown, data?: unknown) => unknown) => void;
    off: (channel: string, handler?: (event: unknown, data?: unknown) => unknown) => void;
  };
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

export class SnippetPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/snippets',
    name: 'Code Snippets',
    version: '1.0.0',
    description: 'Organize and manage code snippets',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['snippets', 'code', 'templates'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { sidebar: true, commands: true },
  };

  private snippets: Map<string, {
    id: string;
    title: string;
    code: string;
    language: string;
    tags: string[];
    created: Date;
    updated: Date;
  }> = new Map();

  async create(title: string, code: string, language: string, tags: string[]): Promise<string> {
    const id = `snippet-${Date.now()}`;
    this.snippets.set(id, {
      id,
      title,
      code,
      language,
      tags,
      created: new Date(),
      updated: new Date(),
    });
    return id;
  }

  async get(id: string): Promise<{
    id: string;
    title: string;
    code: string;
    language: string;
    tags: string[];
  } | null> {
    return this.snippets.get(id) || null;
  }

  async update(id: string, updates: Partial<{
    title: string;
    code: string;
    language: string;
    tags: string[];
  }>): Promise<void> {
    const existing = this.snippets.get(id);
    if (existing) {
      this.snippets.set(id, { ...existing, ...updates, updated: new Date() });
    }
  }

  async delete(id: string): Promise<void> {
    this.snippets.delete(id);
  }

  async list(filter?: { language?: string; tag?: string }): Promise<Array<{
    id: string;
    title: string;
    language: string;
    tags: string[];
  }>> {
    let snippets = Array.from(this.snippets.values());
    if (filter?.language) {
      snippets = snippets.filter(s => s.language === filter.language);
    }
    if (filter?.tag) {
      snippets = snippets.filter(s => s.tags.includes(filter.tag!));
    }
    return snippets.map(s => ({
      id: s.id,
      title: s.title,
      language: s.language,
      tags: s.tags,
    }));
  }

  async search(query: string): Promise<Array<{
    id: string;
    title: string;
    code: string;
    language: string;
  }>> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.snippets.values())
      .filter(s => s.title.toLowerCase().includes(lowerQuery) || s.code.toLowerCase().includes(lowerQuery))
      .map(s => ({
        id: s.id,
        title: s.title,
        code: s.code,
        language: s.language,
      }));
  }
}

export class TaskPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tasks',
    name: 'Task Manager',
    version: '1.0.0',
    description: 'Task and todo management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tasks', 'todos', 'project-management'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { sidebar: true, panel: true },
  };

  private tasks: Map<string, {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    dueDate?: Date;
    tags: string[];
    created: Date;
    updated: Date;
  }> = new Map();

  async create(title: string, options?: {
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: Date;
    tags?: string[];
  }): Promise<string> {
    const id = `task-${Date.now()}`;
    this.tasks.set(id, {
      id,
      title,
      description: options?.description,
      completed: false,
      priority: options?.priority || 'medium',
      dueDate: options?.dueDate,
      tags: options?.tags || [],
      created: new Date(),
      updated: new Date(),
    });
    return id;
  }

  async get(id: string): Promise<{
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority: string;
    dueDate?: Date;
    tags: string[];
  } | null> {
    return this.tasks.get(id) || null;
  }

  async update(id: string, updates: Partial<{
    title: string;
    description: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    dueDate: Date;
    tags: string[];
  }>): Promise<void> {
    const existing = this.tasks.get(id);
    if (existing) {
      this.tasks.set(id, { ...existing, ...updates, updated: new Date() });
    }
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async complete(id: string): Promise<void> {
    this.update(id, { completed: true });
  }

  async uncomplete(id: string): Promise<void> {
    this.update(id, { completed: false });
  }

  async list(filter?: {
    completed?: boolean;
    priority?: 'low' | 'medium' | 'high';
    overdue?: boolean;
  }): Promise<Array<{
    id: string;
    title: string;
    completed: boolean;
    priority: string;
    dueDate?: Date;
  }>> {
    let tasks = Array.from(this.tasks.values());
    if (filter?.completed !== undefined) {
      tasks = tasks.filter(t => t.completed === filter.completed);
    }
    if (filter?.priority) {
      tasks = tasks.filter(t => t.priority === filter.priority);
    }
    if (filter?.overdue) {
      const now = new Date();
      tasks = tasks.filter(t => t.dueDate && t.dueDate < now);
    }
    return tasks.map(t => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      priority: t.priority,
      dueDate: t.dueDate,
    }));
  }

  async getStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  }> {
    const tasks = Array.from(this.tasks.values());
    const now = new Date();
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      pending: tasks.filter(t => !t.completed).length,
      overdue: tasks.filter(t => t.dueDate && t.dueDate < now).length,
    };
  }
}

export class BookmarkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/bookmarks',
    name: 'Bookmark Manager',
    version: '1.0.0',
    description: 'Organize and manage bookmarks',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['bookmarks', 'favorites', 'links'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { sidebar: true },
  };

  private bookmarks: Map<string, {
    id: string;
    url: string;
    title: string;
    description?: string;
    favicon?: string;
    tags: string[];
    folder?: string;
    visitCount: number;
    lastVisited?: Date;
    created: Date;
  }> = new Map();

  async create(url: string, title: string, options?: {
    description?: string;
    tags?: string[];
    folder?: string;
  }): Promise<string> {
    const id = `bookmark-${Date.now()}`;
    this.bookmarks.set(id, {
      id,
      url,
      title,
      description: options?.description,
      tags: options?.tags || [],
      folder: options?.folder,
      visitCount: 0,
      created: new Date(),
    });
    return id;
  }

  async get(id: string): Promise<{
    id: string;
    url: string;
    title: string;
    tags: string[];
    folder?: string;
    visitCount: number;
  } | null> {
    return this.bookmarks.get(id) || null;
  }

  async visit(id: string): Promise<string | null> {
    const bookmark = this.bookmarks.get(id);
    if (bookmark) {
      bookmark.visitCount++;
      bookmark.lastVisited = new Date();
      return bookmark.url;
    }
    return null;
  }

  async delete(id: string): Promise<void> {
    this.bookmarks.delete(id);
  }

  async list(filter?: { folder?: string; tag?: string }): Promise<Array<{
    id: string;
    url: string;
    title: string;
    tags: string[];
    visitCount: number;
  }>> {
    let bookmarks = Array.from(this.bookmarks.values());
    if (filter?.folder) {
      bookmarks = bookmarks.filter(b => b.folder === filter.folder);
    }
    if (filter?.tag) {
      bookmarks = bookmarks.filter(b => b.tags.includes(filter.tag!));
    }
    return bookmarks.map(b => ({
      id: b.id,
      url: b.url,
      title: b.title,
      tags: b.tags,
      visitCount: b.visitCount,
    }));
  }

  async search(query: string): Promise<Array<{
    id: string;
    url: string;
    title: string;
  }>> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.bookmarks.values())
      .filter(b => b.title.toLowerCase().includes(lowerQuery) || b.url.toLowerCase().includes(lowerQuery))
      .map(b => ({
        id: b.id,
        url: b.url,
        title: b.title,
      }));
  }

  async getMostVisited(limit = 10): Promise<Array<{
    id: string;
    url: string;
    title: string;
    visitCount: number;
  }>> {
    return Array.from(this.bookmarks.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit)
      .map(b => ({
        id: b.id,
        url: b.url,
        title: b.title,
        visitCount: b.visitCount,
      }));
  }
}

export class NotesPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/notes',
    name: 'Notes',
    version: '1.0.0',
    description: 'Quick notes and journaling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['notes', 'journal', 'markdown'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { sidebar: true, commands: true },
  };

  private notes: Map<string, {
    id: string;
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    created: Date;
    updated: Date;
  }> = new Map();

  async create(title: string, content: string, tags: string[] = []): Promise<string> {
    const id = `note-${Date.now()}`;
    this.notes.set(id, {
      id,
      title,
      content,
      tags,
      pinned: false,
      created: new Date(),
      updated: new Date(),
    });
    return id;
  }

  async get(id: string): Promise<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    updated: Date;
  } | null> {
    return this.notes.get(id) || null;
  }

  async update(id: string, updates: Partial<{
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
  }>): Promise<void> {
    const existing = this.notes.get(id);
    if (existing) {
      this.notes.set(id, { ...existing, ...updates, updated: new Date() });
    }
  }

  async delete(id: string): Promise<void> {
    this.notes.delete(id);
  }

  async list(filter?: { pinned?: boolean; tag?: string }): Promise<Array<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    updated: Date;
  }>> {
    let notes = Array.from(this.notes.values());
    if (filter?.pinned !== undefined) {
      notes = notes.filter(n => n.pinned === filter.pinned);
    }
    if (filter?.tag) {
      notes = notes.filter(n => n.tags.includes(filter.tag!));
    }
    notes.sort((a, b) => b.updated.getTime() - a.updated.getTime());
    return notes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      tags: n.tags,
      pinned: n.pinned,
      updated: n.updated,
    }));
  }

  async search(query: string): Promise<Array<{
    id: string;
    title: string;
    content: string;
  }>> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.notes.values())
      .filter(n => n.title.toLowerCase().includes(lowerQuery) || n.content.toLowerCase().includes(lowerQuery))
      .map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
      }));
  }

  async pin(id: string): Promise<void> {
    this.update(id, { pinned: true });
  }

  async unpin(id: string): Promise<void> {
    this.update(id, { pinned: false });
  }
}

export class CalculatorPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/calculator',
    name: 'Calculator',
    version: '1.0.0',
    description: 'Mathematical calculator',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['calculator', 'math', 'converter'],
  };

  public capabilities: PluginCapabilities = {
    ui: { modal: true, commands: true },
  };

  async evaluate(expression: string): Promise<number> {
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    try {
      return Function(`return ${sanitized}`)();
    } catch {
      throw new Error('Invalid expression');
    }
  }

  async convert(value: number, from: string, to: string): Promise<number> {
    const conversions: Record<string, Record<string, number>> = {
      km: { mi: 0.621371 },
      mi: { km: 1.60934 },
      kg: { lb: 2.20462 },
      lb: { kg: 0.453592 },
      c: { f: (v: number) => v * 9/5 + 32, k: (v: number) => v + 273.15 },
      f: { c: (v: number) => (v - 32) * 5/9, k: (v: number) => (v - 32) * 5/9 + 273.15 },
      k: { c: (v: number) => v - 273.15, f: (v: number) => (v - 273.15) * 9/5 + 32 },
    };
    const rates = conversions[from];
    if (!rates || typeof rates[to] === 'number') {
      return value * (rates?.[to] as number || 1);
    }
    return (rates[to] as (v: number) => number)(value);
  }

  async formatCurrency(amount: number, currency: string): Promise<string> {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  async formatPercent(value: number, decimals = 2): Promise<string> {
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

export class ConverterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/converter',
    name: 'Unit Converter',
    version: '1.0.0',
    description: 'Unit conversion utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['converter', 'units', 'conversion'],
  };

  public capabilities: PluginCapabilities = {
    ui: { commands: true },
  };

  private units: Record<string, Record<string, {
    to: (v: number) => number;
    from: (v: number) => number;
  }> = {};

  async registerUnit(category: string, unit: string, to: (v: number) => number, from: (v: number) => number): Promise<void> {
    if (!this.units[category]) {
      this.units[category] = {};
    }
    this.units[category][unit] = { to, from };
  }

  async convert(value: number, fromUnit: string, toUnit: string, category: string): Promise<number> {
    const unitData = this.units[category];
    if (!unitData) {
      throw new Error(`Unknown category: ${category}`);
    }
    const from = unitData[fromUnit];
    const to = unitData[toUnit];
    if (!from || !to) {
      throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
    }
    const inBase = from.to(value);
    return to.from(inBase);
  }

  async getCategories(): Promise<string[]> {
    return Object.keys(this.units);
  }

  async getUnits(category: string): Promise<string[]> {
    return Object.keys(this.units[category] || {});
  }
}

export class TimerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/timer',
    name: 'Timer & Stopwatch',
    version: '1.0.0',
    description: 'Timer and stopwatch utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['timer', 'stopwatch', 'pomodoro'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true },
    ui: { commands: true },
  };

  private interval: number | null = null;
  private elapsed = 0;

  async start(duration: number, onTick?: (remaining: number) => void, onComplete?: () => void): Promise<void> {
    this.elapsed = 0;
    const endTime = Date.now() + duration;
    this.interval = window.setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      this.elapsed = duration - remaining;
      onTick?.(remaining);
      if (remaining <= 0) {
        this.stop();
        onComplete?.();
      }
    }, 1000);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async reset(): Promise<void> {
    await this.stop();
    this.elapsed = 0;
  }

  async getElapsed(): Promise<number> {
    return this.elapsed;
  }

  async formatTime(seconds: number): Promise<string> {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export class PomodoroPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/pomodoro',
    name: 'Pomodoro Timer',
    version: '1.0.0',
    description: 'Pomodoro productivity technique',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['pomodoro', 'timer', 'productivity'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true, globalShortcuts: true },
    ui: { statusBar: true },
  };

  private workDuration = 25 * 60;
  private breakDuration = 5 * 60;
  private longBreakDuration = 15 * 60;
  private sessions = 0;
  private currentPhase: 'work' | 'break' | 'longBreak' = 'work';

  async configure(options: {
    workDuration?: number;
    breakDuration?: number;
    longBreakDuration?: number;
  }): Promise<void> {
    if (options.workDuration) this.workDuration = options.workDuration;
    if (options.breakDuration) this.breakDuration = options.breakDuration;
    if (options.longBreakDuration) this.longBreakDuration = options.longBreakDuration;
  }

  async getSession(): Promise<number> {
    return this.sessions;
  }

  async getCurrentPhase(): Promise<'work' | 'break' | 'longBreak'> {
    return this.currentPhase;
  }

  async getNextPhase(): Promise<'work' | 'break' | 'longBreak'> {
    if (this.currentPhase === 'work') {
      this.sessions++;
      return this.sessions % 4 === 0 ? 'longBreak' : 'break';
    }
    return 'work';
  }

  async setPhase(phase: 'work' | 'break' | 'longBreak'): Promise<void> {
    this.currentPhase = phase;
  }

  async getDuration(phase?: 'work' | 'break' | 'longBreak'): Promise<number> {
    const target = phase || this.currentPhase;
    switch (target) {
      case 'work': return this.workDuration;
      case 'break': return this.breakDuration;
      case 'longBreak': return this.longBreakDuration;
    }
  }

  async resetSession(): Promise<void> {
    this.sessions = 0;
    this.currentPhase = 'work';
  }
}

export const snippetPlugin = new SnippetPlugin();
export const taskPlugin = new TaskPlugin();
export const bookmarkPlugin = new BookmarkPlugin();
export const notesPlugin = new NotesPlugin();
export const calculatorPlugin = new CalculatorPlugin();
export const converterPlugin = new ConverterPlugin();
export const timerPlugin = new TimerPlugin();
export const pomodoroPlugin = new PomodoroPlugin();

export function registerProductivityPlugins(): Plugin[] {
  return [
    snippetPlugin,
    taskPlugin,
    bookmarkPlugin,
    notesPlugin,
    calculatorPlugin,
    converterPlugin,
    timerPlugin,
    pomodoroPlugin,
  ];
}