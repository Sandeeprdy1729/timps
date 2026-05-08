/**
 * TIMPS Desktop - Additional UI utilities
 * More utility functions and components.
 */

// Date utilities
export function formatRelativeDate(date: Date | number): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

export function formatDateTime(date: Date | number): string {
  return new Date(date).toLocaleString();
}

export function formatTime(date: Date | number): string {
  return new Date(date).toLocaleTimeString();
}

export function isToday(date: Date | number): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isYesterday(date: Date | number): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

export function isThisWeek(date: Date | number): boolean {
  const d = new Date(date);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo;
}

export function isThisMonth(date: Date | number): boolean {
  const d = new Date(date);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// Number utilities
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// String utilities
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function capitalizeWords(str: string): string {
  return str.split(' ').map(capitalize).join(' ');
}

export function camelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
}

export function snakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

export function kebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

export function unescapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };
  return str.replace(/&(amp|lt|gt|quot|#039);/g, m => map[m]);
}

export function words(str: string): string[] {
  return str.trim().split(/\s+/);
}

export function repeat(str: string, times: number): string {
  return str.repeat(times);
}

export function padStart(str: string, length: number, char = ' '): string {
  return str.padStart(length, char);
}

export function padEnd(str: string, length: number, char = ' '): string {
  return str.padEnd(length, char);
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function flatten<T>(array: (T | T[])[]): T[] {
  return array.reduce<T[]>((acc, val) => 
    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key]);
    (acc[groupKey] = acc[groupKey] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sample<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)];
}

export function difference<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter(x => !arr2.includes(x));
}

export function intersection<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter(x => arr2.includes(x));
}

export function union<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat());
}

// Object utilities
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function merge<T extends object>(...objects: Partial<T>[]): T {
  return Object.assign({}, ...objects);
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Function utilities
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: unknown[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

export function once<T extends (...args: unknown[]) => unknown>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;
  return ((...args: unknown[]) => {
    if (!called) {
      result = fn(...args);
      called = true;
    }
    return result;
  }) as T;
}

export function curry<T extends (...args: unknown[]) => unknown>(
  fn: T,
  arity = fn.length
): T {
  return function curried(...args: unknown[]): unknown {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...nextArgs: unknown[]) => curried(...args, ...nextArgs);
  } as T;
}