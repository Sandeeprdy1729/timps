import React from 'react';
import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class WidgetPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/widgets',
    name: 'Widgets',
    version: '1.0.0',
    description: 'Home screen widgets',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['widgets', 'dashboard', 'gadgets'],
  };

  public capabilities: PluginCapabilities = {
    ui: { sidebar: true, panel: true },
  };

  private widgets: Map<string, {
    id: string;
    type: string;
    title: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }> = new Map();

  async addWidget(type: string, title: string, config: Record<string, unknown> = {}): Promise<string> {
    const id = `widget-${Date.now()}`;
    this.widgets.set(id, {
      id,
      type,
      title,
      config,
      position: { x: 0, y: this.widgets.size },
    });
    return id;
  }

  async removeWidget(id: string): Promise<void> {
    this.widgets.delete(id);
  }

  async updateWidget(id: string, config: Record<string, unknown>): Promise<void> {
    const widget = this.widgets.get(id);
    if (widget) {
      this.widgets.set(id, { ...widget, config: { ...widget.config, ...config } });
    }
  }

  async getWidgets(): Promise<Array<{ id: string; type: string; title: string }>> {
    return Array.from(this.widgets.values()).map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
    }));
  }

  async getWidget(id: string): Promise<{ config: Record<string, unknown> } | null> {
    return this.widgets.get(id) || null;
  }
}

export class WeatherPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/weather',
    name: 'Weather',
    version: '1.0.0',
    description: 'Weather widget and forecasts',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['weather', 'forecast', 'widget'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
    ui: { sidebar: true },
  };

  private location = 'auto';
  private apiKey = '';

  async configure(options: { location?: string; apiKey?: string }): Promise<void> {
    if (options.location) this.location = options.location;
    if (options.apiKey) this.apiKey = options.apiKey;
  }

  async getCurrent(): Promise<{
    temp: number;
    condition: string;
    humidity: number;
    wind: number;
    icon: string;
  }> {
    return {
      temp: 72,
      condition: 'Sunny',
      humidity: 45,
      wind: 10,
      icon: '☀️',
    };
  }

  async getForecast(days = 7): Promise<Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
  }>> {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        day: daysOfWeek[date.getDay()],
        high: 70 + Math.floor(Math.random() * 10),
        low: 55 + Math.floor(Math.random() * 10),
        condition: 'Sunny',
        icon: '☀️',
      };
    });
  }
}

export class CalendarPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/calendar',
    name: 'Calendar',
    version: '1.0.0',
    description: 'Calendar and event management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['calendar', 'events', 'scheduler'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { sidebar: true, panel: true },
  };

  private events: Map<string, {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end?: Date;
    allDay: boolean;
    recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    color?: string;
    reminders?: number[];
  }> = new Map();

  async createEvent(event: {
    title: string;
    description?: string;
    start: Date;
    end?: Date;
    allDay?: boolean;
    recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    color?: string;
    reminders?: number[];
  }): Promise<string> {
    const id = `event-${Date.now()}`;
    this.events.set(id, {
      id,
      ...event,
      allDay: event.allDay ?? false,
    });
    return id;
  }

  async getEvent(id: string): Promise<{
    title: string;
    description?: string;
    start: Date;
    end?: Date;
  } | null> {
    return this.events.get(id) || null;
  }

  async updateEvent(id: string, updates: Partial<{
    title: string;
    description: string;
    start: Date;
    end: Date;
  }>): Promise<void> {
    const existing = this.events.get(id);
    if (existing) {
      this.events.set(id, { ...existing, ...updates });
    }
  }

  async deleteEvent(id: string): Promise<void> {
    this.events.delete(id);
  }

  async listEvents(start: Date, end: Date): Promise<Array<{
    id: string;
    title: string;
    start: Date;
    allDay: boolean;
  }>> {
    return Array.from(this.events.values())
      .filter(e => e.start >= start && e.start <= end)
      .map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        allDay: e.allDay,
      }));
  }

  async getUpcoming(limit = 10): Promise<Array<{
    id: string;
    title: string;
    start: Date;
  }>> {
    const now = new Date();
    return Array.from(this.events.values())
      .filter(e => e.start > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, limit)
      .map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
      }));
  }
}

export class QuickLinkPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/quicklinks',
    name: 'Quick Links',
    version: '1.0.0',
    description: 'Quick access to frequently used links',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['quicklinks', 'shortcuts', 'favorites'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
    ui: { toolbar: true, commands: true },
  };

  private links: Map<string, {
    id: string;
    url: string;
    title: string;
    icon?: string;
    shortcut?: string;
    category?: string;
  }> = new Map();

  async addLink(url: string, title: string, options?: {
    icon?: string;
    shortcut?: string;
    category?: string;
  }): Promise<string> {
    const id = `link-${Date.now()}`;
    this.links.set(id, {
      id,
      url,
      title,
      ...options,
    });
    return id;
  }

  async removeLink(id: string): Promise<void> {
    this.links.delete(id);
  }

  async getLinks(filter?: { category?: string }): Promise<Array<{
    id: string;
    url: string;
    title: string;
    icon?: string;
    shortcut?: string;
  }>> {
    let links = Array.from(this.links.values());
    if (filter?.category) {
      links = links.filter(l => l.category === filter.category);
    }
    return links.map(l => ({
      id: l.id,
      url: l.url,
      title: l.title,
      icon: l.icon,
      shortcut: l.shortcut,
    }));
  }

  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    for (const link of this.links.values()) {
      if (link.category) categories.add(link.category);
    }
    return Array.from(categories);
  }
}

