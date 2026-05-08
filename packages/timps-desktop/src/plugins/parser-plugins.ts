import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class MarkdownParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/markdown-parser',
    name: 'Markdown Parser',
    version: '1.0.0',
    description: 'Advanced markdown parsing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['markdown', 'parser', 'render'],
  };

  public capabilities: PluginCapabilities = {};

  parse(markdown: string): string {
    let html = markdown;

    html = html.replace(/^#{6}\s+(.*$)/gm, '<h6>$1</h6>');
    html = html.replace(/^#{5}\s+(.*$)/gm, '<h5>$1</h5>');
    html = html.replace(/^#{4}\s+(.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^#{3}\s+(.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^#{2}\s+(.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^#{1}\s+(.*$)/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1"/>');

    html = html.replace(/^\*\s+(.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

    html = html.replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>');

    html = html.replace(/^>\s+(.*$)/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    html = html.replace(/\n/g, '<br>');

    return html;
  }

  toPlainText(markdown: string): string {
    return markdown
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\n+/g, ' ')
      .trim();
  }

  extractHeadings(markdown: string): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];
    const regex = /^(#{1,6})\s+(.*)$/gm;
    let match;

    while ((match = regex.exec(markdown))) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }

    return headings;
  }

  extractLinks(markdown: string): Array<{ text: string; url: string }> {
    const links: Array<{ text: string; url: string }> = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(markdown))) {
      links.push({ text: match[1], url: match[2] });
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
    return this.toPlainText(markdown).split(/\s+/).filter(w => w.length > 0).length;
  }

  characterCount(markdown: string): number {
    return markdown.replace(/\s/g, '').length;
  }

  readingTime(markdown: string, wordsPerMinute = 200): number {
    return Math.ceil(this.wordCount(markdown) / wordsPerMinute);
  }
}

export class HtmlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/html-parser',
    name: 'HTML Parser',
    version: '1.0.0',
    description: 'HTML parsing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['html', 'parser', 'dom'],
  };

  public capabilities: PluginCapabilities = {};

  parse(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  querySelector(html: string, selector: string): string[] {
    const doc = this.parse(html);
    const elements = doc.querySelectorAll(selector);
    return Array.from(elements).map(el => el.innerHTML);
  }

  extractText(html: string): string {
    const doc = this.parse(html);
    return doc.body.textContent || '';
  }

  extractLinks(html: string): string[] {
    const doc = this.parse(html);
    const links = doc.querySelectorAll('a[href]');
    return Array.from(links).map(link => link.getAttribute('href') || '');
  }

  extractImages(html: string): string[] {
    const doc = this.parse(html);
    const images = doc.querySelectorAll('img[src]');
    return Array.from(images).map(img => img.getAttribute('src') || '');
  }

  extractScripts(html: string): string[] {
    const doc = this.parse(html);
    const scripts = doc.querySelectorAll('script[src]');
    return Array.from(scripts).map(script => script.getAttribute('src') || '');
  }

  extractStyles(html: string): string[] {
    const doc = this.parse(html);
    const styles = doc.querySelectorAll('link[rel="stylesheet"]');
    return Array.from(styles).map(style => style.getAttribute('href') || '');
  }

  getMetaTags(html: string): Record<string, string> {
    const doc = this.parse(html);
    const metas = doc.querySelectorAll('meta');
    const result: Record<string, string> = {};

    metas.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        result[name] = content;
      }
    });

    return result;
  }

  getTitle(html: string): string {
    const doc = this.parse(html);
    const title = doc.querySelector('title');
    return title?.textContent || '';
  }

  sanitize(html: string, allowedTags: string[] = []): string {
    const doc = this.parse(html);
    const allElements = doc.body.querySelectorAll('*');

    allElements.forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        el.remove();
      }
    });

    return doc.body.innerHTML;
  }
}

