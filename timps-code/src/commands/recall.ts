// ── TIMPS recall — pull memory context from any terminal. This is the
// "context anywhere" surface: agents write to the same store while you work,
// and `timps recall` / `timps context` let you read it back outside an agent.

import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { Memory } from '../memory/memory.js';
import type { MemoryEntry } from '../memory/types.js';
import { t } from '../config/theme.js';

interface RecallOptions {
  limit?: string;
  project?: string;
}

// The global store is the home-directory memory store. Shared docs and
// user-level facts are expected to land here (see AUTO-CAPTURE instructions),
// so recalling from any project still surfaces them.
function globalStoreMemory(): Memory {
  return new Memory(path.join(os.homedir()));
}

export function addRecallCommand(program: Command): void {
  program
    .command('recall <query>')
    .description('Search TIMPS memory from the current project (or any directory)')
    .option('-l, --limit <n>', 'Max results', '5')
    .option('--project <path>', 'Project directory (default: current)')
    .action(async (query: string, opts: RecallOptions) => {
      process.exit(await runRecall(query, opts));
    });

  program
    .command('context')
    .description('Print the full TIMPS memory context string for a project')
    .option('--project <path>', 'Project directory (default: current)')
    .action(async (opts: RecallOptions) => {
      process.exit(await runContext(opts));
    });
}

export async function runRecall(query: string, opts: RecallOptions = {}): Promise<number> {
  const dir = opts.project || process.cwd();
  const limit = Math.max(1, Math.min(50, parseInt(opts.limit || '5', 10) || 5));
  const explicitProject = !!opts.project;
  try {
    const mem = new Memory(dir);
    let results = await mem.searchFacts(query, limit);

    // When no explicit project was given, also search the global (home) store
    // so shared docs saved outside the current repo still surface.
    if (!explicitProject) {
      const globalMem = globalStoreMemory();
      const globalResults = await globalMem.searchFacts(query, limit);
      results = mergeByContent(results, globalResults);
      results = results.slice(0, limit);
    }

    console.log(
      `\n${t.brandBold('TIMPS Recall')}${t.dim(' — ')}${t.accent(query)}${t.dim(` (${dir}${explicitProject ? '' : ' + global'})`)}\n`
    );
    if (results.length === 0) {
      console.log(`  ${t.dim('No memories found.')}`);
      console.log(`  ${t.dim('Hint:')} agents store memories via timps_store_memory while you work.`);
      console.log();
      return 0;
    }

    for (const r of results) {
      const score = typeof (r as { score?: number }).score === 'number'
        ? ((r as { score?: number }).score as number).toFixed(2)
        : '—';
      const type = String(r.type || 'memory');
      const when = r.timestamp
        ? new Date(r.timestamp).toISOString().replace('T', ' ').slice(0, 16)
        : '';
      console.log(`  ${t.accent(score.padStart(5))}  [${type}] ${r.content}`);
      const meta = [r.tags && r.tags.length ? `tags: ${r.tags.join(', ')}` : '', when].filter(Boolean).join(' · ');
      if (meta) console.log(`         ${t.dim(meta)}`);
    }
    console.log();
    return 0;
  } catch (e) {
    console.error(`\n  ${t.error('Recall failed:')} ${(e as Error).message}\n`);
    return 1;
  }
}

// Merge two result lists, dropping exact-content duplicates (favoring the higher score).
function mergeByContent(primary: MemoryEntry[], extra: MemoryEntry[]): MemoryEntry[] {
  const seen = new Set(primary.map((r) => r.content));
  const merged = [...primary];
  for (const r of extra) {
    if (seen.has(r.content)) continue;
    seen.add(r.content);
    merged.push(r);
  }
  return merged;
}

export async function runContext(opts: RecallOptions = {}): Promise<number> {
  const dir = opts.project || process.cwd();
  const explicitProject = !!opts.project;
  try {
    const mem = new Memory(dir);
    const ctx = await mem.getContextString('');

    let globalPrefix = '';
    let full = ctx;
    if (!explicitProject) {
      const globalMem = globalStoreMemory();
      const globalCtx = await globalMem.getContextString('');
      if (globalCtx) {
        globalPrefix = `── global store (~)\n`;
        full = [ctx, globalPrefix + globalCtx].filter(Boolean).join('\n');
      }
    }

    console.log(`\n${t.brandBold('TIMPS Context')}${t.dim(' for ')}${t.accent(dir)}${explicitProject ? '' : t.dim(' + global')}\n`);
    console.log(full ? `${full}\n` : `  ${t.dim('No context yet — agents store memories here as you work.')}\n`);
    return 0;
  } catch (e) {
    console.error(`\n  ${t.error('Context failed:')} ${(e as Error).message}\n`);
    return 1;
  }
}
