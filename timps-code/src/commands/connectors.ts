// ── TIMPS Connectors — CLI commands ──
// Registers `calendar:sync|status|disconnect`, `drive:…`, `github:…`,
// `notion:…`, `slack:…`, `linear:…`, `ms365:…`. These are the exact commands
// the Tauri engine shells out to (`timps <id>:sync`). Gmail keeps its own
// richer commands in commands/gmail.ts.

import { Command } from 'commander';
import { CONNECTORS, providerDir } from '../services/connectors/index.js';
import {
  disconnectConnector,
  loadTokens,
  loadState,
  syncedCount,
} from '../services/connectors/tokens.js';
import { runConnectorSync } from '../services/connectors/sync.js';
import { t } from '../config/theme.js';

export async function runConnectorSyncCommand(
  id: string,
  opts: Record<string, unknown> = {},
): Promise<number> {
  try {
    const result = await runConnectorSync(id, {
      maxItems: opts.max ? parseInt(String(opts.max), 10) : undefined,
      storeMemory: opts['no-memory'] !== true,
    });
    const def = CONNECTORS.find((c) => c.id === id);
    console.log(`\n  ${t.brandBold(`${def?.display ?? id} Sync`)} » ${t.accent(result.connectedAs)}`);
    console.log(
      `    ${t.dim('Found')} ${result.fetched} item(s) | ${t.dim('new')} ${result.stored} | ${t.dim('already stored')} ${result.skippedExisting}`,
    );
    console.log(`    ${t.dim('Facts stored in TIMPS memory')} ${t.accent(String(result.factsStored))}\n`);
    return 0;
  } catch (err) {
    console.error(`\n  ${t.error('Sync failed:')} ${(err as Error).message}\n`);
    return 1;
  }
}

export async function runConnectorStatusCommand(id: string): Promise<number> {
  const def = CONNECTORS.find((c) => c.id === id);
  const tokens = loadTokens(id);
  const state = loadState(id);
  console.log(`\n${t.brandBold(`${def?.display ?? id} Status`)}\n`);
  if (!tokens?.accessToken) {
    console.log(`  ${t.error('○')} Not connected — open TIMPS Desktop → Connectors to authorize.\n`);
    return 0;
  }
  console.log(`  ${t.success('●')} Account:     ${t.accent(tokens.email ?? 'unknown')}`);
  console.log(`  ${t.dim('Tokens:')}       ${tokens.refreshToken ? 'refresh token stored' : 'access token only'}`);
  console.log(`  ${t.dim('Last sync:')}    ${state.lastRun ? new Date(state.lastRun).toISOString() : 'never'}`);
  console.log(`  ${t.dim('Items synced:')} ${syncedCount(id)}`);
  console.log(`  ${t.dim('Data folder:')}  ${providerDir(id)}\n`);
  return 0;
}

export async function runConnectorDisconnectCommand(id: string): Promise<number> {
  const def = CONNECTORS.find((c) => c.id === id);
  const removed = disconnectConnector(id);
  console.log(
    removed
      ? `\n  ${t.success('✓')} Disconnected ${def?.display ?? id}. Tokens removed.\n`
      : `\n  ${t.dim(`${def?.display ?? id} was not connected.`)}\n`,
  );
  return 0;
}

export function addConnectorCommands(program: Command): void {
  for (const def of CONNECTORS) {
    if (def.id === 'gmail') continue; // gmail has its own command module.
    const label = def.display;

    program
      .command(`${def.id}:sync`)
      .description(`Fetch recent ${label} activity and store distilled knowledge into TIMPS memory`)
      .option('--max <n>', 'Max items per run')
      .option('--no-memory', 'Fetch + raw-store but skip TIMPS memory')
      .action(async (opts: Record<string, unknown>) => {
        process.exit(await runConnectorSyncCommand(def.id, opts));
      });

    program
      .command(`${def.id}:status`)
      .description(`Show ${label} connection + last sync status`)
      .action(async () => {
        process.exit(await runConnectorStatusCommand(def.id));
      });

    program
      .command(`${def.id}:disconnect`)
      .description(`Remove ${label} tokens and disconnect`)
      .action(async () => {
        process.exit(await runConnectorDisconnectCommand(def.id));
      });
  }
}