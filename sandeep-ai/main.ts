#!/usr/bin/env node
import { startServer } from './api/server';
import { runCLI, printHelp } from './interfaces/cli';
import { initDatabase } from './db/postgres';

function parseArgs(): { mode: 'server' | 'cli' | 'start'; options: any } {
  const args = process.argv.slice(2);
  const first = args[0];

  // npx timps start  OR  npx timps (no args) → start server with setup wizard
  if (!first || first === 'start') {
    return { mode: 'start', options: {} };
  }

  if (first === 'server') {
    return { mode: 'server', options: {} };
  }

  if (first === 'cli') {
    const options: any = { interactive: true, memoryMode: 'persistent' };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--user-id' && args[i + 1]) { options.userId = parseInt(args[i + 1], 10); i++; }
      else if (arg === '--username' && args[i + 1]) { options.username = args[i + 1]; i++; }
      else if (arg === '--system-prompt' && args[i + 1]) { options.systemPrompt = args[i + 1]; i++; }
      else if (arg === '--provider' && args[i + 1]) { options.modelProvider = args[i + 1]; i++; }
      else if (arg === '--mode' && args[i + 1]) {
        if (args[i + 1] === 'ephemeral' || args[i + 1] === 'persistent') options.memoryMode = args[i + 1];
        i++;
      }
      else if (arg === '--tui') { options.useUI = 'tui'; }
      else if (arg === '--interactive') { options.interactive = true; }
      else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    }

    if (!options.userId) {
      console.error('Error: --user-id is required for CLI mode');
      printHelp();
      process.exit(1);
    }

    return { mode: 'cli', options };
  }

  if (first === '--help' || first === '-h') {
    printBanner();
    printHelp();
    process.exit(0);
  }

  return { mode: 'server', options: {} };
}

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  ◆ TIMPs v2.0 — Trustworthy Interactive Memory Partner   ║
║  17 Intelligence Tools · Model Agnostic · Open Source    ║
╚══════════════════════════════════════════════════════════╝

Usage:
  npx timps start              Start server (default)
  npx timps server             Start server
  npx timps cli --user-id 1   Interactive CLI
  npx timps cli --tui          TUI interface

After starting:
  http://localhost:3000          → Landing page
  http://localhost:3000/chat     → Chat
  http://localhost:3000/dashboard → Intelligence dashboard

Environment (.env):
  DEFAULT_MODEL_PROVIDER=openrouter
  OPENROUTER_API_KEY=sk-or-v1-...
  POSTGRES_HOST=localhost

GitHub: https://github.com/Sandeeprdy1729/timps
`);
}

async function runStart(): Promise<void> {
  printBanner();
  console.log('Starting TIMPs server...\n');
  await startServer();
}

async function main(): Promise<void> {
  await initDatabase();
  const { mode, options } = parseArgs();

  if (mode === 'start') {
    await runStart();
  } else if (mode === 'cli') {
    if (options.useUI === 'tui') {
      const { runTUI } = await import('./interfaces/tui');
      await runTUI(options);
    } else {
      await runCLI(options);
    }
  } else {
    await startServer();
  }
}

main().catch(console.error);