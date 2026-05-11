// TIMPS Code — LSP Manager
// Language Server Protocol integration for code intelligence

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface LspServerConfig {
  name: string;
  command: string;
  args?: string[];
  filetypes?: string[];
  rootPatterns?: string[];
}

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspLocation {
  uri: string;
  range: {
    start: LspPosition;
    end: LspPosition;
  };
}

export interface LspTextDocument {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface InitializationStatus {
  status: 'pending' | 'initializing' | 'ready' | 'error';
  serverName?: string;
  error?: string;
}

const DEFAULT_SERVERS: LspServerConfig[] = [
  { name: 'typescript', command: 'typescript-language-server', args: ['--stdio'], filetypes: ['typescript', 'javascript'] },
  { name: 'python', command: 'python', args: ['-m', 'pyright-langserver', '--stdio'], filetypes: ['python'] },
  { name: 'rust', command: 'rust-analyzer', args: [], filetypes: ['rust'] },
  { name: 'go', command: 'gopls', args: [], filetypes: ['go'] },
  { name: 'json', command: 'vscode-json-languageserver', args: ['--stdio'], filetypes: ['json'] },
  { name: 'html', command: 'vscode-html-languageserver', args: ['--stdio'], filetypes: ['html', 'htm'] },
  { name: 'css', command: 'vscode-css-languageserver', args: ['--stdio'], filetypes: ['css', 'scss', 'less'] },
];

class LspServer {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  private documentVersions = new Map<string, number>();
  public readonly config: LspServerConfig;
  public readonly supportedFiletypes: Set<string>;

  constructor(config: LspServerConfig) {
    this.config = config;
    this.supportedFiletypes = new Set(config.filetypes || []);
  }

  start(rootPath: string): void {
    if (this.process) return;

    try {
      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootPath,
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleMessage(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error(`[LSP ${this.config.name}]`, data.toString());
      });

      this.process.on('error', (err) => {
        console.error(`[LSP ${this.config.name}] Error:`, err.message);
      });

      this.process.on('exit', (code) => {
        console.log(`[LSP ${this.config.name}] Exited with code ${code}`);
        this.process = null;
      });

      this.sendInitialize(rootPath);
    } catch (err) {
      console.error(`Failed to start LSP server ${this.config.name}:`, err);
    }
  }

