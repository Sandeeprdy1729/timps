// ── TIMPS Gmail — CLI commands ──
// timps gmail:connect | gmail:sync | gmail:status | gmail:disconnect | gmail:cron

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import { t } from '../config/theme.js';
import {
  GMAIL_DIR,
  loadState,
  loadTokens,
} from '../services/gmail/storage.js';
import { connectGmail, disconnectGmail, hasValidTokens, gmailCredentialCommand } from '../services/gmail/oauth.js';
import { runGmailSync as runGmailSyncService } from '../services/gmail/sync.js';

// The CLI entry point as installed (dist) or dev runner (tsx).
function cliEntry(): { node: string; module: string } {
  const distBin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'bin', 'timps.js');
  const node = process.execPath;
  if (fs.existsSync(distBin)) return { node, module: distBin };
  return { node, module: path.relative(process.cwd(), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'bin', 'timps.ts')) };
}

export async function runGmailConnect(_opts: { skipBrowser?: boolean } = {}): Promise<number> {
  if (hasValidTokens()) {
    console.log(`\n  ${t.success('✓')} Gmail is already connected. Run ${t.accent('timps gmail:sync')} to pull new emails.\n`);
    return 0;
  }
  try {
    const result = await connectGmail(_opts);
    console.log(`\n  ${t.success('✓')} Connected to Gmail as ${t.accent(result.email)}`);
    console.log(`  ${t.dim('Email data lives in:')} ${t.accent(GMAIL_DIR)}`);
    console.log(`  ${t.dim('Next:')} ${t.accent('timps gmail:sync')} (fetch + store knowledge)\n`);
    return 0;
  } catch (err) {
    console.error(`\n  ${t.error('Connect failed:')} ${(err as Error).message}\n`);
    return 1;
  }
}

export async function runGmailSync(_opts: Record<string, unknown> = {}): Promise<number> {
  const lookbackDays = _opts.lookback ? parseInt(String(_opts.lookback), 10) : undefined;
  const maxMessages = _opts.max ? parseInt(String(_opts.max), 10) : undefined;
  const skipMemory = _opts['no-memory'] === true;
  try {
    const result = await runGmailSyncService({ lookbackDays, maxMessages, storeMemory: !skipMemory });
    console.log(`\n  ${t.brandBold('Gmail Sync')} » ${t.accent(result.connectedAs)}`);
    console.log(`    ${t.dim('Found')} ${result.fetched} email(s) | ${t.dim('new')} ${result.stored} | ${t.dim('already stored')} ${result.skippedExisting}`);
    console.log(`    ${t.dim('Summarized')} ${result.summarized} | ${t.dim('facts stored in TIMPS memory')} ${t.accent(String(result.factsStored))}\n`);
    return 0;
  } catch (err) {
    console.error(`\n  ${t.error('Sync failed:')} ${(err as Error).message}\n`);
    return 1;
  }
}

export async function runGmailStatus(): Promise<number> {
  const tokens = loadTokens();
  const state = loadState();
  console.log(`\n${t.brandBold('Gmail Status')}\n`);
  if (!tokens?.accessToken) {
    console.log(`  ${t.error('○')} Not connected — run ${t.accent('timps gmail:connect')}\n`);
    return 0;
  }
  const connected = await hasValidTokens();
  console.log(`  ${connected ? t.success('●') : t.dim('○')} Account:     ${t.accent(tokens.email ?? 'unknown')}`);
  console.log(`  ${t.dim('Tokens:')}       ${tokens.refreshToken ? 'refresh token stored' : 'missing'}`);
  console.log(`  ${t.dim('Last sync:')}    ${state.lastRun ? new Date(state.lastRun).toISOString() : 'never'}`);
  console.log(`  ${t.dim('Emails synced:')} ${state.messagesSynced}`);
  console.log(`  ${t.dim('Data folder:')}  ${GMAIL_DIR}\n`);
  return 0;
}

export async function runGmailDisconnect(): Promise<number> {
  const removed = disconnectGmail();
  console.log(removed
    ? `\n  ${t.success('✓')} Disconnected from Gmail. Tokens removed.\n`
    : `\n  ${t.dim('Gmail was not connected.')}\n`);
  return 0;
}

function launchdPlistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', 'ai.timps.gmail.sync.plist');
}

async function writeLaunchdPlist(hour: number, minute: number): Promise<string> {
  const { node, module } = cliEntry();
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.timps.gmail.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${module}</string>
    <string>gmail:sync</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${path.join(GMAIL_DIR, 'logs', 'sync.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(GMAIL_DIR, 'logs', 'sync.err.log')}</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
`;
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(launchdPlistPath()), { recursive: true });
    fs.writeFile(launchdPlistPath(), plist, (err) => (err ? reject(err) : resolve(launchdPlistPath())));
  });
}

export async function runGmailCron(_opts: Record<string, unknown> = {}): Promise<number> {
  const remove = _opts.remove === true;
  const plist = launchdPlistPath();

  if (remove) {
    try { execSync('launchctl unload ' + plist, { stdio: 'ignore' }); } catch { /* not loaded */ }
    fs.rmSync(plist, { force: true });
    console.log(`\n  ${t.success('✓')} Removed daily Gmail sync.\n`);
    return 0;
  }

  if (process.platform === 'darwin') {
    const [hour, minute] = String(_opts.time ?? '09:00').split(':').map((n) => parseInt(n, 10));
    const target = await writeLaunchdPlist(Number.isNaN(hour) ? 9 : hour, Number.isNaN(minute) ? 0 : minute);
    try { execSync(`launchctl unload ${target}`, { stdio: 'ignore' }); } catch { /* not yet loaded */ }
    try { execSync(`launchctl load ${target}`, { stdio: 'ignore' }); } catch { /* ignore */ }
    console.log(`\n  ${t.success('✓')} Daily Gmail sync scheduled at ${t.accent(`${hour}:${String(minute).padStart(2, '0')}`)}`);
    console.log(`  ${t.dim('LaunchAgent:')} ${target}\n`);
    return 0;
  }

  // Non-macOS: print a cron line the user can install.
  const { node, module } = cliEntry();
  console.log(`\n  ${t.dim('Add this to crontab (crontab -e):')}\n`);
  console.log(`  ${t.accent(`${String(_opts.time ?? '0 9').split(' ')[0]} ${String(_opts.time ?? '0 9').split(' ')[1] ?? '9'} * * * ${node} ${module} gmail:sync >> ${path.join(GMAIL_DIR, 'logs', 'sync.log')} 2>&1`)}\n`);
  return 0;
}

export function addGmailCommands(program: Command): void {
  program
    .command('gmail:connect')
    .description('Link your Gmail account to TIMPS (browser OAuth, read-only)')
    .option('--no-browser', 'Print the URL instead of opening the browser')
    .action(async (opts: { [k: string]: unknown }) => {
      process.exit(await runGmailConnect({ skipBrowser: opts.browser === false }));
    });

  program
    .command('gmail:sync')
    .description('Fetch new emails and store distilled knowledge into TIMPS memory')
    .option('--lookback <days>', 'Search back this many days (default 1)')
    .option('--max <n>', 'Max messages per run (default 50)')
    .option('--no-memory', 'Fetch + store raw emails but skip TIMPS memory')
    .action(async (opts: Record<string, unknown>) => {
      process.exit(await runGmailSync(opts));
    });

  program
    .command('gmail:status')
    .description('Show Gmail connection + last sync status')
    .action(async () => {
      process.exit(await runGmailStatus());
    });

  program
    .command('gmail:disconnect')
    .description('Remove Gmail tokens and disconnect')
    .action(async () => {
      process.exit(await runGmailDisconnect());
    });

  program
    .command('gmail:credential <file>')
    .description('Import a downloaded Google OAuth client JSON (once)')
    .action((file: string) => {
      gmailCredentialCommand([file]);
    });

  program
    .command('gmail:cron')
    .description('Schedule daily Gmail→memory sync (launchd on macOS, cron hint otherwise)')
    .option('--time <HH:MM>', 'Time of day, e.g. 08:30 (default 09:00)')
    .option('--remove', 'Remove the scheduled job')
    .action(async (opts: Record<string, unknown>) => {
      process.exit(await runGmailCron(opts));
    });
}