import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const searchCode: RegisteredTool = {
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
      const ctx = Number(args.contextLines) || 2;
      const max = Number(args.maxResults) || 50;
      const cs = String(args.caseSensitive) === 'true';

      let cmd: string;

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

export const GrepTool = async (args: Record<string, unknown>) => {
  const { pattern, path: searchPath, include } = args as Record<string, string>;
  const { execFileSync } = await import('node:child_process');
  try {
    const grepArgs = ['-rn'];
    if (include) grepArgs.push('--include', include);
    if (pattern) grepArgs.push(pattern);
    grepArgs.push(searchPath || '.');
    const out = execFileSync('grep', grepArgs, { encoding: 'utf-8', timeout: 10000 });
    const lines = out.split('\n').slice(0, 50).join('\n');
    return { content: lines || `No matches for: ${pattern}`, toolName: 'Grep' };
  } catch (err: any) {
    if (err.status === 1) {
      return { content: `No matches for: ${pattern}`, toolName: 'Grep' };
    }
    return { content: `Grep error: ${err.message}`, isError: true, toolName: 'Grep' };
  }
};
