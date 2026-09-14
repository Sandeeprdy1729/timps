// ── TIMPS Connectors — token & state storage ──
// Shared by all connector sync services. Reads the same ~/.timps/<id>/ files
// the Tauri engine's OAuth flow writes: client.json (Google desktop JSON or
// flat { client_id, client_secret? }) and tokens.json
// { accessToken, refreshToken?, expiresAt, scopes, email, obtainedAt }.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { connectorDef } from './registry.js';

export interface ConnectorTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes?: string;
  email?: string;
  obtainedAt?: number;
}

export interface ConnectorState {
  lastRun: string | null;
  syncedCount: number;
  connectedAs?: string;
}

export interface ConnectorClient {
  client_id: string;
  client_secret?: string;
  token_uri?: string;
}

// Allow test scoping + power-user overrides: TIMPS_<ID>_DIR, e.g. TIMPS_CALENDAR_DIR.
export function providerDir(id: string): string {
  const env = `TIMPS_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_DIR`;
  return process.env[env] ?? path.join(os.homedir(), '.timps', id);
}

export function tokensFile(id: string): string {
  return path.join(providerDir(id), 'tokens.json');
}

export function clientFile(id: string): string {
  return path.join(providerDir(id), 'client.json');
}

export function stateFile(id: string): string {
  return path.join(providerDir(id), 'state.json');
}

export function summariesFile(id: string): string {
  return path.join(providerDir(id), 'summaries.jsonl');
}

export function rawDir(id: string): string {
  return path.join(providerDir(id), 'raw');
}

export function enstateDir(id: string): void {
  fs.mkdirSync(rawDir(id), { recursive: true });
}

export function loadTokens(id: string): ConnectorTokens | null {
  const file = tokensFile(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ConnectorTokens;
  } catch {
    return null;
  }
}

export function saveTokens(id: string, tokens: ConnectorTokens): void {
  enstateDir(id);
  fs.writeFileSync(tokensFile(id), JSON.stringify(tokens, null, 2));
}

export function loadClient(id: string): ConnectorClient | null {
  const file = clientFile(id);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (parsed?.installed && typeof parsed.installed === 'object') {
      return {
        client_id: parsed.installed.client_id ?? '',
        client_secret: parsed.installed.client_secret,
        token_uri: parsed.installed.token_uri,
      };
    }
    if (parsed?.web && typeof parsed.web === 'object') {
      return {
        client_id: parsed.web.client_id ?? '',
        client_secret: parsed.web.client_secret,
        token_uri: parsed.web.token_uri,
      };
    }
    return {
      client_id: String(parsed.client_id ?? ''),
      client_secret: parsed.client_secret ? String(parsed.client_secret) : undefined,
      token_uri: parsed.token_uri ? String(parsed.token_uri) : undefined,
    };
  } catch {
    return null;
  }
}

export function loadState(id: string): ConnectorState {
  const file = stateFile(id);
  if (!fs.existsSync(file)) return { lastRun: null, syncedCount: 0 };
  try {
    return { lastRun: null, syncedCount: 0, ...(JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<ConnectorState>) };
  } catch {
    return { lastRun: null, syncedCount: 0 };
  }
}

export function saveState(id: string, state: ConnectorState): void {
  enstateDir(id);
  const tmp = `${stateFile(id)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, stateFile(id));
}

/** Count previously-synced items so the desktop can show a total. */
export function syncedCount(id: string): number {
  const file = summariesFile(id);
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  let leftover = '';
  try {
    const data = fs.readFileSync(file, 'utf-8');
    const buffer = Buffer.from(leftover + data);
    const chunks = buffer.toString().split('\n');
    leftover = chunks.pop() ?? '';
    for (const line of chunks) if (line.trim()) n++;
  } catch {
    return 0;
  }
  return n;
}

/**
 * Return a valid access token, refreshing via the provider token endpoint when
 * it is about to expire/expired. Throws a friendly error when re-auth is needed.
 */
export async function ensureAccessToken(id: string): Promise<string> {
  const def = connectorDef(id);
  if (!def) throw new Error(`Unknown connector: ${id}`);

  const tokens = loadTokens(id);
  if (!tokens?.accessToken) {
    throw new Error(`${def.display} is not connected. Open TIMPS Desktop → Connectors and authorize it first.`);
  }

  const fresh = Date.now() < tokens.expiresAt - 5 * 60 * 1000;
  if (fresh) return tokens.accessToken;

  if (!tokens.refreshToken || !def.refreshable) {
    throw new Error(`${def.display} token expired. Reconnect in TIMPS Desktop → Connectors.`);
  }

  const creds = loadClient(id);
  if (!creds?.client_id) {
    throw new Error(`${def.display} is missing client.json credentials. Re-import them or reconnect in TIMPS Desktop.`);
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.client_id,
    refresh_token: tokens.refreshToken,
  });
  if (creds.client_secret) body.set('client_secret', creds.client_secret);
  if (def.scopeHint) body.set('scope', def.scopeHint);

  const endpoint = creds.token_uri ?? def.tokenUri;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${def.display} token refresh failed (${res.status}). Reconnect in TIMPS Desktop → Connectors.`);
  }
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };

  const updated: ConnectorTokens = {
    accessToken: data.access_token ?? tokens.accessToken,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scopes: tokens.scopes,
    email: tokens.email,
    obtainedAt: tokens.obtainedAt,
  };
  saveTokens(id, updated);
  return updated.accessToken;
}

export function disconnectConnector(id: string): boolean {
  const dir = providerDir(id);
  const hadTokens = fs.existsSync(tokensFile(id));
  if (!hadTokens) return false;
  fs.rmSync(tokensFile(id), { force: true });
  fs.rmSync(stateFile(id), { force: true });
  fs.rmSync(path.join(dir, 'auth.json'), { force: true });
  return true;
}