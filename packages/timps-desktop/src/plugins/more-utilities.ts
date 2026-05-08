import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class ValidationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/validation',
    name: 'Validation',
    version: '1.0.0',
    description: 'Data validation utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['validation', 'validator', 'check', 'sanitize'],
  };

  public capabilities: PluginCapabilities = {};

  isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isPhone(phone: string, country?: string): boolean {
    const phoneRegexes: Record<string, RegExp> = {
      US: /^\+?1?\d{10}$/,
      UK: /^\+?44\d{10}$/,
      default: /^\+?\d{8,15}$/
    };
    const regex = phoneRegexes[country || 'default'];
    return regex.test(phone.replace(/\D/g, ''));
  }

  isCreditCard(card: string): boolean {
    const clean = card.replace(/\s/g, '');

    if (!/^\d{13,19}$/.test(clean)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  isDate(date: string): boolean {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  isAlpha(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
  }

  isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  }

  isNumeric(str: string): boolean {
    return /^[0-9]+$/.test(str);
  }

  isHexColor(color: string): boolean {
    return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
  }

  isHex(str: string): boolean {
    return /^[0-9A-Fa-f]+$/.test(str);
  }

  isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  isJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  isIp(str: string, version?: 4 | 6): boolean {
    if (version === 4) {
      return /^(\d{1,3}\.){3}\d{1,3}$/.test(str) &&
        str.split('.').every(part => parseInt(part) <= 255);
    }
    if (version === 6) {
      return /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(str);
    }
    return this.isIp(str, 4) || this.isIp(str, 6);
  }

  isPostalCode(code: string, country?: string): boolean {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      UK: /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i,
      CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
      default: /^[A-Z0-9]{3,10}$/i
    };

    const pattern = patterns[country || 'default'];
    return pattern.test(code);
  }

  isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  isMd5(str: string): boolean {
    return /^[0-9a-f]{32}$/i.test(str);
  }

  isSha(str: string, length: number = 256): boolean {
    return new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(str);
  }

  isMongoId(str: string): boolean {
    return /^[0-9a-f]{24}$/i.test(str);
  }

  isBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
    }
    return false;
  }

  isFloat(value: unknown): boolean {
    return typeof value === 'number' && !isNaN(value) && value % 1 !== 0;
  }

  isInt(value: unknown): boolean {
    return typeof value === 'number' && !isNaN(value) && value % 1 === 0;
  }

  isPositive(value: unknown): boolean {
    return typeof value === 'number' && value > 0;
  }

  isNegative(value: unknown): boolean {
    return typeof value === 'number' && value < 0;
  }

  isDivisibleBy(value: number, divisor: number): boolean {
    return value % divisor === 0;
  }

  isDivisibleByFloat(value: number, divisor: number): boolean {
    return value % divisor === 0;
  }

  isLength(str: string, min: number, max?: number): boolean {
    const len = str.length;
    if (len < min) return false;
    if (max !== undefined && len > max) return false;
    return true;
  }

  isByteLength(str: string, min: number, max?: number): boolean {
    const len = new TextEncoder().encode(str).length;
    if (len < min) return false;
    if (max !== undefined && len > max) return false;
    return true;
  }

  matches(str: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return str.includes(pattern);
    }
    return pattern.test(str);
  }
}

