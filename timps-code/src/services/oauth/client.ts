// TIMPS Code — OAuth Client
// OAuth 2.0 with PKCE for timps authentication

import * as https from 'node:https';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './crypto.js';
import { AuthCodeListener, getOAuthConfig, type OAuthConfig } from './authCodeListener.js';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  profile?: {
    uuid: string;
    email: string;
  };
}

export interface OAuthTokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

function parseScopes(scopeString?: string): string[] {
  return scopeString?.split(' ').filter(Boolean) ?? [];
}

async function httpsRequest(url: string, options: https.RequestOptions, body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Request failed: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postJson(url: string, body: Record<string, string | number>): Promise<OAuthTokenExchangeResponse> {
  const bodyStr = JSON.stringify(body);
  const urlObj = new URL(url);
  const options: https.RequestOptions = {
    hostname: urlObj.hostname,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  };
  const data = await httpsRequest(url, options, bodyStr);
  return JSON.parse(data);
}

export function buildAuthUrl({
  codeChallenge,
  state,
  port,
  isManual,
}: {
  codeChallenge: string;
  state: string;
  port: number;
  isManual: boolean;
}): string {
  const config = getOAuthConfig();
  const authUrl = new URL(config.AUTHORIZE_URL);
  authUrl.searchParams.append('client_id', config.CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append(
    'redirect_uri',
    isManual ? config.MANUAL_REDIRECT_URL : `http://localhost:${port}/callback`,
  );
  authUrl.searchParams.append('scope', 'read write');
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('state', state);
  return authUrl.toString();
}

export async function exchangeCodeForTokens(
  authorizationCode: string,
  state: string,
  codeVerifier: string,
  port: number,
  useManualRedirect: boolean = false,
): Promise<OAuthTokenExchangeResponse> {
  const config = getOAuthConfig();
  return postJson(config.TOKEN_URL, {
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: useManualRedirect ? config.MANUAL_REDIRECT_URL : `http://localhost:${port}/callback`,
    client_id: config.CLIENT_ID,
    code_verifier: codeVerifier,
    state,
  });
}

export async function refreshOAuthToken(refreshToken: string): Promise<OAuthTokens> {
  const config = getOAuthConfig();
  const response = await postJson(config.TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.CLIENT_ID,
  });

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: Date.now() + response.expires_in * 1000,
    scopes: parseScopes(response.scope),
  };
}

export function isOAuthTokenExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return false;
  const bufferTime = 5 * 60 * 1000;
  return (Date.now() + bufferTime) >= expiresAt;
}

export class OAuthService {
  private codeVerifier: string;
  private authCodeListener: AuthCodeListener | null = null;
  private port: number | null = null;
  private manualAuthCodeResolver: ((authorizationCode: string) => void) | null = null;

  constructor() {
    this.codeVerifier = generateCodeVerifier();
  }

  async authenticate(options?: {
    skipBrowserOpen?: boolean;
    onUrlHandler?: (url: string) => Promise<void>;
  }): Promise<OAuthTokens> {
    this.authCodeListener = new AuthCodeListener();
    this.port = await this.authCodeListener.start();

    const codeChallenge = generateCodeChallenge(this.codeVerifier);
    const state = generateState();

    const manualFlowUrl = buildAuthUrl({ codeChallenge, state, port: this.port, isManual: true });
    const automaticFlowUrl = buildAuthUrl({ codeChallenge, state, port: this.port, isManual: false });

    const authorizationCode = await this.waitForAuthorizationCode(
      state,
      async () => {
        if (options?.onUrlHandler) {
          await options.onUrlHandler(manualFlowUrl);
          if (!options?.skipBrowserOpen) {
            await this.openBrowser(automaticFlowUrl);
          }
        }
      },
    );

    const isAutomaticFlow = this.authCodeListener?.hasPendingResponse() ?? false;

    try {
      const tokenResponse = await exchangeCodeForTokens(
        authorizationCode,
        state,
        this.codeVerifier,
        this.port,
        !isAutomaticFlow,
      );

      if (isAutomaticFlow) {
        this.authCodeListener?.handleSuccessRedirect(parseScopes(tokenResponse.scope));
      }

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        scopes: parseScopes(tokenResponse.scope),
      };
    } catch (error) {
      if (isAutomaticFlow) {
        this.authCodeListener?.handleErrorRedirect();
      }
      throw error;
    } finally {
      this.authCodeListener?.close();
    }
  }

  private async waitForAuthorizationCode(
    state: string,
    onReady: () => Promise<void>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.manualAuthCodeResolver = resolve;

      this.authCodeListener
        ?.waitForAuthorization(state, onReady)
        .then((authorizationCode) => {
          this.manualAuthCodeResolver = null;
          resolve(authorizationCode);
        })
        .catch((error) => {
          this.manualAuthCodeResolver = null;
          reject(error);
        });
    });
  }

  handleManualAuthCodeInput(authorizationCode: string, state: string): void {
    if (this.manualAuthCodeResolver) {
      this.manualAuthCodeResolver(authorizationCode);
      this.manualAuthCodeResolver = null;
      this.authCodeListener?.close();
    }
  }

  private async openBrowser(url: string): Promise<void> {
    const { exec } = await import('node:child_process');
    const platform = process.platform;
    if (platform === 'darwin') {
      exec(`open "${url}"`);
    } else if (platform === 'linux') {
      exec(`xdg-open "${url}"`);
    } else if (platform === 'win32') {
      exec(`start "${url}"`);
    }
  }

  cleanup(): void {
    this.authCodeListener?.close();
    this.manualAuthCodeResolver = null;
  }
}

export const oauthService = new OAuthService();