import { Plugin, PluginManifest, PluginCapabilities } from './types';

// ── Tag scanning helpers ───────────────────────────────────────────────────
// HTML is sanitized and flattened with a left-to-right scan instead of
// regexes. Regex stripping missed tags with odd whitespace (`</script >`),
// could be defeated by nesting (`<<script>script>`), and decoding/rebuilding
// around them was the classic way to smuggle markup through.

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

/** Read a tag name starting at `start`, lowercased. */
function readTagName(html: string, start: number): { name: string; after: number } {
  let i = start;
  while (i < html.length && isSpace(html[i])) i++;
  let name = '';
  while (i < html.length) {
    const ch = html[i];
    const isLower = ch >= 'a' && ch <= 'z';
    const isUpper = ch >= 'A' && ch <= 'Z';
    const isDigit = ch >= '0' && ch <= '9';
    if (isLower || isUpper || isDigit || ch === '-' || ch === ':') {
      name += ch.toLowerCase();
      i++;
    } else {
      break;
    }
  }
  return { name, after: i };
}

/** Remove `<tag ...> ... </tag>` blocks, including malformed and unclosed ones. */
function dropElementBlocks(html: string, tags: Set<string>): string {
  const lower = html.toLowerCase();
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt + 1);
    if (gt === -1) { out += html.slice(lt); break; }
    const closing = html[lt + 1] === '/';
    const { name } = readTagName(html, lt + (closing ? 2 : 1));
    if (tags.has(name)) {
      if (closing) { i = gt + 1; continue; }
      const closeAt = lower.indexOf('</' + name, gt + 1);
      if (closeAt === -1) { i = html.length; break; }
      const closeGt = html.indexOf('>', closeAt);
      if (closeGt === -1) { i = html.length; break; }
      i = closeGt + 1;
      continue;
    }
    out += html.slice(lt, gt + 1);
    i = gt + 1;
  }
  return out;
}

/** Flatten tags to text in one pass; the result is never re-parsed. */
function stripTags(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt + 1);
    if (gt === -1) { out += html.slice(lt); break; }
    i = gt + 1;
  }
  return out.trim();
}

/** Parse the attribute list inside a tag. */
function readAttributes(raw: string): Array<{ name: string; value: string }> {
  const attrs: Array<{ name: string; value: string }> = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && isSpace(raw[i])) i++;
    if (i >= raw.length) break;
    const nameStart = i;
    while (i < raw.length && !isSpace(raw[i]) && raw[i] !== '=' && raw[i] !== '/' && raw[i] !== '>') i++;
    const name = raw.slice(nameStart, i).toLowerCase();
    while (i < raw.length && isSpace(raw[i])) i++;
    let value = '';
    if (raw[i] === '=') {
      i++;
      while (i < raw.length && isSpace(raw[i])) i++;
      const quote = raw[i];
      if (quote === '"' || quote === "'") {
        i++;
        const close = raw.indexOf(quote, i);
        if (close === -1) { value = raw.slice(i); i = raw.length; }
        else { value = raw.slice(i, close); i = close + 1; }
      } else {
        const valueStart = i;
        while (i < raw.length && !isSpace(raw[i]) && raw[i] !== '>') i++;
        value = raw.slice(valueStart, i);
      }
    }
    if (name) attrs.push({ name, value });
  }
  return attrs;
}

const DANGEROUS_SCHEME = /^\s*(?:javascript|vbscript|data)\s*:/i;


export class MarkdownRendererPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/markdown-renderer',
    name: 'Markdown Renderer',
    version: '1.0.0',
    description: 'Render markdown to HTML',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['markdown', 'render', 'html', 'converter'],
  };

  public capabilities: PluginCapabilities = {};

  private plugins: MarkdownPlugin[] = [];

  use(plugin: MarkdownPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  render(markdown: string): string {
    let html = markdown;

    for (const plugin of this.plugins) {
      html = plugin.render(html);
    }

    html = this.renderHeadings(html);
    html = this.renderEmphasis(html);
    html = this.renderLinks(html);
    html = this.renderImages(html);
    html = this.renderLists(html);
    html = this.renderCodeBlocks(html);
    html = this.renderBlockquotes(html);
    html = this.renderHorizontalRules(html);
    html = this.renderParagraphs(html);

    return html;
  }

  private renderHeadings(html: string): string {
    return html
      .replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  }

  private renderEmphasis(html: string): string {
    return html
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  private renderLinks(html: string): string {
    return html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>'
    );
  }

  private renderImages(html: string): string {
    return html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1"/>'
    );
  }

  private renderLists(html: string): string {
    const unordered = html.replace(/^\*\s+(.*)$/gm, '<li>$1</li>');
    const unorderedList = unordered.replace(
      /(<li>.*<\/li>)+/g,
      '<ul>$&</ul>'
    );

    const ordered = unorderedList.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');
    return ordered.replace(/(<li>.*<\/li>)+/g, '<ol>$&</ol>');
  }

  private renderCodeBlocks(html: string): string {
    return html.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>'
    );
  }

  private renderBlockquotes(html: string): string {
    return html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
  }

  private renderHorizontalRules(html: string): string {
    return html.replace(/^---+$/gm, '<hr>');
  }

  private renderParagraphs(html: string): string {
    return html.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>');
  }

  renderToPlainText(markdown: string): string {
    let text = markdown;

    text = text.replace(/^#{1,6}\s+/gm, '');
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`(.+?)`/g, '$1');
    text = text.replace(/^>\s+/gm, '');
    text = text.replace(/^[-*+]\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    return text.trim();
  }
}

