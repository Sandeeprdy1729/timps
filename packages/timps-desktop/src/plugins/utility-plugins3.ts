import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class ArrayUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/array-utils',
    name: 'Array Utilities',
    version: '1.0.0',
    description: 'Array manipulation and utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['array', 'list', 'collection', 'utils'],
  };

  public capabilities: PluginCapabilities = {};

  chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  compact<T>(array: T[]): T[] {
    return array.filter(Boolean);
  }

  uniq<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  uniqBy<T>(array: T[], iteratee: (item: T) => unknown): T[] {
    const seen = new Set();
    return array.filter(item => {
      const key = iteratee(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((acc, val) => 
      Array.isArray(val) ? acc.concat(val) : acc.concat([val]), []);
  }

  flattenDeep<T>(array: unknown[]): T[] {
    return array.reduce<T[]>((acc, val) => {
      if (Array.isArray(val)) {
        return acc.concat(this.flattenDeep(val));
      }
      return acc.concat(val as T);
    }, []);
  }

  groupBy<T>(array: T[], iteratee: (item: T) => string): Record<string, T[]> {
    return array.reduce<Record<string, T[]>>((acc, item) => {
      const key = iteratee(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  keyBy<T>(array: T[], iteratee: (item: T) => string): Record<string, T> {
    return array.reduce<Record<string, T>>((acc, item) => {
      acc[iteratee(item)] = item;
      return acc;
    }, {});
  }

  partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
    const pass: T[] = [];
    const fail: T[] = [];

    for (const item of array) {
      if (predicate(item)) {
        pass.push(item);
      } else {
        fail.push(item);
      }
    }

    return [pass, fail];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  sample<T>(array: T[]): T | undefined {
    return array[Math.floor(Math.random() * array.length)];
  }

  sampleSize<T>(array: T[], size: number): T[] {
    return this.shuffle(array).slice(0, size);
  }

  sortBy<T>(array: T[], iteratee: (item: T) => number): T[] {
    return [...array].sort((a, b) => iteratee(a) - iteratee(b));
  }

  orderBy<T>(array: T[], keys: ((item: T) => number)[], directions: ('asc' | 'desc')[] = []): T[] {
    return [...array].sort((a, b) => {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const dir = directions[i] || 'asc';
        const aVal = key(a);
        const bVal = key(b);
        if (aVal < bVal) return dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  difference<T>(array: T[], ...others: T[][]): T[] {
    const values = new Set(others.flat());
    return array.filter(item => !values.has(item));
  }

  intersection<T>(...arrays: T[][]): T[] {
    if (arrays.length === 0) return [];
    const result: T[] = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
      const set = new Set(arrays[i]);
      result.filter(item => set.has(item));
    }
    return this.uniq(result);
  }

  union<T>(...arrays: T[][]): T[] {
    return this.uniq(arrays.flat());
  }

  zip<T>(...arrays: T[][]): T[][] {
    const maxLength = Math.max(...arrays.map(a => a.length));
    const result: T[][] = [];

    for (let i = 0; i < maxLength; i++) {
      result.push(arrays.map(arr => arr[i]));
    }

    return result;
  }

  unzip<T>(zipped: T[][]): T[][] {
    return this.zip(...zipped);
  }

  countBy<T>(array: T[], iteratee: (item: T) => string): Record<string, number> {
    return array.reduce<Record<string, number>>((acc, item) => {
      const key = iteratee(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  every<T>(array: T[], predicate: (item: T) => boolean): boolean {
    return array.every(predicate);
  }

  some<T>(array: T[], predicate: (item: T) => boolean): boolean {
    return array.some(predicate);
  }

  none<T>(array: T[], predicate: (item: T) => boolean): boolean {
    return !array.some(predicate);
  }

  findIndex<T>(array: T[], predicate: (item: T) => boolean): number {
    return array.findIndex(predicate);
  }

  findLastIndex<T>(array: T[], predicate: (item: T) => boolean): number {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i])) return i;
    }
    return -1;
  }

  initial<T>(array: T[]): T[] {
    return array.slice(0, -1);
  }

  tail<T>(array: T[]): T[] {
    return array.slice(1);
  }

  take<T>(array: T[], count: number): T[] {
    return array.slice(0, count);
  }

  takeRight<T>(array: T[], count: number): T[] {
    return array.slice(-count);
  }

  drop<T>(array: T[], count: number = 1): T[] {
    return array.slice(count);
  }

  dropRight<T>(array: T[], count: number = 1): T[] {
    return array.slice(0, -count);
  }

  nth<T>(array: T[], index: number): T | undefined {
    return index < 0 ? array[array.length + index] : array[index];
  }

  splice<T>(array: T[], start: number, deleteCount = 0, ...items: T[]): T[] {
    const result = [...array];
    result.splice(start, deleteCount, ...items);
    return result;
  }
}

export class ObjectUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/object-utils',
    name: 'Object Utilities',
    version: '1.0.0',
    description: 'Object manipulation utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['object', 'record', 'dict', 'utils'],
  };

  public capabilities: PluginCapabilities = {};

  get<T>(obj: Record<string, unknown>, path: string, defaultValue?: T): T | undefined {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let result: unknown = obj;

    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      result = (result as Record<string, unknown>)[key];
    }

    return (result as T) ?? defaultValue;
  }

  set(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    return obj;
  }

  has(obj: Record<string, unknown>, path: string): boolean {
    return this.get(obj, path) !== undefined;
  }

  unset(obj: Record<string, unknown>, path: string): boolean {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        return false;
      }
      current = current[key] as Record<string, unknown>;
    }

    delete current[keys[keys.length - 1]];
    return true;
  }

  pick<T>(obj: Record<string, unknown>, keys: string[]): Partial<T> {
    const result: Partial<T> = {};
    for (const key of keys) {
      if (key in obj) {
        result[key as keyof T] = obj[key] as T[keyof T];
      }
    }
    return result;
  }

  omit<T>(obj: Record<string, unknown>, keys: string[]): Partial<T> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result as Partial<T>;
  }

  merge<T>(...objects: Partial<T>[]): Partial<T> {
    const result: Record<string, unknown> = {};
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }
    return result as Partial<T>;
  }

  defaults<T>(obj: Partial<T>, ...defaults: Partial<T>[]): T {
    const result = { ...obj };
    for (const def of defaults) {
      for (const [key, value] of Object.entries(def)) {
        if (!(key in result) || result[key] === undefined) {
          result[key] = value;
        }
      }
    }
    return result as T;
  }

  clone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return [...obj] as unknown as T;
    return { ...obj } as T;
  }

  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item)) as unknown as T;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.deepClone(value);
    }
    return result as T;
  }

  keys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  values(obj: Record<string, unknown>): unknown[] {
    return Object.values(obj);
  }

  entries(obj: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(obj);
  }

  mapValues<T>(obj: Record<string, T>, iteratee: (value: T, key: string) => unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = iteratee(value, key);
    }
    return result;
  }

  mapKeys<T>(obj: Record<string, T>, iteratee: (key: string, value: T) => string): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[iteratee(key, value)] = value;
    }
    return result;
  }

  pickBy<T>(obj: Record<string, T>, predicate: (value: T, key: string) => boolean): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (predicate(value, key)) {
        result[key as keyof T] = value;
      }
    }
    return result;
  }

  omitBy<T>(obj: Record<string, T>, predicate: (value: T, key: string) => boolean): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!predicate(value, key)) {
        result[key as keyof T] = value;
      }
    }
    return result;
  }

  invert<T>(obj: Record<string, T>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[String(value)] = key;
    }
    return result;
  }

  size(obj: Record<string, unknown>): number {
    return Object.keys(obj).length;
  }

  isEmpty(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).length === 0;
  }

  isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!this.isEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  create<T>(defaults: Partial<T>): T {
    return defaults as T;
  }

  random<T extends Record<string, unknown>>(obj: T): [string, unknown] {
    const keys = Object.keys(obj);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return [key, obj[key]];
  }
}

