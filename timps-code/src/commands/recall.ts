// ── TIMPS recall — pull memory context from any terminal. This is the
// "context anywhere" surface: agents write to the same store while you work,
// and `timps recall` / `timps context` let you read it back outside an agent.

import { Command } from 'commander';
import { Memory } from '../memory/memory.js';
import { t } from '../config/theme.js';

interface RecallOptions {
  limit?: string;
  project?: string;
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
  try {
    const mem = new Memory(dir);
    const results = await mem.searchFacts(query, limit);

    console.log(`\n${t.brandBold('TIMPS Recall')}${t.dim(' — ')}${t.accent(query)}${t.dim(` (${dir})`)}\n`);
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

export async function runContext(opts: RecallOptions = {}): Promise<number> {
  const dir = opts.project || process.cwd();
  try {
    const mem = new Memory(dir);
    const ctx = await mem.getContextString('');

    console.log(`\n${t.brandBold('TIMPS Context')}${t.dim(' for ')}${t.accent(dir)}\n`);
    console.log(ctx ? `${ctx}\n` : `  ${t.dim('No context yet — agents store memories here as you work.')}\n`);
    return 0;
  } catch (e) {
    console.error(`\n  ${t.error('Context failed:')} ${(e as Error).message}\n`);
    return 1;
  }
}