interface MarkdownPlugin {
  render(markdown: string): string;
}

export class HtmlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/html-parser',
    name: 'HTML Parser',
    version: '1.0.0',
    description: 'Parse and manipulate HTML',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['html', 'parser', 'dom', 'parse'],
  };

  public capabilities: PluginCapabilities = {};

  parse(html: string): HtmlDocument {
    return new HtmlDocument(html);
  }

  sanitize(html: string, options?: SanitizeOptions): string {
    const defaultOptions: SanitizeOptions = {
      allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
      allowedAttributes: ['href', 'src', 'alt', 'title'],
    };

    const opts = { ...defaultOptions, ...options };
    const allowedTags = new Set((opts.allowedTags ?? []).map(t => t.toLowerCase()));
    const allowedAttributes = new Set((opts.allowedAttributes ?? []).map(a => a.toLowerCase()));

    // Step 1: drop the contents of elements that must never survive, including
    // malformed and unclosed forms.
    const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base']);
    const withoutBlocks = dropElementBlocks(html, blocked);

    // Step 2: rebuild only permitted tags and attributes. Anything else is
    // removed as a tag and its text kept, so handler attributes and unknown
    // elements cannot survive whatever quoting they use.
    let result = '';
    let i = 0;
    while (i < withoutBlocks.length) {
      const lt = withoutBlocks.indexOf('<', i);
      if (lt === -1) { result += withoutBlocks.slice(i); break; }
      result += withoutBlocks.slice(i, lt);
      const gt = withoutBlocks.indexOf('>', lt + 1);
      if (gt === -1) { result += withoutBlocks.slice(lt); break; }
      const raw = withoutBlocks.slice(lt + 1, gt);
      i = gt + 1;

      const closing = raw.startsWith('/');
      const { name, after } = readTagName(raw, closing ? 1 : 0);
      if (!name || !allowedTags.has(name)) continue;
      if (closing) { result += `</${name}>`; continue; }

      const selfClosing = raw.trimEnd().endsWith('/');
      const kept = readAttributes(raw.slice(after))
        .filter(a => allowedAttributes.has(a.name))
        .filter(a => (a.name !== 'href' && a.name !== 'src') || !DANGEROUS_SCHEME.test(a.value))
        .map(a => `${a.name}="${a.value.replace(/"/g, '&quot;')}"`);
      result += `<${name}${kept.length ? ' ' + kept.join(' ') : ''}${selfClosing ? ' /' : ''}>`;
    }

    return result;
  }

  minify(html: string): string {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s*=\s*/g, '=')
      .trim();
  }

  prettify(html: string, indent = 2): string {
    let formatted = '';
    let level = 0;
    const spaces = ' '.repeat(indent);

    for (const token of html.split(/(<[^>]+>)/g)) {
      if (token.startsWith('</')) {
        level--;
        formatted += spaces.repeat(Math.max(0, level)) + token + '\n';
      } else if (token.startsWith('<') && !token.startsWith('</') && !token.startsWith('<')) {
        formatted += spaces.repeat(level) + token + '\n';
        level++;
      } else if (!token.startsWith('<')) {
        formatted += spaces.repeat(level) + token + '\n';
      }
    }

    return formatted.trim();
  }
}

export class HtmlDocument {
  private parser: DOMParser;

  constructor(public html: string) {
    this.parser = new DOMParser();
  }

  querySelector(selector: string): HtmlElement | null {
    return null;
  }

  querySelectorAll(selector: string): HtmlElement[] {
    return [];
  }

  getElementsByTagName(tag: string): HtmlElement[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    const elements: HtmlElement[] = [];
    let match;

    while ((match = regex.exec(this.html)) !== null) {
      elements.push(new HtmlElement(match[0], match[1]));
    }

    return elements;
  }

  textContent(): string {
    return stripTags(this.html);
  }
}

