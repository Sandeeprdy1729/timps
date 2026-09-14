// ── TIMPS Gmail — Google OAuth 2.0 (frictionless) ──
// Loopback redirect flow: we spin up a local HTTP server, open the browser,
// let Google redirect back with the code, exchange it, and save the tokens.
// No copy-paste unless the browser can't confirm the redirect (manual fallback).

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import {
  GMAIL_DIR,
  gmailClientFile,
  loadClientCreds,
  loadTokens,
  saveTokens,
  type GmailTokens,
  type GmailClientCreds,
} from './storage.js';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface ConnectResult {
  tokens: GmailTokens;
  email: string;
  flow: 'loopback' | 'manual';
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === 'darwin') exec(`open "${url}"`);
  else if (platform === 'linux') exec(`xdg-open "${url}"`);
  else if (platform === 'win32') exec(`start "" "${url}"`);
  else return;
}

function resolveCreds(): { creds: GmailClientCreds; source: string } {
  const envId = process.env.GMAIL_CLIENT_ID;
  const envSecret = process.env.GMAIL_CLIENT_SECRET;
  if (envId && envSecret) {
    return {
      creds: { client_id: envId, client_secret: envSecret, token_uri: TOKEN_URL },
      source: 'environment (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)',
    };
  }
  const creds = loadClientCreds();
  if (creds) return { creds, source: '~/.timps/gmail/client.json' };
  throw new Error(
    'No Gmail OAuth credentials found.\n\n' +
      'Setup (once, ~2 minutes):\n' +
      '  1. Go to https://console.cloud.google.com/ and create a project\n' +
      '  2. Enable the Gmail API (APIs & Services > Library > Gmail API > Enable)\n' +
      '  3. APIs & Services > OAuth consent screen > External > create,\n' +
      '     add your email as a Test user\n' +
      '  4. APIs & Services > Credentials > Create credentials > OAuth client ID\n' +
      '     > Desktop app > Create  > Download JSON\n' +
      '  5. Run:  timps gmail:credential <path-to-downloaded-json>\n\n' +
      'The downloaded credential file is then stored at ~/.timps/gmail/client.json.',
  );
}

export function persistClientCredsFromGoogleJson(filePath: string): { clientId: string; saved: string } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GmailClientCreds & { installed?: GmailClientCreds; web?: GmailClientCreds };
  const creds = raw.installed ?? raw.web ?? raw;
  if (!creds.client_id || !creds.client_secret) {
    throw new Error('That file is not a Google OAuth client file (missing client_id/client_secret).');
  }
  fs.mkdirSync(GMAIL_DIR, { recursive: true });
  const target = gmailClientFile();
  fs.writeFileSync(target, JSON.stringify({ ...creds, token_uri: creds.token_uri ?? TOKEN_URL }, null, 2), { mode: 0o600 });
  return { clientId: creds.client_id, saved: target };
}

async function postForm(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(form).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function exchangeCodeForTokens(
  creds: GmailClientCreds,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const data = await postForm(creds.token_uri ?? TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    code,
    redirect_uri: redirectUri,
  });
  return data as unknown as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

export async function refreshAccessToken(creds: GmailClientCreds, refreshToken: string): Promise<GmailTokens> {
  const data = await postForm(creds.token_uri ?? TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: refreshToken,
  });
  const accessToken = data.access_token as string;
  if (!accessToken) throw new Error('Refresh failed — no access token returned (token may be revoked).');
  const existing = loadTokens();
  const tokens: GmailTokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ((data.expires_in as number) ?? 3600) * 1000,
    scopes: existing?.scopes,
    email: existing?.email,
    obtainedAt: Date.now(),
  };
  saveTokens(tokens);
  return tokens;
}

export function hasValidTokens(): boolean {
  const tokens = loadTokens();
  if (!tokens?.accessToken || !tokens.refreshToken) return false;
  return Date.now() < tokens.expiresAt - 5 * 60 * 1000;
}