export class CsvParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/csv-parser',
    name: 'CSV Parser',
    version: '1.0.0',
    description: 'CSV parsing and conversion',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['csv', 'parse', 'convert'],
  };

  public capabilities: PluginCapabilities = {};

  parse(csv: string, options?: { delimiter?: string; hasHeader?: boolean }): {
    headers: string[];
    rows: Record<string, string>[];
  } {
    const delimiter = options?.delimiter || ',';
    const lines = csv.trim().split('\n');
    const headers = this.parseLine(lines[0], delimiter);

    const rows: Record<string, string>[] = [];
    const startIndex = options?.hasHeader !== false ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseLine(lines[i], delimiter);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row);
    }

    return { headers, rows };
  }

  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  toCsv(data: Record<string, string>[], options?: { delimiter?: string; includeHeaders?: boolean }): string {
    if (data.length === 0) return '';

    const delimiter = options?.delimiter || ',';
    const headers = Object.keys(data[0]);

    let csv = '';

    if (options?.includeHeaders !== false) {
      csv += headers.join(delimiter) + '\n';
    }

    data.forEach(row => {
      csv += headers.map(h => {
        const value = row[h] || '';
        return value.includes(delimiter) || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(delimiter) + '\n';
    });

    return csv;
  }

  toJson(csv: string): string {
    const { rows } = this.parse(csv);
    return JSON.stringify(rows, null, 2);
  }

  toArray(csv: string): string[][] {
    const lines = csv.trim().split('\n');
    return lines.map(line => this.parseLine(line, ','));
  }
}

export class XmlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/xml-parser',
    name: 'XML Parser',
    version: '1.0.0',
    description: 'XML parsing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['xml', 'parse', 'dom'],
  };

  public capabilities: PluginCapabilities = {};

  parse(xml: string): XMLDocument {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'text/xml');
  }

  toJson(xml: string): string {
    const doc = this.parse(xml);
    const json = this.xmlToJson(doc.documentElement);
    return JSON.stringify(json, null, 2);
  }

  private xmlToJson(element: Element): unknown {
    const obj: Record<string, unknown> = {};

    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        obj[`@${attr.name}`] = attr.value;
      }
    }

    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          return text;
        }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const childElement = node as Element;
        const childObj = this.xmlToJson(childElement);

        if (obj[childElement.tagName]) {
          if (!Array.isArray(obj[childElement.tagName])) {
            obj[childElement.tagName] = [obj[childElement.tagName]];
          }
          (obj[childElement.tagName] as unknown[]).push(childObj);
        } else {
          obj[childElement.tagName] = childObj;
        }
      }
    }

    return obj;
  }

  query(xml: string, xpath: string): string[] {
    const doc = this.parse(xml);
    const result = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const values: string[] = [];

    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node) values.push(node.textContent || '');
    }

    return values;
  }
}

export class UrlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/url-parser',
    name: 'URL Parser',
    version: '1.0.0',
    description: 'URL parsing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['url', 'parse', 'uri'],
  };

  public capabilities: PluginCapabilities = {};

  parse(url: string): {
    protocol: string;
    host: string;
    port: string;
    pathname: string;
    query: Record<string, string>;
    hash: string;
    username: string;
    password: string;
  } {
    const urlObj = new URL(url);

    const query: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return {
      protocol: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      query,
      hash: urlObj.hash.replace('#', ''),
      username: urlObj.username,
      password: urlObj.password,
    };
  }

  build(base: string, params: Record<string, string | number | boolean>): string {
    const url = new URL(base);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  normalize(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  isAbsolute(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  join(...parts: string[]): string {
    return parts.join('/').replace(/([^:]\/)\/+/g, '$1');
  }

  resolve(from: string, to: string): string {
    return new URL(to, new URL(from, 'http://example.com')).href;
  }

  getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  getExtension(url: string): string {
    const pathname = new URL(url).pathname;
    const lastDot = pathname.lastIndexOf('.');
    return lastDot > 0 ? pathname.slice(lastDot + 1) : '';
  }
}

export class DateParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/date-parser',
    name: 'Date Parser',
    version: '1.0.0',
    description: 'Flexible date parsing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['date', 'parse', 'time'],
  };

  public capabilities: PluginCapabilities = {};

  parse(dateString: string): Date | null {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  parseRelative(dateString: string): Date | null {
    const now = new Date();
    const lower = dateString.toLowerCase();

    const patterns: Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => Date }> = [
      { pattern: /(\d+)\s*seconds?\s*ago/i, handler: m => new Date(now.getTime() - parseInt(m[1]) * 1000) },
      { pattern: /(\d+)\s*minutes?\s*ago/i, handler: m => new Date(now.getTime() - parseInt(m[1]) * 60 * 1000) },
      { pattern: /(\d+)\s*hours?\s*ago/i, handler: m => new Date(now.getTime() - parseInt(m[1]) * 60 * 60 * 1000) },
      { pattern: /(\d+)\s*days?\s*ago/i, handler: m => new Date(now.getTime() - parseInt(m[1]) * 24 * 60 * 60 * 1000) },
      { pattern: /(\d+)\s*weeks?\s*ago/i, handler: m => new Date(now.getTime() - parseInt(m[1]) * 7 * 24 * 60 * 60 * 1000) },
      { pattern: /in\s*(\d+)\s*seconds?/i, handler: m => new Date(now.getTime() + parseInt(m[1]) * 1000) },
      { pattern: /in\s*(\d+)\s*minutes?/i, handler: m => new Date(now.getTime() + parseInt(m[1]) * 60 * 1000) },
      { pattern: /in\s*(\d+)\s*hours?/i, handler: m => new Date(now.getTime() + parseInt(m[1]) * 60 * 60 * 1000) },
      { pattern: /in\s*(\d+)\s*days?/i, handler: m => new Date(now.getTime() + parseInt(m[1]) * 24 * 60 * 60 * 1000) },
    ];

    for (const { pattern, handler } of patterns) {
      const match = lower.match(pattern);
      if (match) {
        return handler(match);
      }
    }

    return this.parse(dateString);
  }

  parseMultiple(dateStrings: string[]): Date[] {
    return dateStrings.map(d => this.parseRelative(d)).filter((d): d is Date => d !== null) as Date[];
  }

  isValid(dateString: string): boolean {
    return this.parse(dateString) !== null;
  }

  getTimestamp(date: Date): number {
    return date.getTime();
  }

  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  difference(date1: Date, date2: Date): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const diff = Math.abs(date1.getTime() - date2.getTime());

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor(diff / (1000 * 60 * 60)) % 24,
      minutes: Math.floor(diff / (1000 * 60)) % 60,
      seconds: Math.floor(diff / 1000) % 60,
    };
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}

