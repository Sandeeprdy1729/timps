// ── TIMPS Code — Remote Session Manager
// SSH and remote session support

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface RemoteSessionConfig {
  host: string;
  port?: number;
  user?: string;
  keyFile?: string;
  cwd?: string;
  timeout?: number;
}

export interface RemoteSession {
  id: string;
  config: RemoteSessionConfig;
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  startedAt: number;
  lastActivity?: number;
}

export class RemoteSessionManager extends EventEmitter {
  private sessions = new Map<string, RemoteSession>();
  private processes = new Map<string, ReturnType<typeof spawn>>();

  async connect(config: RemoteSessionConfig): Promise<string> {
    const sessionId = this.generateId();

    const session: RemoteSession = {
      id: sessionId,
      config,
      status: 'connecting',
      startedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionConnecting', session);

    try {
      await this.testConnection(config);
      session.status = 'connected';
      session.lastActivity = Date.now();
      this.emit('sessionConnected', session);
      this.persistSession(session);
      return sessionId;
    } catch (err) {
      session.status = 'error';
      this.emit('sessionError', session, err as Error);
      throw err;
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill();
      this.processes.delete(sessionId);
    }

    session.status = 'disconnected';
    this.emit('sessionDisconnected', session);
    this.removeSession(sessionId);
  }

  async executeRemote(
    sessionId: string,
    command: string,
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const { host, port = 22, user, keyFile } = session.config;
    const timeout = options.timeout || 30000;
    const workDir = options.cwd || session.config.cwd || process.cwd();

    const sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-p', String(port),
    ];

    if (keyFile) {
      sshArgs.push('-i', keyFile);
    }

    const target = user ? `${user}@${host}` : host;
    const remoteCmd = `cd "${workDir}" && ${command}`;

    return new Promise((resolve, reject) => {
      const proc = spawn('ssh', [...sshArgs, target, remoteCmd], {
        timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          session.lastActivity = Date.now();
          resolve(stdout);
        } else {
          reject(new Error(stderr || `SSH exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  async startInteractive(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const { host, port = 22, user, keyFile, cwd } = session.config;
    const workDir = cwd || process.cwd();

    const sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-t',
      '-p', String(port),
    ];

    if (keyFile) {
      sshArgs.push('-i', keyFile);
    }

    const target = user ? `${user}@${host}` : host;

    const proc = spawn('ssh', [...sshArgs, target, `cd "${workDir}" && timps`], {
      stdio: 'inherit',
    });

    this.processes.set(sessionId, proc);

    proc.on('close', () => {
      session.status = 'disconnected';
      this.emit('sessionDisconnected', session);
    });
  }

  getSession(sessionId: string): RemoteSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): RemoteSession[] {
    return Array.from(this.sessions.values());
  }

  private async testConnection(config: RemoteSessionConfig): Promise<void> {
    const { host, port = 22, user, keyFile, timeout = 10000 } = config;

    return new Promise((resolve, reject) => {
      const sshArgs = [
        '-o', 'ConnectTimeout=5',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', String(port),
        '-q',
      ];

      if (keyFile) {
        sshArgs.push('-i', keyFile);
      }

      const target = user ? `${user}@${host}` : host;
      sshArgs.push(target, 'exit');

      const proc = spawn('ssh', sshArgs, { timeout });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`SSH connection failed (exit code ${code})`));
      });

      proc.on('error', reject);

      setTimeout(() => {
        proc.kill();
        reject(new Error('SSH connection timeout'));
      }, timeout);
    });
  }

  private generateId(): string {
    return `remote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private persistSession(session: RemoteSession): void {
    try {
      const sessionDir = path.join(process.env.HOME || '', '.timps', 'sessions', 'remote');
      fs.mkdirSync(sessionDir, { recursive: true });
      const filePath = path.join(sessionDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        ...session,
        config: { ...session.config, keyFile: session.config.keyFile ? '<redacted>' : undefined },
      }, null, 2));
    } catch { /* ignore */ }
  }

  private removeSession(sessionId: string): void {
    try {
      const filePath = path.join(process.env.HOME || '', '.timps', 'sessions', 'remote', `${sessionId}.json`);
      fs.unlinkSync(filePath);
    } catch { /* ignore */ }
  }
}

let remoteManager: RemoteSessionManager | null = null;

export function getRemoteSessionManager(): RemoteSessionManager {
  if (!remoteManager) {
    remoteManager = new RemoteSessionManager();
  }
  return remoteManager;
}

export interface SshHostConfig {
  host: string;
  hostname?: string;
  port?: number;
  user?: string;
  identityFile?: string;
  strictHostKeyChecking?: string;
}

export function parseSshConfig(): Map<string, SshHostConfig> {
  const hosts = new Map<string, SshHostConfig>();

  try {
    const sshConfigPath = path.join(process.env.HOME || '', '.ssh', 'config');
    if (!fs.existsSync(sshConfigPath)) return hosts;

    const content = fs.readFileSync(sshConfigPath, 'utf-8');
    const lines = content.split('\n');

    let currentHost: string | null = null;
    let currentConfig: Partial<SshHostConfig> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('Host ')) {
        if (currentHost) {
          hosts.set(currentHost, currentConfig as SshHostConfig);
        }
        currentHost = trimmed.slice(4).trim();
        currentConfig = { host: currentHost };
      } else if (currentHost) {
        const [key, ...valueParts] = trimmed.split(/\s+/);
        const value = valueParts.join(' ');
        switch (key.toLowerCase()) {
          case 'hostname': currentConfig.hostname = value; break;
          case 'port': currentConfig.port = parseInt(value); break;
          case 'user': currentConfig.user = value; break;
          case 'identityfile': currentConfig.identityFile = value; break;
          case 'stricthostkeychecking': currentConfig.strictHostKeyChecking = value; break;
        }
      }
    }

    if (currentHost) {
      hosts.set(currentHost, currentConfig as SshHostConfig);
    }
  } catch { /* ignore */ }

  return hosts;
}