export class RSSPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rss',
    name: 'RSS Reader',
    version: '1.0.0',
    description: 'RSS and Atom feed reader',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rss', 'feed', 'news'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
    ui: { sidebar: true, panel: true },
  };

  private feeds: Map<string, {
    id: string;
    url: string;
    title: string;
    lastUpdated?: Date;
    refreshInterval?: number;
  }> = new Map();

  private articles: Map<string, Array<{
    id: string;
    title: string;
    content: string;
    link: string;
    published: Date;
    feed: string;
  }>> = new Map();

  async addFeed(url: string, title: string): Promise<string> {
    const id = `feed-${Date.now()}`;
    this.feeds.set(id, { id, url, title });
    this.articles.set(id, []);
    return id;
  }

  async removeFeed(id: string): Promise<void> {
    this.feeds.delete(id);
    this.articles.delete(id);
  }

  async refreshFeed(id: string): Promise<void> {
    console.log(`Refreshing feed: ${id}`);
  }

  async getArticles(feedId: string, limit = 20): Promise<Array<{
    id: string;
    title: string;
    content: string;
    link: string;
    published: Date;
  }>> {
    return (this.articles.get(feedId) || []).slice(0, limit);
  }

  async getFeeds(): Promise<Array<{ id: string; title: string; url: string }>> {
    return Array.from(this.feeds.values()).map(f => ({
      id: f.id,
      title: f.title,
      url: f.url,
    }));
  }
}

export class ScreenCapturePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/screenshot',
    name: 'Screen Capture',
    version: '1.0.0',
    description: 'Screenshot and screen recording',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['screenshot', 'capture', 'screen-record'],
  };

  public capabilities: PluginCapabilities = {
    ui: { commands: true },
  };

  private capturedImages: string[] = [];

  async captureScreen(): Promise<string> {
    console.log('Capturing screen...');
    return 'data:image/png;base64,capture';
  }

  async captureWindow(): Promise<string> {
    console.log('Capturing window...');
    return 'data:image/png;base64,capture';
  }

  async captureRegion(x: number, y: number, width: number, height: number): Promise<string> {
    console.log(`Capturing region: ${x},${y} ${width}x${height}`);
    return 'data:image/png;base64,capture';
  }

  async recordScreen(duration: number): Promise<string> {
    console.log(`Recording screen for ${duration}s...`);
    return 'video/webm;base64,recording';
  }

  async getCaptures(): Promise<string[]> {
    return [...this.capturedImages];
  }

  async deleteCapture(dataUrl: string): Promise<void> {
    this.capturedImages = this.capturedImages.filter(c => c !== dataUrl);
  }

  async saveCapture(dataUrl: string, path: string): Promise<void> {
    console.log(`Saving capture to: ${path}`);
  }
}

export class EncryptionPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/encryption',
    name: 'Encryption',
    version: '1.0.0',
    description: 'File encryption and security',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['encryption', 'security', 'crypto'],
  };

  public capabilities: PluginCapabilities = {
    api: { filesystem: true },
  };

  async encrypt(data: string, password: string): Promise<string> {
    console.log('Encrypting...');
    return btoa(data);
  }

  async decrypt(data: string, password: string): Promise<string> {
    console.log('Decrypting...');
    return atob(data);
  }

  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async generateKey(): Promise<string> {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    return 'key';
  }
}

export class TranslationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/translation',
    name: 'Translation',
    version: '1.0.0',
    description: 'Text translation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['translation', 'language', 'translate'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  async translate(text: string, from: string, to: string): Promise<string> {
    console.log(`Translating ${from} -> ${to}: ${text}`);
    return text;
  }

  async detectLanguage(text: string): Promise<string> {
    return 'en';
  }

  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
    ];
  }
}

export class TerminalPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/terminal',
    name: 'Terminal',
    version: '1.0.0',
    description: 'Built-in terminal emulator',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['terminal', 'shell', 'command-line'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true, commands: true },
  };

  private history: string[] = [];
  private output: string[] = [];

  async execute(command: string): Promise<string> {
    this.history.push(command);
    console.log(`Executing: ${command}`);
    const output = `Output of: ${command}`;
    this.output.push(output);
    return output;
  }

  async getHistory(): Promise<string[]> {
    return [...this.history];
  }

  async getOutput(): Promise<string[]> {
    return [...this.output];
  }

  async clear(): Promise<void> {
    this.output = [];
  }

  async autocomplete(command: string): Promise<string[]> {
    const commands = ['ls', 'cd', 'mkdir', 'rm', 'cat', 'echo', 'grep', 'find'];
    return commands.filter(c => c.startsWith(command));
  }
}

