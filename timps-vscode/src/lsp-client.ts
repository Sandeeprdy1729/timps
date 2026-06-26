// TIMPS VS Code — LSP Client
// Starts the TIMPS LSP proxy server and bridges it to VS Code

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface LspMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export class TimpsLspClient implements vscode.Disposable {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private incomingBuffer = '';
  private disposables: vscode.Disposable[] = [];
  private diagnosticCollection: vscode.DiagnosticCollection;
  private enabled: boolean;
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('timps-lsp');
    this.enabled = vscode.workspace.getConfiguration('timps.lsp').get('enabled', true);
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.text = '$(database) TIMPS LSP';
    this.statusBarItem.tooltip = 'TIMPS Language Server';
    this.statusBarItem.command = 'timps.toggleLsp';
    this.statusBarItem.show();

    this.disposables.push(this.diagnosticCollection);
    this.disposables.push(this.statusBarItem);

    // Register diagnostic handler
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => {
        // Forward diagnostics from VS Code to TIMPS if needed
      })
    );

    // Listen for config changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('timps.lsp')) {
          this.enabled = vscode.workspace.getConfiguration('timps.lsp').get('enabled', true);
          this.statusBarItem.text = this.enabled
            ? '$(database) TIMPS LSP'
            : '$(database) TIMPS LSP (disabled)';
        }
      })
    );
  }

  async start(): Promise<void> {
    if (!this.enabled) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const extensionPath = vscode.extensions.getExtension('TIMPs.timps-ai-coding-agent')?.extensionPath
      || vscode.extensions.getExtension('timps.timps-ai-coding-agent')?.extensionPath
      || '';

    if (!extensionPath) {
      console.warn('[TIMPS LSP] Extension path not found — LSP features disabled');
      return;
    }

    // The TIMPS LSP proxy server entry point
    const proxyEntry = path.join(extensionPath, 'out', 'services', 'lsp', 'proxy.js');
    if (!fs.existsSync(proxyEntry)) {
      console.warn(`[TIMPS LSP] Proxy server not found at ${proxyEntry}`);
      return;
    }

    try {
      this.process = spawn(process.execPath, [proxyEntry, '--stdio'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootPath,
        env: {
          ...process.env,
          TIMPS_LSP_ROOT: rootPath,
          TIMPS_LSP_LANGUAGES: 'typescript,javascript,python,rust,go',
        },
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleServerMessage(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.debug('[TIMPS LSP]', data.toString().trim());
      });

      this.process.on('exit', (code) => {
        console.warn(`[TIMPS LSP] Proxy server exited (${code})`);
        this.process = null;
        this.statusBarItem.text = '$(database) TIMPS LSP (disconnected)';
      });

      this.process.on('error', (err) => {
        console.error('[TIMPS LSP] Failed to start:', err.message);
      });

      // Send initialize request
      const result = await this.sendRequest('initialize', {
        processId: process.pid,
        rootUri: `file://${rootPath}`,
        capabilities: {
          textDocument: {
            synchronization: {
              didSave: true,
              didChange: true,
              didOpen: true,
              didClose: true,
            },
            hover: {},
            definition: {},
            diagnostic: {},
          },
          workspace: {},
        },
      });

      if (result) {
        this.sendNotification('initialized', {});
        this.statusBarItem.text = '$(database) TIMPS LSP';
        console.log('[TIMPS LSP] Proxy server initialized');
      }

      // Open all currently open documents
      for (const doc of vscode.workspace.textDocuments) {
        if (!doc.isClosed) {
          this.openDocument(doc);
        }
      }
    } catch (err) {
      console.error('[TIMPS LSP] Initialization failed:', err);
    }
  }

  // ── Document Sync ──────────────────────────────────────────

  openDocument(doc: vscode.TextDocument): void {
    if (!this.process) return;
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: doc.uri.toString(),
        languageId: doc.languageId,
        version: doc.version,
        text: doc.getText(),
      },
    });
  }

  changeDocument(doc: vscode.TextDocument, contentChanges: readonly vscode.TextDocumentContentChangeEvent[]): void {
    if (!this.process) return;
    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: doc.uri.toString(),
        version: doc.version,
      },
      contentChanges: contentChanges.map(c => ({
        range: c.range ? {
          start: { line: c.range.start.line, character: c.range.start.character },
          end: { line: c.range.end.line, character: c.range.end.character },
        } : undefined,
        text: c.text,
      })),
    });
  }

  closeDocument(uri: string): void {
    if (!this.process) return;
    this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  saveDocument(doc: vscode.TextDocument): void {
    if (!this.process) return;
    this.sendNotification('textDocument/didSave', {
      textDocument: {
        uri: doc.uri.toString(),
      },
      text: doc.getText(),
    });
  }

  // ── LSP Handlers ──────────────────────────────────────────

  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      this.sendRaw(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request ${method} timed out`));
        }
      }, 10000);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    this.sendRaw(JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    }));
  }

  private sendRaw(json: string): void {
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n`;
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(header + json);
    }
  }

  private handleServerMessage(data: string): void {
    this.incomingBuffer += data;
    const parts = this.incomingBuffer.split('\r\n\r\n');

    // Keep the last partial part in the buffer
    this.incomingBuffer = parts.pop() || '';

    for (let i = 0; i < parts.length - 1; i += 2) {
      const header = parts[i];
      const body = parts[i + 1];
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) continue;

      const length = parseInt(lengthMatch[1], 10);
      if (body.length < length) {
        // Incomplete message — put it back
        this.incomingBuffer = parts[i] + '\r\n\r\n' + body + this.incomingBuffer;
        continue;
      }

      const raw = body.substring(0, length);
      try {
        const msg = JSON.parse(raw) as LspMessage;

        if (msg.id && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message));
          } else {
            pending.resolve(msg.result);
          }
        }

        if (msg.method === 'textDocument/publishDiagnostics') {
          this.handleDiagnostics(msg.params as {
            uri: string;
            diagnostics: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity?: number; message: string; source?: string; code?: string | number }[];
          });
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  private handleDiagnostics(params: {
    uri: string;
    diagnostics: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity?: number; message: string; source?: string; code?: string | number }[];
  }): void {
    const uri = vscode.Uri.parse(params.uri);
    const diagnostics: vscode.Diagnostic[] = params.diagnostics.map(d => {
      const range = new vscode.Range(
        d.range.start.line, d.range.start.character,
        d.range.end.line, d.range.end.character
      );
      const severity = d.severity === 1 ? vscode.DiagnosticSeverity.Error
        : d.severity === 2 ? vscode.DiagnosticSeverity.Warning
        : d.severity === 3 ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Hint;
      const diagnostic = new vscode.Diagnostic(range, d.message, severity);
      diagnostic.source = d.source || 'TIMPS';
      diagnostic.code = d.code;
      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  // ── Go-to-Definition Provider ──────────────────────────────

  registerDefinitionProvider(selector: vscode.DocumentSelector): vscode.Disposable {
    return vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition: async (doc, position) => {
        if (!this.process) return null;
        try {
          const result = await this.sendRequest('textDocument/definition', {
            textDocument: { uri: doc.uri.toString() },
            position: { line: position.line, character: position.character },
          }) as { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } }; data?: { relatedFiles: { uri: string; label: string; visitCount: number; relevance: number }[] } }[];

          if (!result || result.length === 0) return null;

          const locations = result.map(r => new vscode.Location(
            vscode.Uri.parse(r.uri),
            new vscode.Range(
              r.range.start.line, r.range.start.character,
              r.range.end.line, r.range.end.character
            )
          ));

          // Show related files if available
          if (result[0]?.data?.relatedFiles) {
            const related = result[0].data.relatedFiles;
            const items = related.map(rf => ({
              label: `$(file) ${path.basename(rf.uri)}`,
              description: `${rf.visitCount} visits`,
              detail: rf.label,
              uri: rf.uri,
            }));

            const picked = await vscode.window.showQuickPick(items, {
              placeHolder: 'Related files (TIMPS memory)',
              matchOnDescription: true,
            });

            if (picked?.uri) {
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(picked.uri));
              await vscode.window.showTextDocument(doc);
              return null;
            }
          }

          return locations;
        } catch {
          return null;
        }
      },
    });
  }

  // ── Hover Provider ─────────────────────────────────────────

  registerHoverProvider(selector: vscode.DocumentSelector): vscode.Disposable {
    return vscode.languages.registerHoverProvider(selector, {
      provideHover: async (doc, position) => {
        if (!this.process) return null;
        try {
          const result = await this.sendRequest('textDocument/hover', {
            textDocument: { uri: doc.uri.toString() },
            position: { line: position.line, character: position.character },
          }) as { contents: { kind?: string; value: string } | string; range?: { start: { line: number; character: number }; end: { line: number; character: number } } } | null;

          if (!result) return null;

          const contents = typeof result.contents === 'string'
            ? result.contents
            : (result.contents as { kind?: string; value: string }).value || '';

          const range = result.range
            ? new vscode.Range(
                result.range.start.line, result.range.start.character,
                result.range.end.line, result.range.end.character
              )
            : undefined;

          return new vscode.Hover(
            new vscode.MarkdownString(contents),
            range
          );
        } catch {
          return null;
        }
      },
    });
  }

  // ── Toggle ─────────────────────────────────────────────────

  toggle(): void {
    this.enabled = !this.enabled;
    vscode.workspace.getConfiguration('timps.lsp').update('enabled', this.enabled, true);
    this.statusBarItem.text = this.enabled
      ? '$(database) TIMPS LSP'
      : '$(database) TIMPS LSP (disabled)';

    if (!this.enabled) {
      this.diagnosticCollection.clear();
    }

    vscode.window.showInformationMessage(
      `TIMPS LSP ${this.enabled ? 'enabled' : 'disabled'}`
    );
  }

  dispose(): void {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