/** Returns a usable access token, refreshing and persisting if needed. */
export async function getAccessToken(): Promise<string> {
  const creds = resolveCreds().creds;
  let tokens = loadTokens();
  if (!tokens?.accessToken) throw new Error('Not connected. Run `timps gmail:connect` first.');
  if (Date.now() >= tokens.expiresAt - 5 * 60 * 1000) {
    tokens = await refreshAccessToken(creds, tokens.refreshToken);
  }
  return tokens.accessToken;
}

export async function connectGmail(options?: { skipBrowser?: boolean }): Promise<ConnectResult> {
  const { creds } = resolveCreds();
  const state = randomBytes(16).toString('hex');

  const listen = (): Promise<number> =>
    new Promise<number>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void req;
        res.writeHead(200);
        res.end('ok');
        server.close();
      });
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close();
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('Could not allocate loopback port'));
      });
    });

  const port = await listen();
  const redirectUri = `http://localhost:${port}/oauth2callback`;

  const authUrl = new URL(creds.auth_uri ?? AUTH_URL);
  authUrl.searchParams.set('client_id', creds.client_id);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GMAIL_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (!code || returnedState !== state) {
        res.writeHead(400);
        res.end('<h3>Authorization failed.</h3><p>Please close this tab and run <code>timps gmail:connect</code> again.</p>');
        server.close();
        reject(new Error('OAuth callback failed — missing code or state mismatch.'));
        return;
      }
      res.end('<h3>✓ TIMPS connected to Gmail.</h3><p>You can close this tab and return to your terminal.</p>');
      server.close();
      resolve(code);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });

  if (!options?.skipBrowser) {
    console.log(`\n  Opening browser to authorize TIMPS for Gmail (read-only scope)...\n  ${authUrl.toString()}\n`);
    openBrowser(authUrl.toString());
  } else {
    console.log(`\n  Authorize TIMPS for Gmail (read-only scope) by opening:\n  ${authUrl.toString()}\n`);
  }

  const code = await Promise.race([
    codePromise,
    new Promise<string>((_, reject) => {
      // Allow more time to click through sign-in = > unverified-app warnings = > consent.
      const ms = Number(process.env.TIMPS_GMAIL_AUTH_TIMEOUT_MS ?? 5 * 60 * 1000);
      setTimeout(() => {
        reject(new Error(
          `Timed out waiting for authorization (${Math.round(ms / 1000)}s). ` +
          'Complete the consent screen in the browser, then re-run `timps gmail:connect`.',
        ));
      }, ms);
    }),
  ]);

  if (!code) throw new Error('No authorization code received.');

  const exchanged = await exchangeCodeForTokens(creds, code, redirectUri);
  const refreshToken = exchanged.refresh_token;
  if (!refreshToken) {
    throw new Error('Google did not return a refresh token. Re-run connect and re-authorize (access_type=offline).');
  }

  const tokens: GmailTokens = {
    accessToken: exchanged.access_token,
    refreshToken,
    expiresAt: Date.now() + exchanged.expires_in * 1000,
    scopes: exchanged.scope?.split(' ') ?? [GMAIL_SCOPE],
    obtainedAt: Date.now(),
  };
  saveTokens(tokens);

  // Determine the connected address via the profile endpoint.
  const { getProfileEmail } = await import('./client.js');
  let email = '';
  try {
    email = await getProfileEmail(tokens.accessToken);
    tokens.email = email;
    saveTokens(tokens);
  } catch {
    email = 'unknown';
  }

  return { tokens, email, flow: 'loopback' };
}

export function disconnectGmail(): boolean {
  const file = path.join(GMAIL_DIR, 'tokens.json');
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

export function gmailCredentialCommand(args: string[]): void {
  const file = args[0];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: timps gmail:credential <path-to-google-oauth-json>');
    process.exit(1);
  }
  const { clientId, saved } = persistClientCredsFromGoogleJson(file);
  console.log(`  ✓ Stored OAuth credentials (${clientId}) → ${saved}`);
  console.log('  Run `timps gmail:connect` to link your Gmail account.');
}