/**
 * TIMPS Desktop Utilities
 * Shared helper functions used across the desktop app.
 */

import { SemanticEntry, EpisodicEntry, MemoryStats } from '../api';

/**
 * Format a timestamp to a human-readable date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Format a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(timestamp);
  }
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Debounce a function call
 */
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

/**
 * Throttle a function call
 */
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

/**
 * Sort semantic entries by timestamp (newest first)
 */
export function sortSemanticEntries(
  entries: SemanticEntry[],
  descending = true
): SemanticEntry[] {
  return [...entries].sort((a, b) => {
    const diff = a.timestamp - b.timestamp;
    return descending ? -diff : diff;
  });
}

/**
 * Filter semantic entries by type
 */
export function filterByType(
  entries: SemanticEntry[],
  type: string
): SemanticEntry[] {
  return entries.filter(e => e.type === type);
}

/**
 * Filter semantic entries by tag
 */
export function filterByTag(
  entries: SemanticEntry[],
  tag: string
): SemanticEntry[] {
  return entries.filter(e => e.tags.includes(tag));
}

/**
 * Search semantic entries by content
 */
export function searchSemantic(
  entries: SemanticEntry[],
  query: string
): SemanticEntry[] {
  const lowerQuery = query.toLowerCase();
  return entries.filter(
    e =>
      e.content.toLowerCase().includes(lowerQuery) ||
      e.tags.some(t => t.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get memory stats summary
 */
export function getMemorySummary(stats: MemoryStats): string {
  const parts: string[] = [];
  
  if (stats.semantic_count > 0) {
    parts.push(`${stats.semantic_count} memories`);
  }
  if (stats.episode_count > 0) {
    parts.push(`${stats.episode_count} sessions`);
  }
  if (stats.working_goals > 0) {
    parts.push(`${stats.working_goals} goals`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No memory yet';
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download text as a file
 */
export function downloadAsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Check if running in Tauri
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && 
    '__TAURI_INTERNALS__' in window;
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Parse tags from input string
 */
export function parseTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Validate project path
 */
export function validateProjectPath(path: string): { valid: boolean; error?: string } {
  if (!path.trim()) {
    return { valid: false, error: 'Path cannot be empty' };
  }
  if (!path.startsWith('/') && !path.match(/^[A-Za-z]:/)) {
    return { valid: false, error: 'Path must be absolute' };
  }
  return { valid: true };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (obj instanceof Object) {
    const cloned: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key as keyof T]);
      }
    }
    return cloned as T;
  }
  return obj;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key as keyof T] = deepMerge(targetValue as unknown as Record<string, unknown>, sourceValue as unknown as Record<string, unknown>) as unknown as T[keyof T];
      } else {
        result[key as keyof T] = sourceValue as T[keyof T];
      }
    }
  }
  return result;
}

/**
 * Generate a random color
 */
export function randomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

/**
 * Lighten a hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Check if two arrays are equal
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Group array by key
 */
export function groupBy<T>(arr: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return arr.reduce((groups, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    (groups[groupKey] = groups[groupKey] || []).push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

/**
 * Flatten nested array
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((flat, item) =>
    flat.concat(Array.isArray(item) ? flatten(item) : item), []);
}

/**
 * Pick specific keys from object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Get nested property safely
 */
export function getNestedValue<T>(obj: T, path: string, defaultValue?: unknown): unknown {
  const keys = path.split('.');
  let result: unknown = obj;
  for (const key of keys) {
    if (result === null || result === undefined) return defaultValue;
    result = (result as Record<string, unknown>)[key];
  }
  return result ?? defaultValue;
}

/**
 * Set nested property
 */
export function setNestedValue<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current: Record<string, unknown> = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[lastKey] = value;
  return obj;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay * Math.pow(backoff, attempt - 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse JSON safely
 */
export function safeJSONParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Encode URL safely
 */
export function encodeURL(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Decode URL safely
 */
export function decodeURL(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if code is running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if code is running in Node.js
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null;
}