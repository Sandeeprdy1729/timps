// ── TIMPS Code Tool System ──
// 12 tools with snapshot integration, risk levels, and safety guards

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import { glob } from 'glob';
import { createPatch } from 'diff';
import type { ToolDefinition, RiskLevel } from './types.js';
import { shellEscape, formatSize } from './utils.js';

export interface ToolExecResult {
  content: string;
  isError: boolean;
  filesModified?: string[];  // for snapshot tracking
}

export interface RegisteredTool {
  definition: ToolDefinition;
  risk: RiskLevel;
  execute: (args: Record<string, unknown>, cwd: string) => Promise<ToolExecResult>;
}

function resolvePath(filePath: string, cwd: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd, filePath);
}

// ══════════════════════════════════════════
// TOOL 1: read_file
// ══════════════════════════════════════════
const readFile: RegisteredTool = {
  definition: {
    name: 'read_file',
    description: 'Read file contents. Use startLine/endLine for large files. Returns numbered lines.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (relative or absolute)' },
        startLine: { type: 'number', description: 'Start line, 1-based (optional)' },
        endLine: { type: 'number', description: 'End line, 1-based (optional)' },
      },
      required: ['path'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const content = fs.readFileSync(fp, 'utf-8');
      const lines = content.split('\n');

      if (args.startLine || args.endLine) {
        const s = Math.max(1, Number(args.startLine) || 1) - 1;
        const e = Math.min(lines.length, Number(args.endLine) || lines.length);
        return { content: lines.slice(s, e).map((l, i) => `${s + i + 1}│ ${l}`).join('\n'), isError: false };
      }

      // Never silently truncate — show full file with a size warning for large files
      if (lines.length > 500) {
        return {
          content: `⚠ Large file (${lines.length} lines). Consider using startLine/endLine for targeted reads.\n\n` +
            lines.map((l, i) => `${i + 1}│ ${l}`).join('\n'),
          isError: false,
        };
      }
      return { content: lines.map((l, i) => `${i + 1}│ ${l}`).join('\n'), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 2: write_file
// ══════════════════════════════════════════
const writeFile: RegisteredTool = {
  definition: {
    name: 'write_file',
    description: 'Create or overwrite a file. Creates parent directories automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['path', 'content'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      const existed = fs.existsSync(fp);
      fs.writeFileSync(fp, String(args.content), 'utf-8');
      const lines = String(args.content).split('\n').length;
      return {
        content: `${existed ? 'Updated' : 'Created'} ${args.path} (${lines} lines)`,
        isError: false,
        filesModified: [fp],
      };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 3: edit_file — surgical string replacement
// ══════════════════════════════════════════
const editFile: RegisteredTool = {
  definition: {
    name: 'edit_file',
    description: 'Replace exact text in a file. oldString must match exactly once. Shows diff. Preferred over write_file for modifications.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        oldString: { type: 'string', description: 'Exact text to find (must be unique)' },
        newString: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const content = fs.readFileSync(fp, 'utf-8');
      const old = String(args.oldString);
      const replacement = String(args.newString);

      const count = content.split(old).length - 1;
      if (count === 0) return { content: `oldString not found in ${args.path}`, isError: true };
      if (count > 1) return { content: `oldString found ${count} times — must be unique`, isError: true };

      const newContent = content.replace(old, replacement);
      fs.writeFileSync(fp, newContent, 'utf-8');

      const diff = createPatch(String(args.path), content, newContent, '', '');
      return { content: diff, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 4: multi_edit — multiple edits in one call
// ══════════════════════════════════════════
const multiEdit: RegisteredTool = {
  definition: {
    name: 'multi_edit',
    description: 'Apply multiple string replacements to a file in one call. More efficient than multiple edit_file calls. Each edit must have unique oldString.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        edits: { type: 'string', description: 'JSON array of {oldString, newString} objects' },
      },
      required: ['path', 'edits'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      let content = fs.readFileSync(fp, 'utf-8');
      const original = content;

      const edits: { oldString: string; newString: string }[] = JSON.parse(String(args.edits));
      const results: string[] = [];

      for (const edit of edits) {
        const count = content.split(edit.oldString).length - 1;
        if (count === 0) { results.push(`✘ not found: "${edit.oldString.slice(0, 40)}..."`); continue; }
        if (count > 1) { results.push(`✘ ${count} matches: "${edit.oldString.slice(0, 40)}..."`); continue; }
        content = content.replace(edit.oldString, edit.newString);
        results.push(`✔ replaced`);
      }

      fs.writeFileSync(fp, content, 'utf-8');
      const diff = createPatch(String(args.path), original, content, '', '');
      return { content: results.join('\n') + '\n\n' + diff, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 5: list_directory
// ══════════════════════════════════════════
const listDirectory: RegisteredTool = {
  definition: {
    name: 'list_directory',
    description: 'List files and directories with sizes. Shows tree structure.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory (default: .)' },
        depth: { type: 'number', description: 'Max depth (default: 2)' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const dp = resolvePath(String(args.path || '.'), cwd);
      const maxDepth = Number(args.depth) || 2;
      return { content: treeList(dp, maxDepth).join('\n') || '(empty)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '__pycache__', '.venv', 'venv', 'target', 'build', '.cache']);

function treeList(dir: string, maxDepth: number, prefix = '', depth = 0): string[] {
  if (depth >= maxDepth) return [];
  const results: string[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));

  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.env' && e.name !== '.gitignore') continue;
    if (IGNORED.has(e.name)) continue;

    if (e.isDirectory()) {
      results.push(`${prefix}${e.name}/`);
      results.push(...treeList(path.join(dir, e.name), maxDepth, prefix + '  ', depth + 1));
    } else {
      try {
        const size = formatSize(fs.statSync(path.join(dir, e.name)).size);
        results.push(`${prefix}${e.name} (${size})`);
      } catch {
        results.push(`${prefix}${e.name}`);
      }
    }
  }
  return results;
}

// ══════════════════════════════════════════
// TOOL 6: bash — shell execution with safety
// ══════════════════════════════════════════
const bash: RegisteredTool = {
  definition: {
    name: 'bash',
    description: 'Execute shell command. Use for tests, builds, npm/pip, system commands. Returns stdout/stderr.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command' },
        timeout: { type: 'number', description: 'Timeout ms (default: 30000)' },
      },
      required: ['command'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    const command = String(args.command);
    const timeout = Number(args.timeout) || 30000;

    // Block destructive commands
    const blocked = ['rm -rf /', 'rm -rf ~', 'mkfs', ':(){', '> /dev/sd', 'dd if=/dev'];
    if (blocked.some(b => command.includes(b))) {
      return { content: 'Blocked: dangerous command', isError: true };
    }

    try {
      const result = childProcess.execSync(command, {
        cwd, timeout, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const output = result.length > 15000
        ? result.slice(0, 7000) + '\n\n... truncated ...\n\n' + result.slice(-5000)
        : result;
      return { content: output || '(no output)', isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string; status?: number };
      const out = [err.stdout?.toString().trim(), err.stderr?.toString().trim()].filter(Boolean).join('\n');
      return { content: `Exit ${err.status || 1}:\n${out || err.message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 7: search_code
// ══════════════════════════════════════════
const searchCode: RegisteredTool = {
  definition: {
    name: 'search_code',
    description: 'Search for text/regex in files. Uses ripgrep (rg) or grep. Returns file:line matches.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern' },
        path: { type: 'string', description: 'Search directory (default: .)' },
        include: { type: 'string', description: 'File glob filter (e.g., "*.ts")' },
      },
      required: ['pattern'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const pattern = String(args.pattern);
      const searchPath = resolvePath(String(args.path || '.'), cwd);
      let cmd: string;
      try {
        childProcess.execSync('which rg', { stdio: 'pipe' });
        const inc = args.include ? `-g "${args.include}"` : '';
        cmd = `rg -in --max-count=50 ${inc} ${shellEscape(pattern)} ${shellEscape(searchPath)}`;
      } catch {
        const inc = args.include ? `--include="${args.include}"` : '';
        cmd = `grep -rin --max-count=50 ${inc} ${shellEscape(pattern)} ${shellEscape(searchPath)}`;
      }

      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 512 * 1024, timeout: 15000 }).trim();
      return { content: result || 'No matches', isError: false };
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 1) return { content: 'No matches', isError: false };
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 8: find_files
// ══════════════════════════════════════════
const findFiles: RegisteredTool = {
  definition: {
    name: 'find_files',
    description: 'Find files by glob pattern. Returns matching paths.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob (e.g., "**/*.ts", "src/**/*.test.js")' },
        path: { type: 'string', description: 'Base directory (default: .)' },
      },
      required: ['pattern'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const base = resolvePath(String(args.path || '.'), cwd);
      const files = await glob(String(args.pattern), {
        cwd: base, ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'], nodir: true,
      });
      if (files.length === 0) return { content: 'No files found', isError: false };
      const display = files.length > 100 ? files.slice(0, 100).join('\n') + `\n... ${files.length - 100} more` : files.join('\n');
      return { content: display, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 9: git_status (read-only)
// ══════════════════════════════════════════
const gitStatus: RegisteredTool = {
  definition: {
    name: 'git_status',
    description: 'Read-only git operations: status, diff, log, branch, blame.',
    inputSchema: {
      type: 'object',
      properties: {
        subcommand: { type: 'string', description: 'Git subcommand', enum: ['status', 'diff', 'diff --staged', 'log --oneline -20', 'branch -a', 'stash list'] },
      },
      required: ['subcommand'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const sub = String(args.subcommand);
      const allowed = ['status', 'diff', 'log', 'branch', 'stash', 'show', 'remote', 'blame'];
      if (!allowed.some(a => sub.startsWith(a))) return { content: 'Only read-only git commands allowed here', isError: true };
      const result = childProcess.execSync(`git --no-pager ${sub}`, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(no output)', isError: false };
    } catch (e) {
      return { content: `Git error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 10: git_commit
// ══════════════════════════════════════════
const gitCommit: RegisteredTool = {
  definition: {
    name: 'git_commit',
    description: 'Stage files and commit with a message.',
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'string', description: 'Files to stage (space-separated, "." for all)' },
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['message'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    try {
      const files = String(args.files || '.');
      childProcess.execSync(`git add ${files}`, { cwd, encoding: 'utf-8', timeout: 10000 });
      const result = childProcess.execSync(`git commit -m ${shellEscape(String(args.message))}`, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 11: patch_file — create/apply unified diff patches
// ══════════════════════════════════════════
const patchFile: RegisteredTool = {
  definition: {
    name: 'patch_file',
    description: 'Insert, delete, or replace lines by line number. More flexible than edit_file for positional changes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        operations: { type: 'string', description: 'JSON array of {type:"insert"|"delete"|"replace", line:number, content?:string}' },
      },
      required: ['path', 'operations'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const lines = fs.readFileSync(fp, 'utf-8').split('\n');
      const original = lines.join('\n');
      const ops: { type: string; line: number; content?: string }[] = JSON.parse(String(args.operations));

      // Apply in reverse order to preserve line numbers
      ops.sort((a, b) => b.line - a.line);
      for (const op of ops) {
        const idx = op.line - 1;
        if (idx < 0 || idx > lines.length) continue;
        switch (op.type) {
          case 'insert': lines.splice(idx, 0, op.content || ''); break;
          case 'delete': lines.splice(idx, 1); break;
          case 'replace': lines[idx] = op.content || ''; break;
        }
      }

      const newContent = lines.join('\n');
      fs.writeFileSync(fp, newContent, 'utf-8');
      const diff = createPatch(String(args.path), original, newContent, '', '');
      return { content: diff, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 12: think — structured reasoning (no external action)
// ══════════════════════════════════════════
const think: RegisteredTool = {
  definition: {
    name: 'think',
    description: 'A scratchpad for complex reasoning. Use this to think through problems, plan multi-step changes, or analyze errors before acting. No side effects.',
    inputSchema: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your reasoning, analysis, or plan' },
      },
      required: ['thought'],
    },
  },
  risk: 'low',
  async execute(args) {
    return { content: `Thought recorded. Proceeding with plan.`, isError: false };
  },
};

// ══════════════════════════════════════════
// TOOL 13: web_search — open-source web search via SearXNG/DuckDuckGo
// ══════════════════════════════════════════
const webSearch: RegisteredTool = {
  definition: {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo or a local SearXNG instance. Returns titles, URLs, and snippets. Use for documentation lookups, error messages, API references.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default: 5)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args) {
    const query = String(args.query);
    const maxResults = Number(args.maxResults) || 5;

    // Try SearXNG first (self-hosted), then DuckDuckGo HTML
    const searxUrl = process.env.SEARXNG_URL;
    if (searxUrl) {
      return await searchSearXNG(searxUrl, query, maxResults);
    }
    return await searchDuckDuckGo(query, maxResults);
  },
};

async function searchSearXNG(baseUrl: string, query: string, max: number): Promise<ToolExecResult> {
  try {
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { content: `SearXNG error: ${res.status}`, isError: true };
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] };
    const results = (data.results || []).slice(0, max);
    if (results.length === 0) return { content: 'No results found.', isError: false };
    const output = results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content?.slice(0, 200) || ''}`
    ).join('\n\n');
    return { content: output, isError: false };
  } catch (e) {
    return { content: `SearXNG error: ${(e as Error).message}`, isError: true };
  }
}

async function searchDuckDuckGo(query: string, max: number): Promise<ToolExecResult> {
  try {
    // Use DuckDuckGo instant answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { content: `DDG error: ${res.status}`, isError: true };

    const data = await res.json() as {
      Abstract?: string; AbstractURL?: string; AbstractSource?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
      Results?: { Text?: string; FirstURL?: string }[];
    };

    const parts: string[] = [];

    // Abstract (main answer)
    if (data.Abstract) {
      parts.push(`${data.AbstractSource}: ${data.Abstract}\n${data.AbstractURL || ''}`);
    }

    // Results
    for (const r of (data.Results || []).slice(0, max)) {
      if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);
    }

    // Related topics
    for (const r of (data.RelatedTopics || []).slice(0, max)) {
      if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);
    }

    if (parts.length === 0) {
      // Fallback: use DuckDuckGo Lite HTML scrape
      return await searchDDGLite(query, max);
    }
    return { content: parts.slice(0, max).join('\n\n'), isError: false };
  } catch (e) {
    return { content: `Search error: ${(e as Error).message}`, isError: true };
  }
}

async function searchDDGLite(query: string, max: number): Promise<ToolExecResult> {
  try {
    const url = `https://lite.duckduckgo.com/lite?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'TIMPS-Code/1.0' },
    });
    if (!res.ok) return { content: `Search error: ${res.status}`, isError: true };
    const html = await res.text();

    // Extract result snippets from DDG Lite HTML
    const results: string[] = [];
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([^<]+)/gi;
    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && links.length < max) {
      links.push({ url: m[1], title: m[2].trim() });
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < max) {
      snippets.push(m[1].trim());
    }

    for (let i = 0; i < Math.min(links.length, max); i++) {
      results.push(`${i + 1}. ${links[i].title}\n   ${links[i].url}\n   ${snippets[i] || ''}`);
    }

    return { content: results.length > 0 ? results.join('\n\n') : `No results found for: ${query}`, isError: false };
  } catch (e) {
    return { content: `Search error: ${(e as Error).message}`, isError: true };
  }
}

// ══════════════════════════════════════════
// TOOL 14: fetch_url — fetch web page content
// ══════════════════════════════════════════
const fetchUrl: RegisteredTool = {
  definition: {
    name: 'fetch_url',
    description: 'Fetch content from a URL. Returns text/HTML with tags stripped. Use for reading documentation, API responses, or page content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        maxLength: { type: 'number', description: 'Max response chars (default: 10000)' },
      },
      required: ['url'],
    },
  },
  risk: 'low',
  async execute(args) {
    const url = String(args.url);
    const maxLen = Number(args.maxLength) || 10000;

    // Basic URL validation
    try { new URL(url); } catch { return { content: 'Invalid URL', isError: true }; }

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'TIMPS-Code/1.0', 'Accept': 'text/html,text/plain,application/json' },
      });
      if (!res.ok) return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      if (contentType.includes('json')) {
        // Pretty-print JSON
        try {
          const json = JSON.parse(text);
          const pretty = JSON.stringify(json, null, 2);
          return { content: pretty.slice(0, maxLen), isError: false };
        } catch {
          return { content: text.slice(0, maxLen), isError: false };
        }
      }

      // Strip HTML tags for readable text
      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      return { content: stripped.slice(0, maxLen), isError: false };
    } catch (e) {
      return { content: `Fetch error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 15: notebook — run code snippets (JS/TS/Python)
// ══════════════════════════════════════════
const notebook: RegisteredTool = {
  definition: {
    name: 'notebook',
    description: 'Execute a code snippet and return the output. Supports JavaScript, TypeScript (via tsx), and Python. Like a REPL/notebook cell.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'Language: js, ts, python', enum: ['js', 'ts', 'python'] },
      },
      required: ['code', 'language'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    const code = String(args.code);
    const lang = String(args.language || 'js');

    try {
      let cmd: string;
      let tmpFile: string;

      switch (lang) {
        case 'python': {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.py`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          cmd = `python3 "${tmpFile}"`;
          break;
        }
        case 'ts': {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.ts`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          // Try tsx, then ts-node, then npx tsx
          try { childProcess.execSync('which tsx', { stdio: 'pipe' }); cmd = `tsx "${tmpFile}"`; }
          catch {
            try { childProcess.execSync('which ts-node', { stdio: 'pipe' }); cmd = `ts-node "${tmpFile}"`; }
            catch { cmd = `npx tsx "${tmpFile}"`; }
          }
          break;
        }
        default: {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.mjs`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          cmd = `node "${tmpFile}"`;
          break;
        }
      }

      const result = childProcess.execSync(cmd, {
        cwd, encoding: 'utf-8', timeout: 30000, maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      // Clean up temp file
      try { fs.unlinkSync(tmpFile!); } catch { /* ignore */ }

      return { content: result || '(no output)', isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      const out = [err.stdout?.toString().trim(), err.stderr?.toString().trim()].filter(Boolean).join('\n');
      return { content: out || err.message, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 16: git_diff — detailed diff with options
// ══════════════════════════════════════════
const gitDiff: RegisteredTool = {
  definition: {
    name: 'git_diff',
    description: 'Show git diff with options. Supports staged, unstaged, between commits/branches.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'What to diff: omit for unstaged, "--staged" for staged, "branch1..branch2", or commit hash' },
        path: { type: 'string', description: 'Limit diff to specific file or directory' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const target = String(args.target || '');
      const fp = args.path ? ` -- ${shellEscape(String(args.path))}` : '';
      const result = childProcess.execSync(
        `git --no-pager diff ${target}${fp}`,
        { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
      ).trim();
      return { content: result || '(no changes)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 17: git_log — rich commit history
// ══════════════════════════════════════════
const gitLog: RegisteredTool = {
  definition: {
    name: 'git_log',
    description: 'Show git commit history. Supports branch, author, path filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits (default: 15)' },
        branch: { type: 'string', description: 'Branch name (default: current)' },
        author: { type: 'string', description: 'Filter by author' },
        path: { type: 'string', description: 'Filter by file path' },
        oneline: { type: 'string', description: 'Use oneline format (default: true)', enum: ['true', 'false'] },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const n = Number(args.count) || 15;
      const parts = ['git', '--no-pager', 'log', `-${n}`];
      if (args.oneline !== 'false') parts.push('--oneline', '--graph', '--decorate');
      if (args.branch) parts.push(String(args.branch));
      if (args.author) parts.push(`--author=${shellEscape(String(args.author))}`);
      if (args.path) parts.push('--', shellEscape(String(args.path)));
      const result = childProcess.execSync(parts.join(' '), {
        cwd, encoding: 'utf-8', timeout: 10000,
      }).trim();
      return { content: result || '(no commits)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// TOOL 18: git_stash — stash management
// ══════════════════════════════════════════
const gitStash: RegisteredTool = {
  definition: {
    name: 'git_stash',
    description: 'Git stash operations: save, pop, list, apply, drop.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Stash action', enum: ['push', 'pop', 'apply', 'list', 'drop', 'show'] },
        message: { type: 'string', description: 'Stash message (for push)' },
        index: { type: 'number', description: 'Stash index (default: 0)' },
      },
      required: ['action'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const action = String(args.action);
      let cmd: string;
      switch (action) {
        case 'push': cmd = `git stash push -m ${shellEscape(String(args.message || 'timps-stash'))}`; break;
        case 'pop': cmd = `git stash pop stash@{${Number(args.index) || 0}}`; break;
        case 'apply': cmd = `git stash apply stash@{${Number(args.index) || 0}}`; break;
        case 'list': cmd = 'git stash list'; break;
        case 'drop': cmd = `git stash drop stash@{${Number(args.index) || 0}}`; break;
        case 'show': cmd = `git --no-pager stash show -p stash@{${Number(args.index) || 0}}`; break;
        default: return { content: `Unknown stash action: ${action}`, isError: true };
      }
      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(done)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// Registry
// ══════════════════════════════════════════

export const ALL_TOOLS: RegisteredTool[] = [
  readFile, writeFile, editFile, multiEdit, listDirectory,
  bash, searchCode, findFiles, gitStatus, gitCommit,
  patchFile, think, webSearch, fetchUrl, notebook,
  gitDiff, gitLog, gitStash,
];

// Essential tools for local/small models — keeps prompt manageable
const LOCAL_ESSENTIAL_TOOLS = [
  'read_file', 'write_file', 'edit_file', 'list_directory',
  'bash', 'search_code', 'find_files',
];

export function getToolDefinitions(localMode = false): ToolDefinition[] {
  if (localMode) {
    return ALL_TOOLS
      .filter(t => LOCAL_ESSENTIAL_TOOLS.includes(t.definition.name))
      .map(t => t.definition);
  }
  return ALL_TOOLS.map(t => t.definition);
}

export function getTool(name: string): RegisteredTool | undefined {
  return ALL_TOOLS.find(t => t.definition.name === name);
}

export function getToolRisk(name: string): RiskLevel {
  return getTool(name)?.risk || 'high';
}
