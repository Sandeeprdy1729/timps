// ── TIMPS Code — Complete Tool System (25 tools) ──

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import { glob } from 'glob';
import { createPatch } from 'diff';
import type { ToolDefinition, RiskLevel } from '../config/types.js';
import { shellEscape, formatSize } from '../utils/utils.js';

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

function resolvePath(filePath: string, cwd: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd, filePath);
}

// ══════════════════════════════════════════
// 1. read_file
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

      const numbered = lines.map((l, i) => `${i + 1}│ ${l}`).join('\n');
      if (lines.length > 500) {
        return { content: `⚠ Large file (${lines.length} lines). Use startLine/endLine for targeted reads.\n\n${numbered}`, isError: false };
      }
      return { content: numbered, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 2. write_file
// ══════════════════════════════════════════
const writeFile: RegisteredTool = {
  definition: {
    name: 'write_file',
    description: 'Create or overwrite a file. Creates parent directories automatically. Prefer edit_file for modifications.',
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
      return { content: `${existed ? 'Updated' : 'Created'} ${args.path} (${lines} lines)`, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 3. edit_file — surgical string replacement
// ══════════════════════════════════════════
const editFile: RegisteredTool = {
  definition: {
    name: 'edit_file',
    description: 'Replace exact text in a file. oldString must be unique and match exactly. Shows a diff on success. Preferred over write_file for modifications.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        oldString: { type: 'string', description: 'Exact text to find (must appear exactly once)' },
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
      if (count === 0) return { content: `oldString not found in ${args.path}.\n\nHint: read the file first to verify the exact text.`, isError: true };
      if (count > 1) return { content: `oldString found ${count} times — must be unique. Add more context to make it unique.`, isError: true };

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
// 4. multi_edit
// ══════════════════════════════════════════
const multiEdit: RegisteredTool = {
  definition: {
    name: 'multi_edit',
    description: 'Apply multiple string replacements to a file in one call. More efficient than multiple edit_file calls.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        edits: { type: 'string', description: 'JSON array of [{oldString, newString}] objects' },
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
        if (count === 0) { results.push(`✘ not found: "${edit.oldString.slice(0, 50)}"`); continue; }
        if (count > 1) { results.push(`✘ ${count} matches (not unique): "${edit.oldString.slice(0, 50)}"`); continue; }
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
// 5. list_directory
// ══════════════════════════════════════════
const listDirectory: RegisteredTool = {
  definition: {
    name: 'list_directory',
    description: 'List files and directories with sizes. Shows tree structure. Use depth to control recursion.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: current)' },
        depth: { type: 'number', description: 'Recursion depth (default: 2)' },
        showHidden: { type: 'string', description: 'Show hidden files (default: false)', enum: ['true', 'false'] },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const dp = resolvePath(String(args.path || '.'), cwd);
      const maxDepth = Number(args.depth) || 2;
      const showHidden = String(args.showHidden) === 'true';

      const lines: string[] = [dp];

      function walk(dir: string, prefix: string, depth: number) {
        if (depth > maxDepth) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        const filtered = entries.filter(e => showHidden || !e.name.startsWith('.'));
        const ignoreDirs = new Set(['node_modules', '.git', 'dist', '__pycache__', '.venv', 'build', 'target']);
        const visible = filtered.filter(e => !(e.isDirectory() && ignoreDirs.has(e.name)));

        visible.forEach((entry, i) => {
          const isLast = i === visible.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = isLast ? '    ' : '│   ';

          let label = entry.name;
          if (entry.isFile()) {
            try {
              const size = fs.statSync(path.join(dir, entry.name)).size;
              label += ` ${formatSize(size)}`;
            } catch { /* ignore */ }
          } else if (entry.isDirectory()) {
            label += '/';
          }
          lines.push(prefix + connector + label);
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
          }
        });
      }

      walk(dp, '', 0);
      return { content: lines.join('\n'), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 6. bash — shell execution
// ══════════════════════════════════════════
const bash: RegisteredTool = {
  definition: {
    name: 'bash',
    description: 'Execute a shell command. Returns stdout and stderr. Use for running tests, builds, installs, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
        cwd: { type: 'string', description: 'Working directory (default: project root)' },
      },
      required: ['command'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    try {
      const timeout = (Number(args.timeout) || 30) * 1000;
      const workDir = args.cwd ? resolvePath(String(args.cwd), cwd) : cwd;

      const result = childProcess.execSync(String(args.command), {
        cwd: workDir,
        encoding: 'utf-8',
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/bash',
        env: { ...process.env },
      });
      return { content: result.trim() || '(no output)', isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string | Buffer; stdout?: string | Buffer; message: string };
      const out = [
        err.stdout?.toString().trim(),
        err.stderr?.toString().trim(),
      ].filter(Boolean).join('\n');
      return { content: out || err.message, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 7. search_code — grep/ripgrep
// ══════════════════════════════════════════
const searchCode: RegisteredTool = {
  definition: {
    name: 'search_code',
    description: 'Search for patterns across files using ripgrep (fast) or grep. Returns matching lines with context.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex or literal pattern to search for' },
        path: { type: 'string', description: 'Directory or file to search (default: project root)' },
        filePattern: { type: 'string', description: 'File glob pattern (e.g., "*.ts", "*.py")' },
        caseSensitive: { type: 'string', description: 'Case sensitive search (default: false)', enum: ['true', 'false'] },
        contextLines: { type: 'number', description: 'Lines of context around matches (default: 2)' },
        maxResults: { type: 'number', description: 'Max results (default: 50)' },
      },
      required: ['pattern'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const p = String(args.pattern);
      const searchPath = args.path ? resolvePath(String(args.path), cwd) : cwd;
      const ctx = Number(args.contextLines) ?? 2;
      const max = Number(args.maxResults) || 50;
      const cs = String(args.caseSensitive) === 'true';

      let cmd: string;

      // Prefer ripgrep
      try {
        childProcess.execSync('which rg', { stdio: 'pipe' });
        const flags = ['-n', `--context=${ctx}`, `--max-count=${max}`];
        if (!cs) flags.push('-i');
        if (args.filePattern) flags.push(`--glob=${shellEscape(String(args.filePattern))}`);
        flags.push('--no-heading', '--color=never');
        cmd = `rg ${flags.join(' ')} ${shellEscape(p)} ${shellEscape(searchPath)}`;
      } catch {
        const flags = ['-rn', `--include=${args.filePattern || '*'}`, `-${ctx}A`, `-${ctx}B`];
        if (!cs) flags.push('-i');
        cmd = `grep ${flags.join(' ')} ${shellEscape(p)} ${shellEscape(searchPath)} | head -${max * 5}`;
      }

      const result = childProcess.execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
      }).trim();
      return { content: result || `No matches for: ${p}`, isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      if (err.stdout?.trim()) return { content: err.stdout.trim(), isError: false };
      return { content: `No matches or error: ${err.message}`, isError: false };
    }
  },
};

// ══════════════════════════════════════════
// 8. find_files
// ══════════════════════════════════════════
const findFiles: RegisteredTool = {
  definition: {
    name: 'find_files',
    description: 'Find files matching a glob pattern. Fast file discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.*")' },
        cwd: { type: 'string', description: 'Base directory (default: project root)' },
        maxResults: { type: 'number', description: 'Max results (default: 100)' },
      },
      required: ['pattern'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const base = args.cwd ? resolvePath(String(args.cwd), cwd) : cwd;
      const max = Number(args.maxResults) || 100;

      const files = await glob(String(args.pattern), {
        cwd: base,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__pycache__/**', '**/.venv/**'],
        maxDepth: 10,
      });

      const sorted = files.sort().slice(0, max);
      if (sorted.length === 0) return { content: `No files matching: ${args.pattern}`, isError: false };
      return { content: sorted.join('\n') + (files.length > max ? `\n... (${files.length - max} more)` : ''), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 9. git_status
// ══════════════════════════════════════════
const gitStatus: RegisteredTool = {
  definition: {
    name: 'git_status',
    description: 'Show git repository status: branch, changes, staging area.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const status = childProcess.execSync('git status', { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      const branch = childProcess.execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      return { content: `Branch: ${branch}\n\n${status}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 10. git_commit
// ══════════════════════════════════════════
const gitCommit: RegisteredTool = {
  definition: {
    name: 'git_commit',
    description: 'Stage all changes and commit with a message.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        stageAll: { type: 'string', description: 'Stage all changes (default: true)', enum: ['true', 'false'] },
      },
      required: ['message'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      if (String(args.stageAll) !== 'false') {
        childProcess.execSync('git add -A', { cwd, encoding: 'utf-8', timeout: 10000 });
      }
      const result = childProcess.execSync(
        `git commit -m ${shellEscape(String(args.message))}`,
        { cwd, encoding: 'utf-8', timeout: 15000 }
      ).trim();
      return { content: result, isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      return { content: err.stderr?.toString() || err.message, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 11. git_diff
// ══════════════════════════════════════════
const gitDiff: RegisteredTool = {
  definition: {
    name: 'git_diff',
    description: 'Show git diff. Options: staged, unstaged, between commits/branches.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Omit for unstaged, "--staged" for staged, or "branch1..branch2"' },
        path: { type: 'string', description: 'Limit to specific file/directory' },
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
        { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
      ).trim();
      return { content: result || '(no changes)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 12. git_log
// ══════════════════════════════════════════
const gitLog: RegisteredTool = {
  definition: {
    name: 'git_log',
    description: 'Show git commit history with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits (default: 15)' },
        branch: { type: 'string', description: 'Branch name' },
        author: { type: 'string', description: 'Filter by author' },
        path: { type: 'string', description: 'Filter by file path' },
        oneline: { type: 'string', description: 'Oneline format (default: true)', enum: ['true', 'false'] },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const n = Number(args.count) || 15;
      const parts = ['git', '--no-pager', 'log', `-${n}`];
      if (String(args.oneline) !== 'false') parts.push('--oneline', '--graph', '--decorate');
      if (args.branch) parts.push(String(args.branch));
      if (args.author) parts.push(`--author=${shellEscape(String(args.author))}`);
      if (args.path) parts.push('--', shellEscape(String(args.path)));
      const result = childProcess.execSync(parts.join(' '), { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(no commits)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 13. git_stash
// ══════════════════════════════════════════
const gitStash: RegisteredTool = {
  definition: {
    name: 'git_stash',
    description: 'Git stash operations: push, pop, list, apply, drop, show.',
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
      const idx = Number(args.index) || 0;
      let cmd: string;
      switch (action) {
        case 'push':  cmd = `git stash push -m ${shellEscape(String(args.message || 'timps-stash'))}`; break;
        case 'pop':   cmd = `git stash pop stash@{${idx}}`; break;
        case 'apply': cmd = `git stash apply stash@{${idx}}`; break;
        case 'list':  cmd = 'git stash list'; break;
        case 'drop':  cmd = `git stash drop stash@{${idx}}`; break;
        case 'show':  cmd = `git --no-pager stash show -p stash@{${idx}}`; break;
        default: return { content: `Unknown action: ${action}`, isError: true };
      }
      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(done)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 14. patch_file — apply a unified diff patch
// ══════════════════════════════════════════
const patchFile: RegisteredTool = {
  definition: {
    name: 'patch_file',
    description: 'Apply a unified diff patch to a file. Useful for applying AI-generated patches.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File to patch' },
        patch: { type: 'string', description: 'Unified diff patch content' },
      },
      required: ['path', 'patch'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const patchFile = path.join(os.tmpdir(), `timps_patch_${Date.now()}.patch`);
      fs.writeFileSync(patchFile, String(args.patch), 'utf-8');

      const result = childProcess.execSync(
        `patch ${shellEscape(fp)} < ${shellEscape(patchFile)}`,
        { cwd, encoding: 'utf-8', timeout: 10000 }
      ).trim();
      fs.unlinkSync(patchFile);
      return { content: result || 'Patch applied successfully', isError: false, filesModified: [fp] };
    } catch (e: unknown) {
      const err = e as { stderr?: string; message: string };
      return { content: err.stderr?.toString() || err.message, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 15. think — structured reasoning scratchpad
// ══════════════════════════════════════════
const think: RegisteredTool = {
  definition: {
    name: 'think',
    description: 'Structured reasoning scratchpad. Use to plan complex changes, analyze errors, or reason through a problem before taking action. No side effects.',
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
    return { content: `Thought noted. Proceeding.`, isError: false };
  },
};

// ══════════════════════════════════════════
// 16. web_search — DuckDuckGo / SearXNG
// ══════════════════════════════════════════
const webSearch: RegisteredTool = {
  definition: {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo (or SearXNG if SEARXNG_URL env is set). Returns titles, URLs, and snippets.',
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
    const max = Number(args.maxResults) || 5;

    if (process.env.SEARXNG_URL) {
      return await searchSearXNG(process.env.SEARXNG_URL, query, max);
    }
    return await searchDuckDuckGo(query, max);
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
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { content: `Search error: ${res.status}`, isError: true };
    const data = await res.json() as {
      Abstract?: string; AbstractURL?: string; AbstractSource?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
      Results?: { Text?: string; FirstURL?: string }[];
    };

    const parts: string[] = [];
    if (data.Abstract) parts.push(`${data.AbstractSource}: ${data.Abstract}\n${data.AbstractURL || ''}`);
    for (const r of (data.Results || []).slice(0, max)) if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);
    for (const r of (data.RelatedTopics || []).slice(0, max)) if (r.Text) parts.push(`${r.Text}\n${r.FirstURL || ''}`);

    if (parts.length === 0) return await searchDDGLite(query, max);
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
      headers: { 'User-Agent': 'TIMPS-Code/2.0' },
    });
    if (!res.ok) return { content: `Search error: ${res.status}`, isError: true };
    const html = await res.text();

    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([^<]+)/gi;
    const links: { url: string; title: string }[] = [];
    const snippets: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null && links.length < max) {
      links.push({ url: m[1], title: m[2].trim() });
    }
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < max) {
      snippets.push(m[1].trim());
    }

    const results = links.slice(0, max).map((link, i) =>
      `${i + 1}. ${link.title}\n   ${link.url}\n   ${snippets[i] || ''}`
    );
    return { content: results.length > 0 ? results.join('\n\n') : `No results for: ${query}`, isError: false };
  } catch (e) {
    return { content: `Search error: ${(e as Error).message}`, isError: true };
  }
}

// ══════════════════════════════════════════
// 17. fetch_url
// ══════════════════════════════════════════
const fetchUrl: RegisteredTool = {
  definition: {
    name: 'fetch_url',
    description: 'Fetch and return readable content from a URL. HTML tags are stripped for clean text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        maxLength: { type: 'number', description: 'Max response chars (default: 8000)' },
      },
      required: ['url'],
    },
  },
  risk: 'low',
  async execute(args) {
    const url = String(args.url);
    const maxLen = Number(args.maxLength) || 8000;
    try { new URL(url); } catch { return { content: 'Invalid URL', isError: true }; }

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'TIMPS-Code/2.0', 'Accept': 'text/html,text/plain,application/json' },
      });
      if (!res.ok) return { content: `HTTP ${res.status}: ${res.statusText}`, isError: true };

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      if (contentType.includes('json')) {
        try {
          return { content: JSON.stringify(JSON.parse(text), null, 2).slice(0, maxLen), isError: false };
        } catch { return { content: text.slice(0, maxLen), isError: false }; }
      }

      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

      return { content: stripped.slice(0, maxLen), isError: false };
    } catch (e) {
      return { content: `Fetch error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 18. notebook — run code snippets
// ══════════════════════════════════════════
const notebook: RegisteredTool = {
  definition: {
    name: 'notebook',
    description: 'Execute a code snippet and return the output. Supports JavaScript, TypeScript (tsx), and Python.',
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
          try { childProcess.execSync('which tsx', { stdio: 'pipe' }); cmd = `tsx "${tmpFile}"`; }
          catch { cmd = `npx tsx "${tmpFile}"`; }
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
        cwd, encoding: 'utf-8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

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
// 19. run_diagnostics — linting/type checks
// ══════════════════════════════════════════
const runDiagnostics: RegisteredTool = {
  definition: {
    name: 'run_diagnostics',
    description: 'Run project diagnostics: TypeScript type checking, ESLint, or Pyright. Auto-detects project type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Tool to use: ts, eslint, pyright (default: auto-detect)' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      let cmd: string;
      if (args.type === 'ts') cmd = 'npx tsc --noEmit';
      else if (args.type === 'eslint') cmd = 'npx eslint .';
      else if (args.type === 'pyright') cmd = 'npx pyright';
      else {
        if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) cmd = 'npx tsc --noEmit 2>&1';
        else if (fs.existsSync(path.join(cwd, '.eslintrc.json')) || fs.existsSync(path.join(cwd, 'eslint.config.js'))) cmd = 'npx eslint . 2>&1';
        else if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) cmd = 'python3 -m py_compile *.py 2>&1';
        else cmd = 'echo "No supported diagnostic config detected"';
      }

      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 });
      return { content: `Diagnostics passed:\n${result.trim().slice(0, 500)}`, isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      const out = [err.stdout?.toString().trim(), err.stderr?.toString().trim()].filter(Boolean).join('\n');
      return { content: `Diagnostics output:\n${(out || err.message).slice(0, 3000)}`, isError: false };
    }
  },
};

// ══════════════════════════════════════════
// 20. ask_user — pause and prompt
// ══════════════════════════════════════════
const askUser: RegisteredTool = {
  definition: {
    name: 'ask_user',
    description: 'Pause and ask the user a clarifying question. Use when you cannot safely proceed without input.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
      },
      required: ['question'],
    },
  },
  risk: 'low',
  async execute(args) {
    // Intercepted by agent loop — this is a fallback
    return { content: `[[ASK_USER]] ${args.question}`, isError: false };
  },
};

// ══════════════════════════════════════════
// 21. project_info — analyze project structure
// ══════════════════════════════════════════
const projectInfo: RegisteredTool = {
  definition: {
    name: 'project_info',
    description: 'Analyze the project: detect language, framework, dependencies, entry points, and test setup.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    const info: Record<string, string | string[]> = {};

    // Language/framework detection
    const checks: [string, string, string][] = [
      ['package.json', 'language', 'JavaScript/TypeScript'],
      ['Cargo.toml', 'language', 'Rust'],
      ['go.mod', 'language', 'Go'],
      ['requirements.txt', 'language', 'Python'],
      ['pyproject.toml', 'language', 'Python'],
      ['pom.xml', 'language', 'Java'],
      ['build.gradle', 'language', 'Kotlin/Java'],
      ['composer.json', 'language', 'PHP'],
      ['Gemfile', 'language', 'Ruby'],
    ];

    for (const [file, key, val] of checks) {
      if (fs.existsSync(path.join(cwd, file))) {
        info[key] = val;
        if (file === 'package.json') {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(cwd, file), 'utf-8'));
            info['name'] = pkg.name || '';
            info['version'] = pkg.version || '';
            const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
            const frameworks = deps.filter(d => ['react', 'vue', 'angular', 'next', 'nuxt', 'svelte', 'express', 'fastify', 'nest'].some(f => d.includes(f)));
            if (frameworks.length) info['frameworks'] = frameworks.slice(0, 5);
            const testDeps = deps.filter(d => ['jest', 'vitest', 'mocha', 'jasmine', 'cypress', 'playwright'].some(t => d.includes(t)));
            if (testDeps.length) info['testing'] = testDeps;
            if (pkg.scripts) info['scripts'] = Object.keys(pkg.scripts).slice(0, 10);
            if (pkg.main) info['entry'] = pkg.main;
          } catch { /* ignore */ }
        }
        break;
      }
    }

    const tsconfig = path.join(cwd, 'tsconfig.json');
    if (fs.existsSync(tsconfig)) info['typescript'] = 'yes';

    // Git info
    try {
      const branch = childProcess.execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const remotes = childProcess.execSync('git remote -v', { cwd, encoding: 'utf-8', timeout: 5000 }).trim().split('\n')[0] || '';
      info['git_branch'] = branch;
      info['git_remote'] = remotes.split('\t')[1]?.split(' ')[0] || '';
    } catch { /* not a git repo */ }

    return {
      content: Object.entries(info).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
      ).join('\n'),
      isError: false,
    };
  },
};

// ══════════════════════════════════════════
// 22. todo_write — manage task list
// ══════════════════════════════════════════
const todoWrite: RegisteredTool = {
  definition: {
    name: 'todo_write',
    description: 'Create or update a TODO task list for the current session. Use to track planned steps and mark completion.',
    inputSchema: {
      type: 'object',
      properties: {
        todos: { type: 'string', description: 'JSON array of {id, title, status, priority} objects' },
      },
      required: ['todos'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const todos = JSON.parse(String(args.todos));
      const todoFile = path.join(os.homedir(), '.timps', 'todos.json');
      fs.writeFileSync(todoFile, JSON.stringify(todos, null, 2), 'utf-8');
      const summary = todos.map((t: any) => {
        const s = t.status === 'completed' ? '✔' : t.status === 'in_progress' ? '◐' : '○';
        return `${s} ${t.title}`;
      }).join('\n');
      return { content: `TODOs updated:\n${summary}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 23. todo_read — read task list
// ══════════════════════════════════════════
const todoRead: RegisteredTool = {
  definition: {
    name: 'todo_read',
    description: 'Read the current TODO task list.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute() {
    try {
      const todoFile = path.join(os.homedir(), '.timps', 'todos.json');
      if (!fs.existsSync(todoFile)) return { content: '(no todos)', isError: false };
      const todos = JSON.parse(fs.readFileSync(todoFile, 'utf-8'));
      const summary = todos.map((t: any) => {
        const s = t.status === 'completed' ? '✔' : t.status === 'in_progress' ? '◐' : '○';
        const p = t.priority === 'urgent' ? '!' : t.priority === 'high' ? '↑' : ' ';
        return `${s} ${p} [${t.id}] ${t.title}`;
      }).join('\n');
      return { content: summary || '(empty)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 24. memory_store — save a semantic fact
// ══════════════════════════════════════════
const memoryStore: RegisteredTool = {
  definition: {
    name: 'memory_store',
    description: 'Store an important fact, pattern, or decision to semantic memory for future sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact, pattern, or decision to remember' },
        type: { type: 'string', description: 'Type: fact, pattern, convention, error, decision', enum: ['fact', 'pattern', 'convention', 'error', 'decision'] },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['content'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../memory/memory.js');
      const mem = new Memory(cwd);
      const tags = String(args.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      mem.storeFact(String(args.content), (args.type as any) || 'fact', tags);
      return { content: `Stored to memory: ${String(args.content).slice(0, 80)}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

// ══════════════════════════════════════════
// 25. memory_search — query semantic memory
// ══════════════════════════════════════════
const memorySearch: RegisteredTool = {
  definition: {
    name: 'memory_search',
    description: 'Search semantic memory for facts, patterns, and conventions from past sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 5)' },
      },
      required: ['query'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const { Memory } = await import('../memory/memory.js');
      const mem = new Memory(cwd);
      const results = mem.searchFacts(String(args.query), Number(args.limit) || 5);
      if (results.length === 0) return { content: 'No relevant memories found.', isError: false };
      return {
        content: results.map(r => `[${r.type}] ${r.content}`).join('\n\n'),
        isError: false,
      };
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
  gitDiff, gitLog, gitStash, patchFile, think,
  webSearch, fetchUrl, notebook, runDiagnostics, askUser,
  projectInfo, todoWrite, todoRead, memoryStore, memorySearch,
];

const LOCAL_TOOLS = ['read_file', 'write_file', 'edit_file', 'list_directory', 'bash', 'search_code', 'find_files'];

export function getToolDefinitions(localMode = false): ToolDefinition[] {
  if (localMode) {
    return ALL_TOOLS.filter(t => LOCAL_TOOLS.includes(t.definition.name)).map(t => t.definition);
  }
  return ALL_TOOLS.map(t => t.definition);
}

export function getTool(name: string): RegisteredTool | undefined {
  return ALL_TOOLS.find(t => t.definition.name === name);
}

export function getToolRisk(name: string): RiskLevel {
  return getTool(name)?.risk || 'high';
}
