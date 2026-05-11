// TIMPS Code — Session Manager
// Manages bridge sessions and handles session lifecycle

import { spawn, ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
import type {
  BridgeConfig,
  SessionHandle,
  SessionSpawnOpts,
  SessionActivity,
  SessionDoneStatus,
  BridgeLogger,
} from './types.js';

export interface SessionState {
  sessionId: string;
  startedAt: number;
  lastActivity: number;
  currentActivity: SessionActivity | null;
  activities: SessionActivity[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

class SessionHandleImpl implements SessionHandle {
  public sessionId: string;
  public done: Promise<SessionDoneStatus>;
  public activities: SessionActivity[] = [];
  public currentActivity: SessionActivity | null = null;
  public lastStderr: string[] = [];
  public accessToken: string;

  private _process: ChildProcess | null = null;
  private _killFn: (() => void) | undefined;
  private _forceKillFn: (() => void) | undefined;
  private _statusResolve: ((status: SessionDoneStatus) => void) | undefined;

  constructor(sessionId: string, accessToken: string) {
    this.sessionId = sessionId;
    this.accessToken = accessToken;

    let status: SessionDoneStatus = 'completed';
    this.done = new Promise<SessionDoneStatus>((resolve) => {
      this._statusResolve = (s) => { status = s; resolve(s); };
    });
  }

  kill(): void {
    this._killFn?.();
  }

  forceKill(): void {
    this._forceKillFn?.();
  }

  writeStdin(data: string): void {
    this._process?.stdin?.write(data + '\n');
  }

  updateAccessToken(token: string): void {
    this.accessToken = token;
  }

  updateActivity(summary: string, type: SessionActivity['type'] = 'text'): void {
    const activity: SessionActivity = {
      type,
      summary,
      timestamp: Date.now(),
    };
    this.activities.push(activity);
    this.currentActivity = activity;
    if (this.activities.length > 10) {
      this.activities.shift();
    }
  }

  setProcess(proc: ChildProcess): void {
    this._process = proc;
  }

  setKillFn(killFn: () => void, forceKillFn: () => void): void {
    this._killFn = killFn;
    this._forceKillFn = forceKillFn;
  }

  resolve(status: SessionDoneStatus): void {
    this._statusResolve?.(status);
  }
}

export class SessionManager {
  private sessions = new Map<string, SessionHandleImpl>();
  private config: BridgeConfig | null = null;
  private logger: BridgeLogger | null = null;

  setConfig(config: BridgeConfig): void {
    this.config = config;
  }

  setLogger(logger: BridgeLogger): void {
    this.logger = logger;
  }

  spawnSession(opts: SessionSpawnOpts, dir: string): SessionHandle {
    const handle = new SessionHandleImpl(opts.sessionId, opts.accessToken);

    const env: Record<string, string> = {
      ...process.env,
      TIMPS_SESSION_ID: opts.sessionId,
      TIMPS_SESSION_TOKEN: opts.accessToken,
      TIMPS_API_URL: opts.sdkUrl,
    };

    const proc = spawn('node', [
      '--eval',
      `
        const { createREPL } = require('./dist/repl.js');
        createREPL({ sessionId: '${opts.sessionId}', token: '${opts.accessToken}' });
      `,
    ], {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    handle.setProcess(proc);

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      handle.updateActivity(text, 'text');
      this.logger?.logVerbose(text);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      handle.lastStderr.push(text);
      if (handle.lastStderr.length > 50) handle.lastStderr.shift();
    });

    proc.on('exit', (code) => {
      const status: SessionDoneStatus = code === 0 ? 'completed' : code === -9 ? 'interrupted' : 'failed';
      handle.updateActivity(`Session exited with code ${code}`, 'error');
      handle.resolve(status);
    });

    proc.on('error', (err) => {
      handle.updateActivity(`Session error: ${err.message}`, 'error');
      handle.resolve('failed');
    });

    handle.setKillFn(
      () => {
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 5000);
      },
      () => {
        proc.kill('SIGKILL');
      }
    );

    this.sessions.set(opts.sessionId, handle);
    this.logger?.logSessionStart(opts.sessionId, '');

    return handle;
  }

  getSession(sessionId: string): SessionHandle | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): SessionHandle[] {
    return Array.from(this.sessions.values());
  }

  async killSession(sessionId: string, force: boolean = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (force) {
      session.forceKill();
    } else {
      session.kill();
    }

    await session.done;
    this.sessions.delete(sessionId);
  }

  async killAllSessions(force: boolean = false): Promise<void> {
    const killPromises = Array.from(this.sessions.keys()).map((id) =>
      this.killSession(id, force)
    );
    await Promise.all(killPromises);
  }

  getSessionState(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      currentActivity: session.currentActivity,
      activities: session.activities,
      status: 'running',
    };
  }

  listSessions(): SessionState[] {
    return Array.from(this.sessions.keys()).map((id) => this.getSessionState(id)!);
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger?.removeSession(sessionId);
  }
}

export const sessionManager = new SessionManager();