export class NumberParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/number-parser',
    name: 'Number Parser',
    version: '1.0.0',
    description: 'Number parsing utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['number', 'parse', 'convert'],
  };

  public capabilities: PluginCapabilities = {};

  parse(value: string, defaultValue = 0): number {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? defaultValue : num;
  }

  parseInt(value: string, defaultValue = 0, radix = 10): number {
    const num = parseInt(value, radix);
    return isNaN(num) ? defaultValue : num;
  }

  parseCurrency(value: string, currency = 'USD'): number {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned);
  }

  parsePercent(value: string): number {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) / 100;
  }

  parseRange(value: string): [number, number] | null {
    const match = value.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return null;
    return [parseInt(match[1]), parseInt(match[2])];
  }

  parseRoman(value: string): number {
    const romanNumerals: Record<string, number> = {
      I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
    };

    const upper = value.toUpperCase();
    let result = 0;
    let prev = 0;

    for (let i = upper.length - 1; i >= 0; i--) {
      const current = romanNumerals[upper[i]] || 0;
      if (current < prev) {
        result -= current;
      } else {
        result += current;
      }
      prev = current;
    }

    return result;
  }

  toWords(num: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

    if (num === 0) return 'zero';
    if (num < 0) return 'negative ' + this.toWords(-num);

    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + this.toWords(num % 100) : '');

    return String(num);
  }

  formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  }

  formatPercent(value: number, decimals = 2, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: decimals }).format(value);
  }
}

export class UnitConverterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/unit-converter',
    name: 'Unit Converter',
    version: '1.0.0',
    description: 'Comprehensive unit conversion',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['unit', 'converter', 'conversion'],
  };

  public capabilities: PluginCapabilities = {};

  convert(value: number, fromUnit: string, toUnit: string): number {
    const conversions: Record<string, Record<string, number>> = {
      length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 },
      mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 907.185 },
      temperature: { c: 1, f: 0.5556, k: 1 },
      volume: { l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353, pt: 0.473176, cup: 0.236588 },
      area: { sqm: 1, sqkm: 1000000, sqft: 0.092903, sqmi: 2589988.11, acre: 4046.86, hectare: 10000 },
      speed: { 'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704, 'knot': 0.514444, 'ft/s': 0.3048 },
      time: { s: 1, min: 60, h: 3600, day: 86400, week: 604800, month: 2629746, year: 31556952 },
      data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 },
    };

    for (const [category, units] of Object.entries(conversions)) {
      if (units[fromUnit] && units[toUnit]) {
        return value * units[fromUnit] / units[toUnit];
      }
    }

    throw new Error(`Conversion not supported: ${fromUnit} to ${toUnit}`);
  }

  getCategories(): string[] {
    return ['length', 'mass', 'temperature', 'volume', 'area', 'speed', 'time', 'data'];
  }

  getUnits(category: string): string[] {
    const units: Record<string, string[]> = {
      length: ['m', 'km', 'cm', 'mm', 'mi', 'ft', 'in', 'yd'],
      mass: ['kg', 'g', 'mg', 'lb', 'oz', 'ton'],
      temperature: ['c', 'f', 'k'],
      volume: ['l', 'ml', 'gal', 'qt', 'pt', 'cup'],
      area: ['sqm', 'sqkm', 'sqft', 'sqmi', 'acre', 'hectare'],
      speed: ['m/s', 'km/h', 'mph', 'knot', 'ft/s'],
      time: ['s', 'min', 'h', 'day', 'week', 'month', 'year'],
      data: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'],
    };

    return units[category] || [];
  }
}

export const markdownParserPlugin = new MarkdownParserPlugin();
export const htmlParserPlugin = new HtmlParserPlugin();
export const csvParserPlugin = new CsvParserPlugin();
export const xmlParserPlugin = new XmlParserPlugin();
export const urlParserPlugin = new UrlParserPlugin();
export const dateParserPlugin = new DateParserPlugin();
export const numberParserPlugin = new NumberParserPlugin();
export const unitConverterPlugin = new UnitConverterPlugin();

export function registerParserPlugins(): Plugin[] {
  return [
    markdownParserPlugin,
    htmlParserPlugin,
    csvParserPlugin,
    xmlParserPlugin,
    urlParserPlugin,
    dateParserPlugin,
    numberParserPlugin,
    unitConverterPlugin,
  ];
}