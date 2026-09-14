// ── TIMPS Gmail — Sync pipeline ──
// Fetch new emails → store raw copies in ~/.timps/gmail/raw → summarize each
// into knowledge facts → push facts into the canonical TIMPS memory store.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Memory } from '../../memory/memory.js';
import { t } from '../../config/theme.js';
import {
  GMAIL_DIR,
  gmailSummariesFile,
  loadState,
  loadTokens,
  rawEmailFile,
  saveState,
  type GmailState,
} from './storage.js';
import { getProfileEmail, listMessageIds, getRawMessage, extractEmail, type ExtractedEmail } from './client.js';
import { summarizeEmail, formatFactsForStorage } from './summarize.js';

export interface SyncOptions {
  lookbackDays?: number;
  maxMessages?: number;
  query?: string;
  storeMemory?: boolean;
}

export interface SyncResult {
  connectedAs: string;
  fetched: number;
  stored: number;
  summarized: number;
  factsStored: number;
  skippedExisting: number;
}

const DEFAULT_LOOKBACK_DAYS = 1;
const DEFAULT_MAX = 200; // generous first-pull cap; daily runs stay near zero new

export function buildInboxQuery(state: GmailState, lookbackDays: number): string {
  if (state.lastRun) {
    const since = Math.floor(new Date(state.lastRun).getTime() / 1000) - 6 * 3600;
    return `in:inbox after:${since}`;
  }
  // First run: whole inbox unless an explicit --lookback window was requested.
  return lookbackDays && lookbackDays !== DEFAULT_LOOKBACK_DAYS
    ? `in:inbox newer_than:${lookbackDays}d`
    : 'in:inbox';
}

export async function runGmailSync(options: SyncOptions = {}): Promise<SyncResult> {
  const tokens = loadTokens();
  if (!tokens?.accessToken || !tokens.refreshToken) {
    throw new Error('Gmail not connected. Run `timps gmail:connect` first.');
  }

  const connectedAs = tokens.email ?? (await getProfileEmail());
  const state = loadState();
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxMessages = options.maxMessages ?? DEFAULT_MAX;
  const query = options.query ?? buildInboxQuery(state, lookbackDays);

  const { messages: ids } = await listMessageIds(query, maxMessages);
  const result: SyncResult = {
    connectedAs,
    fetched: ids?.length ?? 0,
    stored: 0,
    summarized: 0,
    factsStored: 0,
    skippedExisting: 0,
  };

  const memory = new Memory(os.homedir());

  for (const ref of ids ?? []) {
    const rawPath = rawEmailFile(ref.id);
    if (fs.existsSync(rawPath)) {
      result.skippedExisting += 1;
      continue;
    }

    let email: ExtractedEmail;
    try {
      const raw = await getRawMessage(ref.id);
      email = extractEmail(raw);
    } catch (err) {
      console.error(`  ${t.dim('skip')} ${ref.id}: ${(err as Error).message}`);
      continue;
    }

    // 1. Store the raw, decoded email in the dedicated gmail app folder.
    fs.mkdirSync(path.dirname(rawPath), { recursive: true });
    fs.writeFileSync(rawPath, JSON.stringify({ ...email, syncedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    result.stored += 1;

    // 2. Summarize into knowledge facts.
    let summary;
    try {
      summary = await summarizeEmail({
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        date: email.date,
        bodyText: email.bodyText,
      });
    } catch (err) {
      summary = {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        date: email.date,
        facts: [],
        method: 'heuristic',
        error: (err as Error).message,
      };
    }

    fs.appendFileSync(
      gmailSummariesFile(),
      JSON.stringify({ ...summary, syncedAt: new Date().toISOString() }) + '\n',
    );
    result.summarized += 1;

    // 3. Push distilled facts into TIMPS memory (canonical store).
    if (options.storeMemory !== false) {
      const facts = formatFactsForStorage(summary.facts, email);
      for (const fact of facts) {
        memory.storeFact(fact, 'fact', ['email', 'gmail', 'knowledge', ...senderTags(email.from)]);
        result.factsStored += 1;
      }
    }

    console.log(
      `  · ${t.dim(`${result.stored}/${ids?.length ?? 0}`)} ${email.subject.slice(0, 60)} → ${t.accent(String((summary.facts ?? []).length))} fact(s)`,
    );
  }

  const updatedState: GmailState = {
    lastRun: new Date().toISOString(),
    lastMessageId: ids?.[0]?.id ?? state.lastMessageId,
    messagesSynced: state.messagesSynced + result.stored,
  };
  saveState(updatedState);

  return result;
}

function senderTags(from: string): string[] {
  const match = from.match(/[\w.+-]+@[\w.-]+/);
  if (!match) return [];
  return [`sender:${match[0].toLowerCase()}`];
}

export function gmailDataDir(): string {
  return GMAIL_DIR;
}