export class StringUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/string-utils',
    name: 'String Utilities',
    version: '1.0.0',
    description: 'String manipulation utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['string', 'text', 'format', 'utils'],
  };

  public capabilities: PluginCapabilities = {};

  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  camelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase())
      .replace(/^[a-z]/, char => char.toUpperCase());
  }

  kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  snakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  startCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[\s_-]+/g, ' ')
      .toLowerCase()
      .replace(/(?:^|\s)\w/g, char => char.toUpperCase());
  }

  trim(str: string, chars?: string): string {
    const pattern = chars ? `[${chars}]` : '\\s';
    return str.replace(new RegExp(`^${pattern}+|${pattern}+$`, 'g'), '');
  }

  trimStart(str: string, chars?: string): string {
    const pattern = chars ? `[${chars}]` : '\\s';
    return str.replace(new RegExp(`^${pattern}+`, 'g'), '');
  }

  trimEnd(str: string, chars?: string): string {
    const pattern = chars ? `[${chars}]` : '\\s';
    return str.replace(new RegExp(`${pattern}+$`, 'g'), '');
  }

  truncate(str: string, length: number, ending = '...'): string {
    if (str.length <= length) return str;
    return str.slice(0, length - ending.length) + ending;
  }

  padStart(str: string, length: number, chars = ' '): string {
    const padLength = length - str.length;
    if (padLength <= 0) return str;
    return chars.repeat(Math.ceil(padLength / chars.length)).slice(0, padLength) + str;
  }

  padEnd(str: string, length: number, chars = ' '): string {
    const padLength = length - str.length;
    if (padLength <= 0) return str;
    return str + chars.repeat(Math.ceil(padLength / chars.length)).slice(0, padLength);
  }

  repeat(str: string, count: number): string {
    return str.repeat(count);
  }

  replace(str: string, pattern: string | RegExp, replacement: string | ((match: string) => string)): string {
    if (typeof pattern === 'string') {
      return str.split(pattern).join(replacement as string);
    }
    return str.replace(pattern, replacement as (match: string) => string);
  }

  replaceAll(str: string, pattern: string, replacement: string): string {
    return str.split(pattern).join(replacement);
  }

  split(str: string, separator: string | RegExp, limit?: number): string[] {
    return str.split(separator, limit);
  }

  join(array: string[], separator: string): string {
    return array.join(separator);
  }

  toWords(str: string): string[] {
    return str.match(/[a-zA-Z0-9]+/g) || [];
  }

  toLines(str: string): string[] {
    return str.split(/\r?\n/);
  }

  unescape(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  reverse(str: string): string {
    return str.split('').reverse().join('');
  }

  slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  template(str: string, data: Record<string, unknown>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key in data ? String(data[key]) : `{{${key}}}`
    );
  }
}