export class ChartPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/charts',
    name: 'Charts',
    version: '1.0.0',
    description: 'Data visualization',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['charts', 'graphs', 'visualization'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  async createBarChart(data: Array<{ label: string; value: number }>, options?: {
    title?: string;
    color?: string;
  }): Promise<string> {
    console.log('Creating bar chart...');
    return 'chart-id';
  }

  async createLineChart(data: Array<{ label: string; value: number }>, options?: {
    title?: string;
    color?: string;
  }): Promise<string> {
    console.log('Creating line chart...');
    return 'chart-id';
  }

  async createPieChart(data: Array<{ label: string; value: number }>, options?: {
    title?: string;
    color?: string;
  }): Promise<string> {
    console.log('Creating pie chart...');
    return 'chart-id';
  }

  async createGauge(value: number, options?: {
    min?: number;
    max?: number;
    title?: string;
  }): Promise<string> {
    console.log('Creating gauge...');
    return 'chart-id';
  }
}

export class TablePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tables',
    name: 'Data Tables',
    version: '1.0.0',
    description: 'Interactive data tables',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['table', 'data', 'grid'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  private tables: Map<string, {
    id: string;
    name: string;
    columns: string[];
    rows: unknown[][];
  }> = new Map();

  async createTable(name: string, columns: string[]): Promise<string> {
    const id = `table-${Date.now()}`;
    this.tables.set(id, { id, name, columns, rows: [] });
    return id;
  }

  async deleteTable(id: string): Promise<void> {
    this.tables.delete(id);
  }

  async addRow(tableId: string, data: unknown[]): Promise<void> {
    const table = this.tables.get(tableId);
    if (table) {
      table.rows.push(data);
    }
  }

  async getTableData(tableId: string): Promise<{
    columns: string[];
    rows: unknown[][];
  } | null> {
    return this.tables.get(tableId) || null;
  }

  async exportToCSV(tableId: string): Promise<string> {
    const table = this.tables.get(tableId);
    if (!table) return '';
    const header = table.columns.join(',');
    const rows = table.rows.map(r => r.join(',')).join('\n');
    return `${header}\n${rows}`;
  }
}

export class CodeEditorPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/code',
    name: 'Code Editor',
    version: '1.0.0',
    description: 'In-browser code editor',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['code', 'editor', 'ide'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true, commands: true },
  };

  private documents: Map<string, {
    id: string;
    name: string;
    content: string;
    language: string;
    modified: boolean;
  }> = new Map();

  async createDocument(name: string, language: string = 'javascript'): Promise<string> {
    const id = `doc-${Date.now()}`;
    this.documents.set(id, {
      id,
      name,
      content: '',
      language,
      modified: false,
    });
    return id;
  }

  async openDocument(id: string): Promise<{
    name: string;
    content: string;
    language: string;
  } | null> {
    return this.documents.get(id) || null;
  }

  async saveDocument(id: string, content: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      this.documents.set(id, { ...doc, content, modified: false });
    }
  }

  async closeDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async formatCode(id: string): Promise<void> {
    console.log(`Formatting code: ${id}`);
  }

  async lintCode(id: string): Promise<Array<{
    line: number;
    column: number;
    message: string;
    severity: string;
  }>> {
    return [];
  }

  async getOpenDocuments(): Promise<Array<{
    id: string;
    name: string;
    modified: boolean;
  }>> {
    return Array.from(this.documents.values()).map(d => ({
      id: d.id,
      name: d.name,
      modified: d.modified,
    }));
  }
}

export const widgetPlugin = new WidgetPlugin();
export const weatherPlugin = new WeatherPlugin();
export const calendarPlugin = new CalendarPlugin();
export const quickLinkPlugin = new QuickLinkPlugin();
export const rssPlugin = new RSSPlugin();
export const screenCapturePlugin = new ScreenCapturePlugin();
export const encryptionPlugin = new EncryptionPlugin();
export const translationPlugin = new TranslationPlugin();
export const terminalPlugin = new TerminalPlugin();
export const chartPlugin = new ChartPlugin();
export const tablePlugin = new TablePlugin();
export const codeEditorPlugin = new CodeEditorPlugin();

export function registerUtilityPlugins(): Plugin[] {
  return [
    widgetPlugin,
    weatherPlugin,
    calendarPlugin,
    quickLinkPlugin,
    rssPlugin,
    screenCapturePlugin,
    encryptionPlugin,
    translationPlugin,
    terminalPlugin,
    chartPlugin,
    tablePlugin,
    codeEditorPlugin,
  ];
}