export class HtmlElement {
  constructor(public outerHtml: string, public innerHtml: string) {}

  getAttribute(name: string): string | null {
    const match = this.outerHtml.match(new RegExp(`${name}="([^"]*)"`));
    return match ? match[1] : null;
  }

  textContent(): string {
    return stripTags(this.innerHtml);
  }

  get children(): HtmlElement[] {
    const regex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>/g;
    const children: HtmlElement[] = [];
    let match;

    while ((match = regex.exec(this.innerHtml)) !== null) {
      children.push(new HtmlElement(match[0], match[2]));
    }

    return children;
  }
}

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export class CsvParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/csv-parser',
    name: 'CSV Parser',
    version: '1.0.0',
    description: 'Parse CSV files',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['csv', 'parser', 'file', 'export'],
  };

  public capabilities: PluginCapabilities = {};

  parse(csv: string, options?: CsvOptions): CsvData {
    const opts = { delimiter: ',', ...options };
    const lines = csv.trim().split('\n');

    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = this.parseLine(lines[0], opts.delimiter);
    const rows = lines.slice(1).map(line => {
      const values = this.parseLine(line, opts.delimiter);
      return headers.reduce((obj, header, i) => {
        obj[header] = values[i] || '';
        return obj;
      }, {} as Record<string, string>);
    });

    return { headers, rows };
  }

  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
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

  toCsv(data: CsvData, options?: CsvOptions): string {
    const opts = { delimiter: ',', ...options };
    const lines: string[] = [];
    lines.push(data.headers.join(opts.delimiter));

    for (const row of data.rows) {
      const values = data.headers.map(header => {
        const value = String(row[header] || '');
        if (value.includes(opts.delimiter) || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      lines.push(values.join(opts.delimiter));
    }

    return lines.join('\n');
  }

  toJson(csv: string, options?: CsvOptions): unknown {
    const data = this.parse(csv, options);
    return data.rows;
  }

  fromJson(json: unknown[], options?: CsvOptions): string {
    if (json.length === 0) return '';

    const data: CsvData = {
      headers: Object.keys(json[0] as Record<string, string>),
      rows: json as Record<string, string>[]
    };

    return this.toCsv(data, options);
  }

  filter(csv: string, predicate: (row: Record<string, string>) => boolean, options?: CsvOptions): string {
    const data = this.parse(csv, options);
    data.rows = data.rows.filter(predicate);
    return this.toCsv(data, options);
  }

  map(csv: string, transform: (row: Record<string, string>) => Record<string, string>, options?: CsvOptions): string {
    const data = this.parse(csv, options);
    data.rows = data.rows.map(transform);
    return this.toCsv(data, options);
  }
}

export interface CsvOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  header?: boolean;
  skipEmptyLines?: boolean;
}

export interface CsvData {
  headers: string[];
  rows: Record<string, string>[];
}

export class XmlParserPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/xml-parser',
    name: 'XML Parser',
    version: '1.0.0',
    description: 'Parse XML files',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['xml', 'parser', 'file', 'parse'],
  };

  public capabilities: PluginCapabilities = {};

  parse(xml: string): XmlDocument {
    return new XmlDocument(xml);
  }

  toJson(xml: string): unknown {
    const doc = this.parse(xml);
    return doc.toJson();
  }

  fromJson(json: unknown, options?: XmlOptions): string {
    return this.jsonToXml(json, options);
  }

  private jsonToXml(json: unknown, options?: XmlOptions, depth = 0): string {
    const indent = ' '.repeat(options?.indent || 2);
    const prefix = options?.indent ? '\n' + indent.repeat(depth) : '';
    const suffix = options?.indent ? '' : '';

    if (typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean') {
      return String(json);
    }

    if (Array.isArray(json)) {
      return json.map(item => this.jsonToXml(item, options, depth + 1)).join('');
    }

    if (typeof json === 'object' && json !== null) {
      let result = '';
      for (const [key, value] of Object.entries(json)) {
        result += `${prefix}<${key}>${this.jsonToXml(value, options, depth + 1)}</${key}>`;
      }
      return result;
    }

    return '';
  }

  minify(xml: string): string {
    return xml.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
  }

  prettify(xml: string, indent = 2): string {
    let formatted = '';
    let level = 0;
    const spaces = ' '.repeat(indent);

    for (const token of xml.split(/(<[^>]+>)/g)) {
      if (token.startsWith('</')) {
        level--;
        formatted += spaces.repeat(Math.max(0, level)) + token + '\n';
      } else if (token.startsWith('<') && !token.startsWith('</') && !token.startsWith('<?')) {
        formatted += spaces.repeat(level) + token + '\n';
        level++;
      } else {
        formatted += spaces.repeat(level) + token + '\n';
      }
    }

    return formatted.trim();
  }
}

