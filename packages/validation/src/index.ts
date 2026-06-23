export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'email' | 'url' | 'pattern' | 'custom';
  message?: string;
  value?: any;
  validator?: (value: any) => boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validate(data: Record<string, any>, schema: ValidationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field in schema) {
    const rules = schema[field];
    const value = data[field];

    for (const rule of rules) {
      if (rule.type === 'required' && !value && value !== 0) {
        errors.push({ field, message: rule.message || `${field} is required` });
      } else if (rule.type === 'min' && typeof value === 'string' && value.length < rule.value) {
        errors.push({ field, message: rule.message || `${field} must be at least ${rule.value} characters` });
      } else if (rule.type === 'max' && typeof value === 'string' && value.length > rule.value) {
        errors.push({ field, message: rule.message || `${field} must be at most ${rule.value} characters` });
      } else if (rule.type === 'email' && value && !isValidEmailImpl(value)) {
        errors.push({ field, message: rule.message || `${field} must be a valid email` });
      } else if (rule.type === 'url' && value && !isValidUrlImpl(value)) {
        errors.push({ field, message: rule.message || `${field} must be a valid URL` });
      } else if (rule.type === 'pattern' && rule.value && !new RegExp(rule.value).test(value)) {
        errors.push({ field, message: rule.message || `${field} has invalid format` });
      } else if (rule.type === 'custom' && rule.validator && !rule.validator(value)) {
        errors.push({ field, message: rule.message || `${field} is invalid` });
      }
    }
  }

  return errors;
}

function isValidEmailImpl(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrlImpl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  return isValidEmailImpl(email);
}

export function isValidUrl(url: string): boolean {
  return isValidUrlImpl(url);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s-()]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function isValidCreditCard(card: string): boolean {
  const cleaned = card.replace(/\s/g, '');
  if (!/^\d+$/.test(cleaned)) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isValidIP(ip: string): boolean {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}

export function sanitizeHtml(html: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  
  return html.replace(/[&<>"'/]/g, char => entityMap[char]);
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function titleize(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
}

export function parseQuery(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

export function buildQuery(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      searchParams.append(key, String(params[key]));
    }
  }
  
  return searchParams.toString();
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as any;
  
  const cloned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone((obj as any)[key]);
    }
  }
  return cloned;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  return false;
}

export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (sources.length === 0) return target;
  const source = sources.shift();
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return deepMerge(target, ...sources);
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) result[key] = obj[key];
    return result;
  }, {} as Pick<T, K>);
}

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result as Omit<T, K>;
}

export function groupBy<T>(arr: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return arr.reduce((result, item) => {
    const group = typeof key === 'function' ? key(item) : String(item[key]);
    (result[group] = result[group] || []).push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function uniqBy<T>(arr: T[], key: keyof T | ((item: T) => any)): T[] {
  const seen = new Set();
  return arr.filter(item => {
    const value = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[], any>((result, item) => {
    if (Array.isArray(item)) {
      result.push(...item);
    } else {
      result.push(item);
    }
    return result;
  }, []);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function average(arr: number[]): number {
  return arr.length > 0 ? sum(arr) / arr.length : 0;
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function standardDeviation(arr: number[]): number {
  const avg = average(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { attempts = 3, delay = 1000, backoff = 2 } = options;
  
  return new Promise(async (resolve, reject) => {
    let lastError: Error;
    let currentDelay = delay;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await fn();
        resolve(result);
        return;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < attempts) {
          await sleep(currentDelay);
          currentDelay *= backoff;
        }
      }
    }
    
    reject(lastError!);
  });
}

export function timeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), ms)
  );
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: any;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  } as T;
}

export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, any>();
  
  return function(this: any, ...args: Parameters<T>): any {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  } as T;
}

export function pipe<T>(...fns: ((arg: any) => any)[]): (arg: T) => any {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

export function compose<T>(...fns: ((arg: any) => any)[]): (arg: T) => any {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

export function curry<T extends (...args: any[]) => any>(fn: T) {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  };
}

export function partial<T extends (...args: any[]) => any>(
  fn: T,
  ...initialArgs: any[]
): (...args: any[]) => any {
  return (...laterArgs: any[]) => fn(...initialArgs, ...laterArgs);
}

export class EventEmitter<T = any> {
  private events: Map<string, ((data: T) => void)[]> = new Map();
  
  on(event: string, listener: (data: T) => void): void {
    const listeners = this.events.get(event) || [];
    listeners.push(listener);
    this.events.set(event, listeners);
  }
  
  off(event: string, listener?: (data: T) => void): void {
    if (!listener) {
      this.events.delete(event);
      return;
    }
    
    const listeners = this.events.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
    this.events.set(event, listeners);
  }
  
  emit(event: string, data: T): void {
    const listeners = this.events.get(event) || [];
    listeners.forEach(listener => listener(data));
  }
  
  once(event: string, listener: (data: T) => void): void {
    const wrapped = (data: T) => {
      listener(data);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }
  
  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export class Queue<T> {
  private items: T[] = [];
  private processing = false;
  
  enqueue(item: T): void {
    this.items.push(item);
  }
  
  dequeue(): T | undefined {
    return this.items.shift();
  }
  
  peek(): T | undefined {
    return this.items[0];
  }
  
  clear(): void {
    this.items = [];
  }
  
  size(): number {
    return this.items.length;
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export class Stack<T> {
  private items: T[] = [];
  
  push(item: T): void {
    this.items.push(item);
  }
  
  pop(): T | undefined {
    return this.items.pop();
  }
  
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
  
  clear(): void {
    this.items = [];
  }
  
  size(): number {
    return this.items.length;
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export class LinkedList<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private _size = 0;
  
  prepend(value: T): void {
    const node = { value, next: this.head, prev: null };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this._size++;
  }
  
  append(value: T): void {
    const node = { value, next: null, prev: this.tail };
    if (this.tail) this.tail.next = node;
    this.tail = node;
    if (!this.head) this.head = node;
    this._size++;
  }
  
  remove(value: T): boolean {
    let current = this.head;
    while (current) {
      if (current.value === value) {
        if (current.prev) current.prev.next = current.next;
        if (current.next) current.next.prev = current.prev;
        if (current === this.head) this.head = current.next;
        if (current === this.tail) this.tail = current.prev;
        this._size--;
        return true;
      }
      current = current.next;
    }
    return false;
  }
  
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }
  
  size(): number {
    return this._size;
  }
}

interface Node<T> {
  value: T;
  next: Node<T> | null;
  prev: Node<T> | null;
}

export class MinHeap<T = number> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;
  
  constructor(compare: (a: T, b: T) => number = (a, b) => (a as number) - (b as number)) {
    this.compare = compare;
  }
  
  insert(value: T): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }
  
  extract(): T | undefined {
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }
  
  peek(): T | undefined {
    return this.heap[0];
  }
  
  size(): number {
    return this.heap.length;
  }
  
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }
  
  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      if (leftChild < this.heap.length && this.compare(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < this.heap.length && this.compare(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

export class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private readonly maxSize: number;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

export function md5(str: string): string {
  return hashCode(str).toString(16);
}

export function sha256(str: string): string {
  return hashCode(str).toString(16);
}

export function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

export function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString();
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
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

export function parseCSV(str: string): Record<string, string>[] {
  const lines = str.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index]?.trim() || '';
      return obj;
    }, {} as Record<string, string>);
  });
}

export function toCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerLine = headers.join(',');
  const rows = data.map(row => headers.map(h => String(row[h] ?? '')).join(','));
  
  return [headerLine, ...rows].join('\n');
}