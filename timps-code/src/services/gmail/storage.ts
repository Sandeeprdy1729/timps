// ── TIMPS Gmail — Local storage layer ──
// All email data lives in its own app folder (~/.timps/gmail) so it stays
// separate from the TIMPS memory store. Only distilled knowledge facts are
// pushed into the canonical memory store by the sync pipeline.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export function gmailBaseDir(): string {
  return process.env.TIMPS_GMAIL_DIR ?? path.join(os.homedir(), '.timps', 'gmail');
}

// Computed once at load; override with TIMPS_GMAIL_DIR for custom/testing setups.
export const GMAIL_DIR = gmailBaseDir();
export const RAW_DIR = path.join(GMAIL_DIR, 'raw');

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string;
  scopes?: string[];
  obtainedAt?: number;
}

export interface GmailState {
  lastRun: string | null;
  lastMessageId: string | null;
  messagesSynced: number;
}

export interface GmailClientCreds {
  client_id: string;
  client_secret: string;
  project_id?: string;
  redirect_uris?: string[];
  auth_uri?: string;
  token_uri?: string;
}

export function ensureGmailDirs(): void {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(path.join(GMAIL_DIR, 'logs'), { recursive: true });
}

export function gmailTokensFile(): string {
  return path.join(GMAIL_DIR, 'tokens.json');
}

export function gmailStateFile(): string {
  return path.join(GMAIL_DIR, 'state.json');
}

export function gmailClientFile(): string {
  return path.join(GMAIL_DIR, 'client.json');
}

export function gmailSummariesFile(): string {
  return path.join(GMAIL_DIR, 'summaries.jsonl');
}

export function rawEmailFile(messageId: string, date: Date = new Date()): string {
  return path.join(RAW_DIR, date.toISOString().slice(0, 10), `${messageId}.json`);
}

export function loadJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function saveJson(file: string, data: unknown, mode: number = 0o600): void {
  ensureGmailDirs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode });
}

export function loadTokens(): GmailTokens | null {
  return loadJson<GmailTokens>(gmailTokensFile());
}

export function saveTokens(tokens: GmailTokens): void {
  saveJson(gmailTokensFile(), tokens, 0o600);
}

export function loadState(): GmailState {
  return loadJson<GmailState>(gmailStateFile()) ?? {
    lastRun: null,
    lastMessageId: null,
    messagesSynced: 0,
  };
}

export function saveState(state: GmailState): void {
  saveJson(gmailStateFile(), state, 0o600);
}

export function loadClientCreds(): GmailClientCreds | null {
  // Accept both names — Google's downloaded file is `credentials.json`,
  // but we keep a canonical `client.json` in the TIMPS gmail folder.
  const candidates = [
    gmailClientFile(),
    path.join(GMAIL_DIR, 'credentials.json'),
    path.join(os.homedir(), '.timps', 'credentials.json'),
  ];
  for (const file of candidates) {
    const creds = loadJson<GmailClientCreds & { installed?: GmailClientCreds; web?: GmailClientCreds }>(file);
    if (!creds) continue;
    const unwrapped = creds.installed ?? creds.web ?? creds;
    if (unwrapped.client_id && unwrapped.client_secret) return unwrapped;
  }
  return null;
}