  private sendInitialize(rootPath: string): void {
    const initParams = {
      processId: process.pid,
      rootUri: `file://${rootPath}`,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          hover: {},
          definition: {},
          references: {},
          documentSymbol: {},
          implementation: {},
        },
        workspace: { symbol: {} },
      },
    };

    this.sendRequest('initialize', initParams).then(() => {
      this.sendNotification('initialized', {});
    }).catch((err) => {
      console.error(`[LSP ${this.config.name}] Initialize failed:`, err);
    });
  }

  sendRequest<T = unknown>(method: string, params: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.process?.stdin?.write(JSON.stringify(message) + '\n');

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 10000);
    });
  }

  sendNotification(method: string, params: unknown): void {
    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.process?.stdin?.write(JSON.stringify(message) + '\n');
  }

  private handleMessage(data: string): void {
    const lines = data.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if ('id' in msg && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message || 'LSP error'));
          } else {
            pending.resolve(msg.result);
          }
        }
      } catch {
        // Ignore parse errors for non-JSON output
      }
    }
  }

  openDocument(uri: string, text: string): void {
    const version = (this.documentVersions.get(uri) || 0) + 1;
    this.documentVersions.set(uri, version);

    this.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: this.getLanguageId(uri), version, text },
    });
  }

  closeDocument(uri: string): void {
    this.sendNotification('textDocument/didClose', { textDocument: { uri } });
  }

  private getLanguageId(uri: string): string {
    const ext = path.extname(uri).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript',
      '.jsx': 'javascript', '.py': 'python', '.rs': 'rust', '.go': 'go',
      '.json': 'json', '.html': 'html', '.css': 'css', '.md': 'markdown',
    };
    return langMap[ext] || 'plaintext';
  }

  async gotoDefinition(uri: string, line: number, character: number): Promise<LspLocation[]> {
    const result = await this.sendRequest<LspLocation[]>('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
    return result || [];
  }

  async findReferences(uri: string, line: number, character: number): Promise<LspLocation[]> {
    const result = await this.sendRequest<LspLocation[]>('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
    return result || [];
  }

  async getHover(uri: string, line: number, character: number): Promise<{ contents: string } | null> {
    const result = await this.sendRequest<{ contents: string | { kind: string; value: string } }>('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
    if (!result || !result.contents) return null;
    return typeof result.contents === 'string' 
      ? { contents: result.contents } 
      : { contents: result.contents.value || '' };
  }

  async getDocumentSymbols(uri: string): Promise<unknown[]> {
    const result = await this.sendRequest('textDocument/documentSymbol', { textDocument: { uri } });
    return Array.isArray(result) ? result : [];
  }

  async searchSymbols(query: string): Promise<unknown[]> {
    const result = await this.sendRequest('workspace/symbol', { query });
    return Array.isArray(result) ? result : [];
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}

export class LspServerManager extends EventEmitter {
  private servers = new Map<string, LspServer>();
  private status: InitializationStatus = { status: 'pending' };
  private openDocuments = new Map<string, string>();

  async initialize(rootPath: string, servers?: LspServerConfig[]): Promise<void> {
    this.status = { status: 'initializing' };

    const serverConfigs = servers || DEFAULT_SERVERS;

    for (const config of serverConfigs) {
      const server = new LspServer(config);
      try {
        server.start(rootPath);
        this.servers.set(config.name, server);
      } catch {
        console.warn(`Failed to start LSP server: ${config.name}`);
      }
    }

    this.status = { status: 'ready' };
    this.emit('initialized');
  }

  async sendRequest<T = unknown>(
    filePath: string,
    method: string,
    params: unknown,
  ): Promise<T | undefined> {
    const server = this.getServerForFile(filePath);
    if (!server) return undefined;

    if (!this.openDocuments.has(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => '');
      server.openDocument(`file://${filePath}`, content);
      this.openDocuments.set(filePath, content);
    }

    return server.sendRequest<T>(method, params);
  }

  async openFile(filePath: string, content: string): Promise<void> {
    const server = this.getServerForFile(filePath);
    if (server) {
      server.openDocument(`file://${filePath}`, content);
      this.openDocuments.set(filePath, content);
    }
  }

  async closeFile(filePath: string): Promise<void> {
    const server = this.getServerForFile(filePath);
    if (server) {
      server.closeDocument(`file://${filePath}`);
      this.openDocuments.delete(filePath);
    }
  }

  isFileOpen(filePath: string): boolean {
    return this.openDocuments.has(filePath);
  }

  getServerForFile(filePath: string): LspServer | undefined {
    const ext = path.extname(filePath).toLowerCase();
    const serverByExt: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
      '.py': 'python', '.rs': 'rust', '.go': 'go', '.json': 'json',
      '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'css',
    };
    const serverName = serverByExt[ext];
    return serverName ? this.servers.get(serverName) : undefined;
  }

  getStatus(): InitializationStatus {
    return this.status;
  }

  async waitForInitialization(): Promise<void> {
    if (this.status.status === 'ready') return;
    return new Promise((resolve) => {
      this.once('initialized', resolve);
    });
  }

  shutdown(): void {
    for (const server of this.servers.values()) {
      server.stop();
    }
    this.servers.clear();
    this.status = { status: 'pending' };
  }

  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  isServerRunning(name: string): boolean {
    const server = this.servers.get(name);
    return server?.isRunning() ?? false;
  }
}

let lspManager: LspServerManager | null = null;

export function getLspServerManager(): LspServerManager | null {
  return lspManager;
}

export async function initializeLsp(rootPath: string): Promise<LspServerManager> {
  if (lspManager) {
    return lspManager;
  }
  lspManager = new LspServerManager();
  await lspManager.initialize(rootPath);
  return lspManager;
}

export function getInitializationStatus(): InitializationStatus {
  return lspManager?.getStatus() ?? { status: 'pending' };
}

export function isLspConnected(): boolean {
  return lspManager?.getStatus().status === 'ready';
}

export async function waitForInitialization(): Promise<void> {
  await lspManager?.waitForInitialization();
}

export { LspServer };
export { availableServers } from './servers.js';