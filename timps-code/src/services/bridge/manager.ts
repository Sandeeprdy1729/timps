// TIMPS Code — Bridge Manager
// Main bridge orchestration and connection management

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  BridgeConfig,
  BridgeLogger,
  SessionHandle,
  WorkResponse,
} from './types.js';
import { getBridgeApiClient } from './bridgeApi.js';
import { sessionManager, SessionManager } from './sessionManager.js';
import { createTokenRefreshScheduler, parseWorkSecret } from './jwtUtils.js';
import { getBridgeAccessToken, getBridgeBaseUrl } from './bridgeConfig.js';

const BRIDGE_CONFIG_PATH = path.join(process.env.HOME || '', '.timps', 'bridge.json');

export class BridgeManager extends EventEmitter {
  private config: BridgeConfig | null = null;
  private apiClient = getBridgeApiClient();
  private sessionMgr: SessionManager;
  private logger: BridgeLogger | null = null;
  private pollAbortController: AbortController | null = null;
  private environmentId: string | null = null;
  private environmentSecret: string | null = null;
  private isRunning = false;
  private tokenRefreshScheduler: ReturnType<typeof createTokenRefreshScheduler> | null = null;

  constructor() {
    super();
    this.sessionMgr = sessionManager;
    this.setupTokenRefresh();
  }

  private setupTokenRefresh(): void {
    this.tokenRefreshScheduler = createTokenRefreshScheduler({
      getAccessToken: () => getBridgeAccessToken(),
      onRefresh: (sessionId, token) => {
        const session = this.sessionMgr.getSession(sessionId);
        if (session) {
          session.updateAccessToken(token);
        }
      },
      label: 'bridge',
    });
  }

  setLogger(logger: BridgeLogger): void {
    this.logger = logger;
    this.sessionMgr.setLogger(logger);
  }

  async initialize(config: Partial<BridgeConfig>): Promise<void> {
    const fullConfig: BridgeConfig = {
      dir: config.dir || process.cwd(),
      machineName: config.machineName || require('os').hostname(),
      branch: config.branch || await this.getCurrentBranch(),
      gitRepoUrl: config.gitRepoUrl || await this.getGitRepoUrl(),
      maxSessions: config.maxSessions || 5,
      spawnMode: config.spawnMode || 'single-session',
      verbose: config.verbose || false,
      sandbox: config.sandbox || false,
      bridgeId: (config as any).bridgeId || crypto.randomUUID(),
      workerType: config.workerType || 'timps_code',
      environmentId: config.environmentId || '',
      apiBaseUrl: config.apiBaseUrl || getBridgeBaseUrl(),
      sessionIngressUrl: config.sessionIngressUrl || getBridgeBaseUrl(),
      ...config,
    } as BridgeConfig;

    this.config = fullConfig;
    this.sessionMgr.setConfig(fullConfig);

    this.emit('initialized', fullConfig);
  }

  private async getCurrentBranch(): Promise<string> {
    try {
      const { execSync } = await import('node:child_process');
      return execSync('git branch --show-current', { encoding: 'utf-8', timeout: 5000 }).trim() || 'main';
    } catch {
      return 'main';
    }
  }

  private async getGitRepoUrl(): Promise<string | null> {
    try {
      const { execSync } = await import('node:child_process');
      const url = execSync('git remote get-url origin', { encoding: 'utf-8', timeout: 5000 }).trim();
      return url.replace(/\.git$/, '');
    } catch {
      return null;
    }
  }

  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Bridge not initialized. Call initialize() first.');
    }

    try {
      const result = await this.apiClient.registerBridgeEnvironment(this.config);
      this.environmentId = result.environment_id;
      this.environmentSecret = result.environment_secret;

      this.saveConfig();
      this.isRunning = true;
      this.emit('connected', this.environmentId);

      this.logger?.printBanner(this.config, this.environmentId);
      this.startPolling();
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    this.pollAbortController?.abort();

    await this.sessionMgr.killAllSessions();

    if (this.environmentId) {
      try {
        await this.apiClient.deregisterEnvironment(this.environmentId);
      } catch {
        // Best-effort
      }
    }

    this.tokenRefreshScheduler?.cancelAll();
    this.emit('disconnected');
  }

  private startPolling(): void {
    this.pollAbortController = new AbortController();

    const poll = async () => {
      if (!this.isRunning || !this.environmentId || !this.environmentSecret || !this.pollAbortController) return;

      try {
        const work = await this.apiClient.pollForWork(
          this.environmentId,
          this.environmentSecret,
          this.pollAbortController.signal,
        );

        if (work) {
          await this.handleWork(work);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[bridge] Poll error:', err);
        }
      }

      if (this.isRunning) {
        setTimeout(poll, 1000);
      }
    };

    poll();
  }

  private async handleWork(work: WorkResponse): Promise<void> {
    console.log(`[bridge] Received work: ${work.id}`);

    const secret = parseWorkSecret(work.secret);
    if (!secret) {
      console.error('[bridge] Failed to parse work secret');
      return;
    }

    if (secret.session_ingress_token) {
      this.tokenRefreshScheduler?.schedule(work.id, secret.session_ingress_token);
    }

    if (work.data.type === 'session') {
      const session = this.sessionMgr.spawnSession(
        {
          sessionId: work.id,
          sdkUrl: secret.api_base_url,
          accessToken: secret.session_ingress_token,
        },
        this.config?.dir || process.cwd(),
      );

      this.logger?.setSessionTitle(work.id, 'New Session');
    }
  }

  async killSession(sessionId: string, force: boolean = false): Promise<void> {
    await this.sessionMgr.killSession(sessionId, force);
    this.logger?.removeSession(sessionId);
  }

  getSessions(): SessionHandle[] {
    return this.sessionMgr.getAllSessions();
  }

  getSession(sessionId: string): SessionHandle | undefined {
    return this.sessionMgr.getSession(sessionId);
  }

  getEnvironmentId(): string | null {
    return this.environmentId;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private saveConfig(): void {
    if (!this.config) return;
    try {
      fs.mkdirSync(path.dirname(BRIDGE_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(BRIDGE_CONFIG_PATH, JSON.stringify({
        bridgeId: this.config.bridgeId,
        environmentId: this.environmentId,
        lastConnected: Date.now(),
      }, null, 2));
    } catch {
      // Best-effort
    }
  }

  async resume(): Promise<void> {
    if (!fs.existsSync(BRIDGE_CONFIG_PATH)) {
      throw new Error('No previous bridge session to resume');
    }

    try {
      const saved = JSON.parse(fs.readFileSync(BRIDGE_CONFIG_PATH, 'utf-8'));
      if (!saved.environmentId) {
        throw new Error('Invalid bridge configuration');
      }

      this.environmentId = saved.environmentId;
      this.isRunning = true;

      this.logger?.logStatus('Resuming bridge connection...');
      this.startPolling();
      this.emit('resumed', this.environmentId);
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
}

let bridgeManager: BridgeManager | null = null;

export function getBridgeManager(): BridgeManager {
  if (!bridgeManager) {
    bridgeManager = new BridgeManager();
  }
  return bridgeManager;
}