export class SanitizationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sanitization',
    name: 'Sanitization',
    version: '1.0.0',
    description: 'Data sanitization utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sanitize', 'clean', 'escape', 'normalize'],
  };

  public capabilities: PluginCapabilities = {};

  toBoolean(value: unknown, strict = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (strict) return lower === 'true';
      return ['true', '1', 'yes', 'on'].includes(lower);
    }
    return false;
  }

  toNumber(value: unknown, decimals?: number): number {
    const num = Number(value);
    if (isNaN(num)) return 0;
    if (decimals !== undefined) {
      return parseFloat(num.toFixed(decimals));
    }
    return num;
  }

  toInt(value: unknown, radix = 10): number {
    return parseInt(String(value), radix);
  }

  toFloat(value: unknown): number {
    return parseFloat(String(value));
  }

  toString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  toArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  }

  toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? null : d;
  }

  trim(str: unknown): string {
    return String(str).trim();
  }

  trimEnd(str: unknown): string {
    return String(str).trimEnd();
  }

  trimStart(str: unknown): string {
    return String(str).trimStart();
  }

  toLower(str: unknown): string {
    return String(str).toLowerCase();
  }

  toUpper(str: unknown): string {
    return String(str).toUpperCase();
  }

  toCamelCase(str: unknown): string {
    return String(str)
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase());
  }

  escapeHtml(str: unknown): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  unescapeHtml(str: unknown): string {
    return String(str)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  stripTags(str: unknown): string {
    return String(str).replace(/<[^>]*>/g, '');
  }

  removeNonWord(str: unknown): string {
    return String(str).replace(/[^a-zA-Z0-9\s]+/g, '');
  }

  normalizeEmail(email: unknown): string {
    return String(email).toLowerCase().trim();
  }

  normalizePhone(phone: unknown): string {
    return String(phone).replace(/\D/g, '');
  }

  whitelist(str: unknown, chars: string): string {
    const pattern = new RegExp(`[^${chars}]+`, 'g');
    return String(str).replace(pattern, '');
  }

  blacklist(str: unknown, chars: string): string {
    const pattern = new RegExp(`[${chars}]+`, 'g');
    return String(str).replace(pattern, '');
  }

  replace(str: unknown, pattern: string, replacement: string): string {
    return String(str).split(pattern).join(replacement);
  }

  slugify(str: unknown): string {
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export class MathUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/math-utils',
    name: 'Math Utilities',
    version: '1.0.0',
    description: 'Math utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['math', 'number', 'calculate', 'utils'],
  };

  public capabilities: PluginCapabilities = {};

  sum(...numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0);
  }

  avg(...numbers: number[]): number {
    return numbers.length ? this.sum(...numbers) / numbers.length : 0;
  }

  median(...numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  variance(...numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const avg = this.avg(...numbers);
    const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return this.avg(...squaredDiffs);
  }

  stddev(...numbers: number[]): number {
    return Math.sqrt(this.variance(...numbers));
  }

  min(...numbers: number[]): number {
    return Math.min(...numbers);
  }

  max(...numbers: number[]): number {
    return Math.max(...numbers);
  }

  range(...numbers: number[]): number {
    return Math.max(...numbers) - Math.min(...numbers);
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  round(num: number, decimals = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  floor(num: number, decimals = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
  }

  ceil(num: number, decimals = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.ceil(num * factor) / factor;
  }

  abs(num: number): number {
    return Math.abs(num);
  }

  sign(num: number): number {
    return Math.sign(num);
  }

  pow(base: number, exp: number): number {
    return Math.pow(base, exp);
  }

  sqrt(num: number): number {
    return Math.sqrt(num);
  }

  exp(num: number): number {
    return Math.exp(num);
  }

  log(num: number): number {
    return Math.log(num);
  }

  log10(num: number): number {
    return Math.log10(num);
  }

  log2(num: number): number {
    return Math.log2(num);
  }

  sin(num: number): number {
    return Math.sin(num);
  }

  cos(num: number): number {
    return Math.cos(num);
  }

  tan(num: number): number {
    return Math.tan(num);
  }

  asin(num: number): number {
    return Math.asin(num);
  }

  acos(num: number): number {
    return Math.acos(num);
  }

  atan(num: number): number {
    return Math.atan(num);
  }

  toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  random(min = 0, max = 1): number {
    return Math.random() * (max - min) + min;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  lcm(a: number, b: number): number {
    return (a * b) / this.gcd(a, b);
  }

  factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }

  fibonacci(n: number): number {
    const fib: number[] = [0, 1];
    for (let i = 2; i <= n; i++) {
      fib[i] = fib[i - 1] + fib[i - 2];
    }
    return fib[n];
  }

  isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;

    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }

    return true;
  }

  primes(max: number): number[] {
    const primes: number[] = [];
    for (let i = 2; i <= max; i++) {
      if (this.isPrime(i)) primes.push(i);
    }
    return primes;
  }
}

export class ColorUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/color-utils',
    name: 'Color Utilities',
    version: '1.0.0',
    description: 'Color manipulation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['color', 'rgb', 'hex', 'hsl'],
  };

  public capabilities: PluginCapabilities = {};

  hexToRgb(hex: string): RgbColor | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b]
      .map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');
  }

  rgbToHsl(r: number, g: number, b: number): HslColor {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  hslToRgb(h: number, s: number, l: number): RgbColor {
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

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  invert(color: string): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;
    return this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  lighten(color: string, amount: number): string {
    const hsl = this.rgbToHsl(
      ...Object.values(this.hexToRgb(color)!)
    );
    hsl.l = Math.min(100, hsl.l + amount);
    const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  darken(color: string, amount: number): string {
    const hsl = this.rgbToHsl(
      ...Object.values(this.hexToRgb(color)!)
    );
    hsl.l = Math.max(0, hsl.l - amount);
    const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  saturate(color: string, amount: number): string {
    const hsl = this.rgbToHsl(
      ...Object.values(this.hexToRgb(color)!)
    );
    hsl.s = Math.min(100, hsl.s + amount);
    const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  desaturate(color: string, amount: number): string {
    const hsl = this.rgbToHsl(
      ...Object.values(this.hexToRgb(color)!)
    );
    hsl.s = Math.max(0, hsl.s - amount);
    const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  mix(color1: string, color2: string, weight = 50): string {
    const rgb1 = this.hexToRgb(color1)!;
    const rgb2 = this.hexToRgb(color2)!;
    const w = weight / 100;

    return this.rgbToHex(
      Math.round(rgb1.r * (1 - w) + rgb2.r * w),
      Math.round(rgb1.g * (1 - w) + rgb2.g * w),
      Math.round(rgb1.b * (1 - w) + rgb2.b * w)
    );
  }
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}