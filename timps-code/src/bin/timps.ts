#!/usr/bin/env node
// ── TIMPS Code — CLI Entry Point ──

import { Command } from 'commander';
import { startApp } from '../app.js';
import { LOGO, t } from '../theme.js';
import type { ProviderName } from '../types.js';

const program = new Command();

program
  .name('timps')
  .description('TIMPS Code — AI coding agent with persistent memory')
  .version('1.0.0')
  .option('-p, --provider <name>', 'Model provider: claude, openai, gemini, ollama, openrouter')
  .option('-m, --model <model>', 'Model name (e.g., gpt-4o, claude-sonnet-4-20250514)')
  .option('-d, --dir <path>', 'Working directory')
  .option('-c, --config', 'Run setup wizard')
  .option('-b, --branch <name>', 'Branch current memory state into a proven context')
  .option('--merge <target>', 'Merge a branch into the current semantic context')
  .argument('[message...]', 'One-shot message (non-interactive)')
  .action(async (messageParts: string[], opts: Record<string, string>) => {
    if (opts.config) {
      const { runSetupWizard } = await import('../config.js');
      console.log(LOGO);
      await runSetupWizard();
      return;
    }

    const oneLine = messageParts.length > 0 ? messageParts.join(' ') : undefined;

    await startApp({
      provider: opts.provider as ProviderName | undefined,
      model: opts.model,
      cwd: opts.dir || process.cwd(),
      oneLine,
      branch: opts.branch,
      merge: opts.merge,
    });
  });

program.parse();
