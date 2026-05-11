// TIMPS Code — OAuth Auth Code Listener
// Local HTTP server for capturing OAuth callbacks

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface OAuthConfig {
  AUTHORIZE_URL: string;
  TOKEN_URL: string;
  CLIENT_ID: string;
  MANUAL_REDIRECT_URL: string;
  SUCCESS_URL: string;
}

const DEFAULT_CONFIG: OAuthConfig = {
  AUTHORIZE_URL: 'https://anthropic.com/oauth/authorize',
  TOKEN_URL: 'https://anthropic.com/oauth/token',
  CLIENT_ID: 'timps-code-cli',
  MANUAL_REDIRECT_URL: 'urn:ietf:wg:oauth:2.0:oob',
  SUCCESS_URL: 'https://anthropic.com/oauth/success',
};

let globalOAuthConfig: OAuthConfig = DEFAULT_CONFIG;

export function setOAuthConfig(config: Partial<OAuthConfig>): void {
  globalOAuthConfig = { ...globalOAuthConfig, ...config };
}

export function getOAuthConfig(): OAuthConfig {
  return globalOAuthConfig;
}

export class AuthCodeListener {
  private localServer: Server;
  private port: number = 0;
  private promiseResolver: ((authorizationCode: string) => void) | null = null;
  private promiseRejecter: ((error: Error) => void) | null = null;
  private expectedState: string | null = null;
  private pendingResponse: ServerResponse | null = null;
  private callbackPath: string;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(callbackPath: string = '/callback') {
    this.localServer = createServer();
    this.callbackPath = callbackPath;
  }

  async start(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.localServer.once('error', (err) => {
        reject(new Error(`Failed to start OAuth callback server: ${err.message}`));
      });

      this.localServer.listen(port ?? 0, 'localhost', () => {
        const address = this.localServer.address() as AddressInfo;
        this.port = address.port;
        resolve(this.port);
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  hasPendingResponse(): boolean {
    return this.pendingResponse !== null;
  }

  async waitForAuthorization(
    state: string,
    onReady: () => Promise<void>,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.promiseResolver = resolve;
      this.promiseRejecter = reject;
      this.expectedState = state;
      this.startLocalListener(onReady);

      this.timeoutId = setTimeout(() => {
        reject(new Error('OAuth authorization timed out'));
      }, 5 * 60 * 1000);
    });
  }

  handleSuccessRedirect(scopes: string[]): void {
    if (!this.pendingResponse) return;
    this.pendingResponse.writeHead(302, { Location: getOAuthConfig().SUCCESS_URL });
    this.pendingResponse.end();
    this.pendingResponse = null;
  }

  handleErrorRedirect(): void {
    if (!this.pendingResponse) return;
    this.pendingResponse.writeHead(302, { Location: getOAuthConfig().SUCCESS_URL });
    this.pendingResponse.end();
    this.pendingResponse = null;
  }

  private startLocalListener(onReady: () => Promise<void>): void {
    this.localServer.on('request', this.handleRedirect.bind(this));
    this.localServer.on('error', this.handleError.bind(this));
    void onReady();
  }

  private handleRedirect(req: IncomingMessage, res: ServerResponse): void {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    if (parsedUrl.pathname !== this.callbackPath) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const authCode = parsedUrl.searchParams.get('code') ?? undefined;
    const state = parsedUrl.searchParams.get('state') ?? undefined;
    this.validateAndRespond(authCode, state, res);
  }

  private validateAndRespond(
    authCode: string | undefined,
    state: string | undefined,
    res: ServerResponse,
  ): void {
    if (!authCode) {
      res.writeHead(400);
      res.end('Authorization code not found');
      this.reject(new Error('No authorization code received'));
      return;
    }

    if (state !== this.expectedState) {
      res.writeHead(400);
      res.end('Invalid state parameter');
      this.reject(new Error('Invalid state parameter'));
      return;
    }

    this.pendingResponse = res;
    this.resolve(authCode);
  }

  private handleError(err: Error): void {
    console.error('OAuth server error:', err.message);
    this.close();
    this.reject(err);
  }

  private resolve(authorizationCode: string): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.promiseResolver) {
      this.promiseResolver(authorizationCode);
      this.promiseResolver = null;
      this.promiseRejecter = null;
    }
  }

  private reject(error: Error): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.promiseRejecter) {
      this.promiseRejecter(error);
      this.promiseResolver = null;
      this.promiseRejecter = null;
    }
  }

  close(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.pendingResponse) {
      this.handleErrorRedirect();
    }
    if (this.localServer) {
      this.localServer.removeAllListeners();
      this.localServer.close();
    }
  }
}