export class XmlDocument {
  private parser: DOMParser;

  constructor(public xml: string) {
    this.parser = new DOMParser();
  }

  querySelector(selector: string): XmlElement | null {
    return null;
  }

  getElementsByTagName(tag: string): XmlElement[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    const elements: XmlElement[] = [];
    let match;

    while ((match = regex.exec(this.xml)) !== null) {
      elements.push(new XmlElement(match[0], match[1]));
    }

    return elements;
  }

  toJson(): unknown {
    const result: Record<string, unknown> = {};

    const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(this.xml)) !== null) {
      const [, tag, attrs, content] = match;

      if (content.includes('<')) {
        result[tag] = new XmlDocument('<root>' + content + '</root>').toJson();
      } else {
        result[tag] = content.trim();
      }
    }

    return result;
  }
}

export class XmlElement {
  constructor(public outerXml: string, public innerXml: string) {}

  getAttribute(name: string): string | null {
    const match = this.outerXml.match(new RegExp(`${name}="([^"]*)"`));
    return match ? match[1] : null;
  }

  textContent(): string {
    return stripTags(this.innerXml);
  }
}

export interface XmlOptions {
  indent?: number;
  declaration?: boolean;
}

export class UrlPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/url',
    name: 'URL Parser',
    version: '1.0.0',
    description: 'Parse and build URLs',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['url', 'parser', 'query', 'param'],
  };

  public capabilities: PluginCapabilities = {};

  parse(url: string): UrlObject {
    const parsed = new URL(url);
    return {
      href: parsed.href,
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      params: this.parseParams(parsed.search),
      origin: parsed.origin,
    };
  }

  build(url: string | UrlObject, params?: Record<string, string>): string {
    const u = typeof url === 'string' ? this.parse(url) : url;

    const result = u.origin + u.pathname;

    if (params) {
      const query = new URLSearchParams(params).toString();
      return result + (query ? '?' + query : '');
    }

    return result + u.search;
  }

  private parseParams(search: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(search);

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }

  param(url: string, key: string): string | null {
    const params = this.parse(url).params;
    return params[key] || null;
  }

  setParam(url: string, key: string, value: string): string {
    const parsed = this.parse(url);
    parsed.params[key] = value;
    return this.build(parsed, parsed.params);
  }

  removeParam(url: string, key: string): string {
    const parsed = this.parse(url);
    delete parsed.params[key];
    return this.build(parsed, parsed.params);
  }

  isAbsolute(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  isRelative(url: string): boolean {
    return !this.isAbsolute(url);
  }

  resolve(from: string, to: string): string {
    return new URL(to, new URL(from, 'http://example.com')).href;
  }
}

export interface UrlObject {
  href: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string>;
  origin: string;
}

export class QueryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/query',
    name: 'Query Builder',
    version: '1.0.0',
    description: 'Build query strings',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['query', 'search', 'filter', 'param'],
  };

  public capabilities: PluginCapabilities = {};

  create(): QueryBuilder {
    return new QueryBuilder();
  }

  parse(query: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(query);

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }

  build(params: Record<string, string>): string {
    return new URLSearchParams(params).toString();
  }

  encode(value: unknown): string {
    return encodeURIComponent(String(value));
  }

  decode(value: string): string {
    return decodeURIComponent(value);
  }

  encodeObject(obj: Record<string, unknown>): string {
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      params[key] = this.encode(value);
    }

    return this.build(params);
  }

  decodeObject(query: string): Record<string, string> {
    const params = this.parse(query);

    for (const key in params) {
      params[key] = this.decode(params[key]);
    }

    return params;
  }
}

export class QueryBuilder {
  private params: Record<string, string[]> = {};
  private signs: Map<string, string> = new Map();

  append(key: string, value: unknown): this {
    if (!this.params[key]) {
      this.params[key] = [];
    }
    this.params[key].push(String(value));
    return this;
  }

  set(key: string, value: unknown): this {
    this.params[key] = [String(value)];
    return this;
  }

  get(key: string): string | null {
    return this.params[key]?.[0] || null;
  }

  getAll(key: string): string[] {
    return this.params[key] || [];
  }

  has(key: string): boolean {
    return key in this.params;
  }

  remove(key: string): void {
    delete this.params[key];
  }

  sort(comparator?: (a: string, b: string) => number): this {
    const keys = Object.keys(this.params).sort(comparator);
    const sorted: Record<string, string[]> = {};

    for (const key of keys) {
      sorted[key] = this.params[key];
    }

    this.params = sorted;
    return this;
  }

  toString(): string {
    const parts: string[] = [];

    for (const [key, values] of Object.entries(this.params)) {
      for (const value of values) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }

    return parts.join('&');
  }
}