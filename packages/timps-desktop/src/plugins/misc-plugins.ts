import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class MarkdownPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/markdown',
    name: 'Markdown',
    version: '1.0.0',
    description: 'Markdown parsing and rendering',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['markdown', 'render', 'parser'],
  };

  public capabilities: PluginCapabilities = {
    ui: { panel: true },
  };

  async parse(markdown: string): Promise<string> {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');
  }

  async render(markdown: string): Promise<HTMLElement> {
    const html = await this.parse(markdown);
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  extractHeadings(markdown: string): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2],
        });
      }
    }

    return headings;
  }

  extractLinks(markdown: string): Array<{ text: string; url: string }> {
    const links: Array<{ text: string; url: string }> = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(markdown)) {
      links.push({
        text: match[1],
        url: match[2],
      });
    }

    return links;
  }

  extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
    const blocks: Array<{ language: string; code: string }> = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(markdown))) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  wordCount(markdown: string): number {
    return markdown.split(/\s+/).filter(w => w.length > 0).length;
  }

  readingTime(markdown: string, wpm = 200): number {
    const words = this.wordCount(markdown);
    return Math.ceil(words / wpm);
  }
}

export class TemplateEnginePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/template',
    name: 'Template Engine',
    version: '1.0.0',
    description: 'Template rendering engine',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['template', 'render', 'engine'],
  };

  public capabilities: PluginCapabilities = {};

  private templates: Map<string, string> = new Map();
  private partials: Map<string, string> = new Map();

  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  registerPartial(name: string, partial: string): void {
    this.partials.set(name, partial);
  }

  render(template: string, data: Record<string, unknown>): string {
    let result = template;

    const variableRegex = /\{\{(\w+)\}\}/g;
    result = result.replace(variableRegex, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });

    const loopRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    let match;
    while ((match = loopRegex.exec(template))) {
      const items = data[match[1]] as unknown[];
      const itemTemplate = match[2];
      const rendered = items.map(item => {
        let itemResult = itemTemplate;
        for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
          itemResult = itemResult.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        }
        return itemResult;
      }).join('');
      result = result.replace(match[0], rendered);
    }

    const conditionalRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    while ((match = conditionalRegex.exec(template))) {
      if (data[match[1]])) {
        result = result.replace(match[0], match[2]);
      } else {
        result = result.replace(match[0], '');
      }
    }

    return result;
  }

  renderTemplate(name: string, data: Record<string, unknown>): string {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template not found: ${name}`);
    return this.render(template, data);
  }

  getTemplate(name: string): string | undefined {
    return this.templates.get(name);
  }

  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

export class i18nPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/i18n',
    name: 'Internationalization',
    version: '1.0.0',
    description: 'Multi-language support',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['i18n', 'translation', 'locale'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private translations: Map<string, Map<string, string>> = new Map();
  private currentLocale = 'en';
  private fallbackLocale = 'en';

  addTranslation(locale: string, key: string, value: string): void {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, new Map());
    }
    this.translations.get(locale)!.set(key, value);
  }

  addTranslations(locale: string, translations: Record<string, string>): void {
    for (const [key, value] of Object.entries(translations)) {
      this.addTranslation(locale, key, value);
    }
  }

  t(key: string, params?: Record<string, string>): string {
    const translations = this.translations.get(this.currentLocale);
    let value = translations?.get(key);

    if (!value && this.currentLocale !== this.fallbackLocale) {
      const fallback = this.translations.get(this.fallbackLocale);
      value = fallback?.get(key);
    }

    if (!value) return key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
      }
    }

    return value;
  }

  setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  getLocale(): string {
    return this.currentLocale;
  }

  getAvailableLocales(): string[] {
    return Array.from(this.translations.keys());
  }

  setFallbackLocale(locale: string): void {
    this.fallbackLocale = locale;
  }
}

export class DateFormatPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/date-format',
    name: 'Date Formatting',
    version: '1.0.0',
    description: 'Date and time formatting',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['date', 'time', 'format'],
  };

  public capabilities: PluginCapabilities = {};

  format(date: Date, format: string, locale = 'en-US'): string {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: format.includes('MM') ? '2-digit' : undefined,
      day: format.includes('dd') ? '2-digit' : undefined,
      hour: format.includes('HH') ? '2-digit' : undefined,
      minute: format.includes('mm') ? '2-digit' : undefined,
      second: format.includes('ss') ? '2-digit' : undefined,
    }).format(date);
  }

  formatRelative(date: Date, now: Date = new Date()): string {
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  parse(dateString: string, format: string): Date | null {
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
      }
    }

    return null;
  }

  isValid(date: Date): boolean {
    return !isNaN(date.getTime());
  }

  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }
}

export class NumberFormatPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/number-format',
    name: 'Number Formatting',
    version: '1.0.0',
    description: 'Number formatting utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['number', 'format', 'currency'],
  };

  public capabilities: PluginCapabilities = {};

  format(number: number, style: 'decimal' | 'percent' | 'currency', options?: {
    currency?: string;
    decimals?: number;
    locale?: string;
  }): string {
    const locale = options?.locale || 'en-US';

    return new Intl.NumberFormat(locale, {
      style,
      currency: options?.currency,
      minimumFractionDigits: options?.decimals,
      maximumFractionDigits: options?.decimals,
    }).format(number);
  }

  formatCompact(number: number): string {
    if (number < 1000) return String(number);
    if (number < 1000000) return `${(number / 1000).toFixed(1)}K`;
    if (number < 1000000000) return `${(number / 1000000).toFixed(1)}M`;
    return `${(number / 1000000000).toFixed(1)}B`;
  }

  formatRange(min: number, max: number, locale = 'en-US'): string {
    return `${new Intl.NumberFormat(locale).format(min)} - ${new Intl.NumberFormat(locale).format(max)}`;
  }

  parse(value: string): number | null {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }

  round(number: number, decimals = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(number * factor) / factor;
  }

  clamp(number: number, min: number, max: number): number {
    return Math.min(Math.max(number, min), max);
  }

  random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

export class ValidationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/validation',
    name: 'Validation',
    version: '1.0.0',
    description: 'Form validation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['validation', 'form', 'schema'],
  };

  public capabilities: PluginCapabilities = {};

  private validators: Map<string, (value: unknown) => boolean> = new Map();

  registerValidator(name: string, validator: (value: unknown) => boolean): void {
    this.validators.set(name, validator);
  }

  validate(value: unknown, rules: Array<{ type: string; message?: string }>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const rule of rules) {
      const validator = this.validators.get(rule.type);
      if (validator && !validator(value)) {
        errors.push(rule.message || `Validation failed for ${rule.type}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  isEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isPhone(phone: string): boolean {
    return /^[\d\s()+-\s]{10,}$/.test(phone);
  }

  isPostalCode(code: string, country = 'US'): boolean {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      UK: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
      CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    };
    return patterns[country]?.test(code) || false;
  }

  isCreditCard(card: string): boolean {
    const sanitized = card.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = sanitized.length - 1; i >= 0; i--) {
      let digit = parseInt(sanitized[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  isStrongPassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[a-z]/.test(password)) errors.push('Lowercase letter');
    if (!/[A-Z]/.test(password)) errors.push('Uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('Number');
    if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Special character');

    return { valid: errors.length === 0, errors };
  }
}

export class ErrorHandlerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/error-handler',
    name: 'Error Handler',
    version: '1.0.0',
    description: 'Global error handling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['error', 'handling', 'debug'],
  };

  public capabilities: PluginCapabilities = {};

  private errorListeners: Array<(error: Error, context?: Record<string, unknown>) => void> = [];

  handleError(error: Error, context?: Record<string, unknown>): void {
    console.error('Error:', error.message, context);

    for (const listener of this.errorListeners) {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('Error in listener:', listenerError);
      }
    }
  }

  addErrorListener(listener: (error: Error, context?: Record<string, unknown>) => void): void {
    this.errorListeners.push(listener);
  }

  removeErrorListener(listener: (error: Error, context?: Record<string, unknown>) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return fallback;
  }

  isError(error: unknown, type?: string): boolean {
    if (error instanceof Error) {
      if (!type) return true;
      return error.name === type || error.message.includes(type);
    }
    return false;
  }

  wrapAsync<T extends (...args: unknown[]) => unknown>(
    fn: T
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error as Error, { fn: fn.name });
        throw error;
      }
    };
  }
}

