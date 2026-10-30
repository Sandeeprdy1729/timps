import * as path from 'node:path';
import type { ToolDefinition, RiskLevel } from '../../config/types.js';

export interface ToolExecResult {
  content: string;
  isError: boolean;
  filesModified?: string[];
}

export interface RegisteredTool {
  definition: ToolDefinition;
  risk: RiskLevel;
  execute: (args: Record<string, unknown>, cwd: string) => Promise<ToolExecResult>;
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface ToolResult {
  content: string;
  isError?: boolean;
  toolName?: string;
  durationMs?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  startTime: number;
}

export function resolvePath(filePath: string, cwd: string): string {
  const cwdAbs = path.resolve(cwd);
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(cwdAbs, filePath);
  if (!resolved.startsWith(cwdAbs + path.sep) && resolved !== cwdAbs) {
    throw new Error(`Path traversal denied: ${filePath} is outside working directory`);
  }
  return resolved;
}

const PRIVATE_HOSTS = ['169.254.169.254', '127.0.0.1', '0.0.0.0', 'localhost', 'metadata.google.internal', '100.100.100.200'];
const PRIVATE_RANGES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];

export function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (PRIVATE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) return true;
    if (PRIVATE_RANGES.some(range => hostname.startsWith(range))) return true;
    return false;
  } catch {
    return true;
  }
}

// ── HTML → readable text ───────────────────────────────────────────────────
// Shared by the fetch tools. Written as one left-to-right scan rather than a
// pile of regexes: chained `/<[^>]+>/` stripping was easy to defeat with
// malformed or nested markup, and decoding entities in sequence turned
// `&amp;lt;` into a real `<`.

/** Elements whose contents never belong in extracted text. */
const DROPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'svg']);

/** The named entities worth decoding. Anything else is left verbatim. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
};

/** Decode entities in a single pass, so nothing is decoded twice. */
function decodeEntities(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const amp = input.indexOf('&', i);
    if (amp === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, amp);
    const semi = input.indexOf(';', amp + 1);
    const entity = semi === -1 || semi - amp > 12 ? '' : input.slice(amp + 1, semi);
    if (entity === '') {
      out += '&';
      i = amp + 1;
      continue;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    if (named !== undefined) {
      out += named;
      i = semi + 1;
      continue;
    }
    if (entity.startsWith('#')) {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        out += String.fromCodePoint(code);
        i = semi + 1;
        continue;
      }
    }
    out += '&';
    i = amp + 1;
  }
  return out;
}

/**
 * Flatten an HTML document into plain text.
 * Script/style blocks are dropped, tags become single spaces, entities are
 * decoded once, and runs of whitespace collapse.
 */
export function htmlToText(html: string): string {
  const lower = html.toLowerCase();
  const chunks: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      chunks.push(html.slice(i));
      break;
    }
    if (lt > i) chunks.push(html.slice(i, lt));

    const gt = html.indexOf('>', lt + 1);
    if (gt === -1) {
      // A '<' with no closing bracket is literal text, not a tag.
      chunks.push(html.slice(lt));
      break;
    }

    const raw = lower.slice(lt + 1, gt).trim();
    const isClosing = raw.startsWith('/');
    const name = /^\/?\s*([a-z][a-z0-9]*)/.exec(raw)?.[1] ?? '';

    if (name && !isClosing && DROPPED_ELEMENTS.has(name)) {
      const closeAt = lower.indexOf(`</${name}`, gt + 1);
      if (closeAt === -1) break; // unclosed block: nothing after it is text
      const closeGt = html.indexOf('>', closeAt);
      if (closeGt === -1) break;
      i = closeGt + 1;
      chunks.push(' ');
      continue;
    }

    chunks.push(' ');
    i = gt + 1;
  }

  return decodeEntities(chunks.join('')).replace(/\s+/g, ' ').trim();
}
