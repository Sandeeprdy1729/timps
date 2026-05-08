import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class CryptoPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/crypto',
    name: 'Cryptography',
    version: '1.0.0',
    description: 'Cryptographic utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['crypto', 'encryption', 'hash'],
  };

  public capabilities: PluginCapabilities = {};

  async generateKey(algorithm: 'AES-GCM' | 'RSA-OAEP' = 'AES-GCM', options?: {
    length?: number;
  }): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: algorithm,
        length: options?.length || 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return result.buffer;
  }

  async decrypt(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const iv = new Uint8Array(data.slice(0, 12));
    const encrypted = data.slice(12);

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
  }

  async hash(data: ArrayBuffer, algorithm = 'SHA-256'): Promise<ArrayBuffer> {
    return crypto.subtle.digest(algorithm, data);
  }

  async hmac(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return signature;
  }
}

export class UUIDPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/uuid',
    name: 'UUID Generator',
    version: '1.0.0',
    description: 'UUID generation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['uuid', 'guid', 'id'],
  };

  public capabilities: PluginCapabilities = {};

  generate(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  generatev1(): string {
    const timestamp = Date.now();
    const timeLow = (timestamp & 0xffffffff).toString(16).padStart(8, '0');
    const timeMid = ((timestamp >> 32) & 0xffff).toString(16).padStart(4, '0');
    const timeHiAndVersion = ((timestamp >> 48) & 0x0fff) | 0x1000;
    const clockSeqHiAndReserved = (Math.random() * 0x3f) | 0x80;
    const clockSeqLow = Math.floor(Math.random() * 0xff);
    const node = Array(6).fill(0).map(() => Math.floor(Math.random() * 256));

    return `${timeLow}-${timeMid}-${timeHiAndVersion.toString(16).padStart(4, '0')}-${clockSeqHiAndReserved.toString(16).padStart(2, '0')}${clockSeqLow.toString(16).padStart(2, '0')}-${node.map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  validate(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  parse(uuid: string): {
    timeLow: number;
    timeMid: number;
    timeHiAndVersion: number;
    clockSeqHiAndReserved: number;
    clockSeqLow: number;
    node: number[];
  } | null {
    if (!this.validate(uuid)) return null;

    const parts = uuid.split('-');
    return {
      timeLow: parseInt(parts[0], 16),
      timeMid: parseInt(parts[1], 16),
      timeHiAndVersion: parseInt(parts[2], 16),
      clockSeqHiAndReserved: parseInt(parts[3].slice(0, 2), 16),
      clockSeqLow: parseInt(parts[3].slice(2), 16),
      node: parts[4].match(/.{2}/g)?.map(b => parseInt(b, 16)) || [],
    };
  }
}

export class ColorPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/color',
    name: 'Color Utilities',
    version: '1.0.0',
    description: 'Color conversion and manipulation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['color', 'rgb', 'hex'],
  };

  public capabilities: PluginCapabilities = {};

  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  lighten(color: string, amount: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(100, hsl.l + amount);

    const result = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(result.r, result.g, result.b);
  }

  darken(color: string, amount: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.max(0, hsl.l - amount);

    const result = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(result.r, result.g, result.b);
  }

  isDark(color: string): boolean {
    const rgb = this.hexToRgb(color);
    if (!rgb) return false;

    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.5;
  }
}

export class SlugPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/slug',
    name: 'Slug Utilities',
    version: '1.0.0',
    description: 'Slug generation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['slug', 'url', 'slugify'],
  };

  public capabilities: PluginCapabilities = {};

  generate(text: string, options?: {
    maxLength?: number;
    lowercase?: boolean;
    separator?: string;
  }): string {
    const separator = options?.separator || '-';
    let slug = text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, separator)
      .replace(new RegExp(`${separator}+`, 'g'), separator)
      .trim();

    if (options?.maxLength && slug.length > options.maxLength) {
      slug = slug.slice(0, options.maxLength);
      slug = slug.replace(new RegExp(`${separator}[^${separator}]*$`), '');
    }

    return slug;
  }

  parse(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  isValid(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }
}

export class SlugifyPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/slugify',
    name: 'Slugify',
    version: '1.0.0',
    description: 'Advanced slug generation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['slugify', 'url', 'seo'],
  };

  public capabilities: PluginCapabilities = {};

  slugify(text: string, options?: {
    maxLength?: number;
    lowercase?: boolean;
    separator?: string;
    truncate?: number;
  }): string {
    const separator = options?.separator || '-';
    
    let result = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, separator)
      .replace(new RegExp(`${separator}+`, 'g'), separator);

    if (options?.lowercase !== false) {
      result = result.toLowerCase();
    }

    if (options?.truncate) {
      result = result.slice(0, options.truncate);
      result = result.replace(new RegExp(`${separator}[^${separator}]*$`), '');
    }

    return result.trim();
  }

  unslugify(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

export class URLPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/url',
    name: 'URL Utilities',
    version: '1.0.0',
    description: 'URL manipulation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['url', 'query', 'params'],
  };

  public capabilities: PluginCapabilities = {};

  build(url: string, params: Record<string, string | number | boolean>): string {
    const urlObj = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      urlObj.searchParams.set(key, String(value));
    }
    return urlObj.toString();
  }

  parse(url: string): Record<string, string> {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  setParam(url: string, key: string, value: string | number): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, String(value));
    return urlObj.toString();
  }

  getParam(url: string, key: string): string | null {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(key);
  }

  removeParam(url: string, key: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(key);
    return urlObj.toString();
  }

  encodeParams(params: Record<string, unknown>): string {
    return new URLSearchParams(params as Record<string, string>).toString();
  }

  decodeParams(query: string): Record<string, string> {
    const params: Record<string, string> = {};
    new URLSearchParams(query).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
}

export class QueryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/query',
    name: 'Query Builder',
    version: '1.0.0',
    description: 'Query string builder',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['query', 'search', 'filter'],
  };

  public capabilities: PluginCapabilities = {};

  private params: Map<string, string | number | boolean> = new Map();

  set(key: string, value: string | number | boolean): void {
    this.params.set(key, value);
  }

  get(key: string): string | number | boolean | undefined {
    return this.params.get(key);
  }

  remove(key: string): void {
    this.params.delete(key);
  }

  has(key: string): boolean {
    return this.params.has(key);
  }

  clear(): void {
    this.params.clear();
  }

  toString(): string {
    const entries = Array.from(this.params.entries());
    if (entries.length === 0) return '';

    return new URLSearchParams(entries as [string, string][]).toString();
  }

  static fromString(query: string): QueryPlugin {
    const plugin = new QueryPlugin();
    new URLSearchParams(query).forEach((value, key) => {
      plugin.set(key, value);
    });
    return plugin;
  }
}

export class Base64Plugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/base64',
    name: 'Base64',
    version: '1.0.0',
    description: 'Base64 encoding/decoding',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['base64', 'encoding', 'decode'],
  };

  public capabilities: PluginCapabilities = {};

  encode(data: string | ArrayBuffer): string {
    if (typeof data === 'string') {
      return btoa(encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
    }

    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  decode(data: string): string {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  encodeURL(data: string): string {
    return encodeURIComponent(data);
  }

  decodeURL(data: string): string {
    return decodeURIComponent(data);
  }

  toArrayBuffer(data: string): ArrayBuffer {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export class JSONPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/json',
    name: 'JSON Utilities',
    version: '1.0.0',
    description: 'JSON parsing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['json', 'parse', 'stringify'],
  };

  public capabilities: PluginCapabilities = {};

  safeParse<T>(json: string, defaultValue: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return defaultValue;
    }
  }

  deepParse<T>(json: string): T {
    const reviver = (_key: string, value: unknown): unknown => {
      if (typeof value === 'string') {
        const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.exec(value);
        if (dateMatch) {
          return new Date(value);
        }
      }
      return value;
    };

    return JSON.parse(json, reviver);
  }

  minify(json: string): string {
    try {
      return JSON.stringify(JSON.parse(json));
    } catch {
      return json;
    }
  }

  prettify(json: string, spaces = 2): string {
    try {
      return JSON.stringify(JSON.parse(json), null, spaces);
    } catch {
      return json;
    }
  }

  compact(json: string): string {
    return this.minify(json);
  }
}

export class ObjectPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/object',
    name: 'Object Utilities',
    version: '1.0.0',
    description: 'Object manipulation utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['object', 'utils', 'manipulation'],
  };

  public capabilities: PluginCapabilities = {};

  clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  merge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
    for (const source of sources) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key as keyof T] = source[key as T[keyof T];
        }
      }
    }
    return target;
  }

  pick<T extends Record<string, unknown>, K extends keyof T>(
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

  omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result as Omit<T, K>;
  }

  mapValues<T extends Record<string, unknown>, U>(
    obj: T,
    fn: (value: T[keyof T], key: keyof T) => U
  ): Record<keyof T, U> {
    const result = {} as Record<keyof T, U>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = fn(obj[key], key);
      }
    }
    return result;
  }

  filter<T extends Record<string, unknown>>(
    obj: T,
    fn: (value: T[keyof T], key: keyof T) => boolean
  ): Partial<T> {
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && fn(obj[key], key)) {
        result[key] = obj[key];
      }
    }
    return result;
  }
}

export const cryptoPlugin = new CryptoPlugin();
export const uuidPlugin = new UUIDPlugin();
export const colorPlugin = new ColorPlugin();
export const slugPlugin = new SlugPlugin();
export const slugifyPlugin = new SlugifyPlugin();
export const urlPlugin = new URLPlugin();
export const queryPlugin = new QueryPlugin();
export const base64Plugin = new Base64Plugin();
export const jsonPlugin = new JSONPlugin();
export const objectPlugin = new ObjectPlugin();

export function registerUtility2Plugins(): Plugin[] {
  return [
    cryptoPlugin,
    uuidPlugin,
    colorPlugin,
    slugPlugin,
    slugifyPlugin,
    urlPlugin,
    queryPlugin,
    base64Plugin,
    jsonPlugin,
    objectPlugin,
  ];
}