export class LoggerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/logger',
    name: 'Logger',
    version: '1.0.0',
    description: 'Structured logging',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['logging', 'logger', 'debug'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private logs: Array<{
    level: string;
    message: string;
    timestamp: number;
    context?: Record<string, unknown>;
  }> = [];

  private log(level: string, message: string, context?: Record<string, unknown>): void {
    this.logs.push({
      level,
      message,
      timestamp: Date.now(),
      context,
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  getLogs(filter?: {
    level?: string;
    from?: number;
    to?: number;
  }): Array<{
    level: string;
    message: string;
    timestamp: number;
  }> {
    let filtered = this.logs;

    if (filter?.level) {
      filtered = filtered.filter(l => l.level === filter.level);
    }
    if (filter?.from) {
      filtered = filtered.filter(l => l.timestamp >= filter.from!);
    }
    if (filter?.to) {
      filtered = filtered.filter(l => l.timestamp <= filter.to!);
    }

    return filtered.map(l => ({
      level: l.level,
      message: l.message,
      timestamp: l.timestamp,
    }));
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export class DebugPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/debug',
    name: 'Debug Tools',
    version: '1.0.0',
    description: 'Debugging utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['debug', 'tool', 'development'],
  };

  public capabilities: PluginCapabilities = {};

  debug(value: unknown): void {
    if (typeof value === 'object') {
      console.table(value);
    } else {
      console.log(value);
    }
  }

  trace(label?: string): void {
    console.log(label || 'Trace:');
    console.trace();
  }

  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  assert(condition: boolean, message: string): void {
    console.assert(condition, message);
  }

  count(label = 'default'): void {
    console.count(label);
  }

  countReset(label = 'default'): void {
    console.countReset(label);
  }

  dir(value: unknown): void {
    console.dir(value);
  }

  group(label: string): void {
    console.group(label);
  }

  groupEnd(): void {
    console.groupEnd();
  }

  profile(label: string): void {
    console.profile(label);
  }

  profileEnd(label: string): void {
    console.profileEnd(label);
  }

  table(data: unknown): void {
    console.table(data);
  }
}

export class PerformancePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/performance',
    name: 'Performance',
    version: '1.0.0',
    description: 'Performance monitoring',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['performance', 'monitoring', 'metrics'],
  };

  public capabilities: PluginCapabilities = {};

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const measure = performance.measure(name, startMark, endMark);
    return measure.duration;
  }

  getMemory(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null {
    return (performance as unknown as { memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    } }).memory || null;
  }

  getMetrics(): {
    navigation: PerformanceNavigationTiming;
    paint: PerformancePaintTiming;
  } | null {
    return (performance as unknown as {
      getEntriesByType: (type: string) => unknown[];
    }).getEntriesByType('navigation')[0] as unknown as {
      navigation: PerformanceNavigationTiming;
      paint: PerformancePaintTiming;
    } || null;
  }

  now(): number {
    return performance.now();
  }

  timeOrigin(): number {
    return performance.timeOrigin;
  }
}

export const markdownPlugin = new MarkdownPlugin();
export const templateEnginePlugin = new TemplateEnginePlugin();
export const i18nPlugin = new i18nPlugin();
export const dateFormatPlugin = new DateFormatPlugin();
export const numberFormatPlugin = new NumberFormatPlugin();
export const validationPlugin = new ValidationPlugin();
export const errorHandlerPlugin = new ErrorHandlerPlugin();
export const loggerPlugin = new LoggerPlugin();
export const debugPlugin = new DebugPlugin();
export const performancePlugin = new PerformancePlugin();

export function registerUtilityPlugins(): Plugin[] {
  return [
    markdownPlugin,
    templateEnginePlugin,
    i18nPlugin,
    dateFormatPlugin,
    numberFormatPlugin,
    validationPlugin,
    errorHandlerPlugin,
    loggerPlugin,
    debugPlugin,
    performancePlugin,
  ];
}