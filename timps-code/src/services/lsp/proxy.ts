// TIMPS LSP — Proxy Server
// Sits between editor and real language server, enriches with TIMPS memory data

import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  LspRequest, LspResponse, LspNotification,
  LspInitializeParams, LspServerCapabilities,
  LspDefinitionParams, LspHoverParams,
  LspDidOpenParams, LspDidChangeParams, LspDidCloseParams, LspDidSaveParams,
  LspPublishDiagnosticsParams,
  LspDiagnostic, DiagnosticSeverity, DiagnosticTag,
  TextDocumentSyncKind,
  LspLocation, LspLocationLink, LspHover, LspMarkupContent,
  encodeLspMessage, decodeLspMessages,
} from './protocol.js';

export interface MemoryClient {
  recall(query: string, options?: { limit?: number }): Promise<{ content: string; metadata: Record<string, unknown>; score: number }[]>;
  checkContradiction(statement: string): Promise<{ contradicts: boolean; confidence: number; conflictingMemory?: string; severity?: string }>;
  checkBugPattern(content: string, file: string): Promise<{ matches: boolean; patterns: { name: string; description: string; severity: string }[] }>;
}

export interface LspProxyConfig {
  serverCommand: string;
  serverArgs?: string[];
  languageId: string;
  memoryClient: MemoryClient;
  debounceMs?: number;
  contradictionSeverity?: 'error' | 'warning' | 'information';
  enabled?: boolean;
}

interface OpenDocument {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export class LspProxyServer {
  private realServer: ChildProcess | null = null;
  private realServerProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  private serverCapabilities: LspServerCapabilities = {};
  private documents = new Map<string, OpenDocument>();
  private initializeParams: LspInitializeParams | null = null;
  private initialized = false;
  private config: LspProxyConfig;
  private memoryClient: MemoryClient;
  private incomingBuffer = '';
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastDiagnostics = new Map<string, LspDiagnostic[]>();

  // Callbacks for sending messages back to the editor
  onSend: ((msg: string) => void) | null = null;

  constructor(config: LspProxyConfig) {
    this.config = {
      debounceMs: 2000,
      contradictionSeverity: 'warning',
      enabled: true,
      ...config,
    };
    this.memoryClient = config.memoryClient;
  }

  start(rootPath: string): void {
    if (this.realServerProcess) return;
    this.launchRealServer(rootPath);
  }

  private launchRealServer(rootPath: string): void {
    try {
      this.realServerProcess = spawn(
        this.config.serverCommand,
        this.config.serverArgs || ['--stdio'],
        { stdio: ['pipe', 'pipe', 'pipe'], cwd: rootPath }
      );

      this.realServerProcess.stdout?.on('data', (data: Buffer) => {
        this.handleRealServerResponse(data.toString());
      });

      this.realServerProcess.stderr?.on('data', (data: Buffer) => {
        // Most language servers log to stderr — forward for debugging
        if (this.config.languageId !== 'typescript' || !data.toString().includes('[Info')) {
          // silently absorb most stderr (language servers are chatty)
        }
      });

      this.realServerProcess.on('error', (err) => {
        console.error(`[TIMPS LSP:${this.config.languageId}] Real server error:`, err.message);
      });

      this.realServerProcess.on('exit', (code) => {
        console.warn(`[TIMPS LSP:${this.config.languageId}] Real server exited (${code})`);
        this.realServerProcess = null;
        this.initialized = false;
      });
    } catch (err) {
      console.error(`[TIMPS LSP:${this.config.languageId}] Failed to start real server:`, err);
    }
  }

  // Called when editor sends a request to the TIMPS LSP proxy
  handleEditorMessage(raw: string): void {
    this.incomingBuffer += raw;
    const msgs = decodeLspMessages(this.incomingBuffer);
    this.incomingBuffer = '';

    for (const msg of msgs) {
      if ('id' in msg && 'method' in msg) {
        void this.handleRequest(msg as LspRequest);
      } else if ('method' in msg) {
        void this.handleNotification(msg as LspNotification);
      } else if ('id' in msg) {
        this.handleResponse(msg as LspResponse);
      }
    }
  }

  private async handleRequest(request: LspRequest): Promise<void> {
    switch (request.method) {
      case 'initialize':
        await this.handleInitialize(request);
        break;
      case 'textDocument/definition':
        await this.handleDefinitionProxy(request);
        break;
      case 'textDocument/hover':
        await this.handleHoverProxy(request);
        break;
      default:
        this.forwardToRealServer(request);
        break;
    }
  }

  private async handleNotification(notification: LspNotification): Promise<void> {
    switch (notification.method) {
      case 'initialized':
        this.initialized = true;
        this.forwardToRealServerNotification(notification);
        break;
      case 'textDocument/didOpen':
        this.handleDidOpen(notification.params as LspDidOpenParams);
        this.forwardToRealServerNotification(notification);
        break;
      case 'textDocument/didChange':
        this.handleDidChange(notification.params as LspDidChangeParams);
        this.forwardToRealServerNotification(notification);
        break;
      case 'textDocument/didClose':
        this.handleDidClose(notification.params as LspDidCloseParams);
        this.forwardToRealServerNotification(notification);
        break;
      case 'textDocument/didSave':
        this.handleDidSave(notification.params as LspDidSaveParams);
        this.forwardToRealServerNotification(notification);
        break;
      default:
        this.forwardToRealServerNotification(notification);
        break;
    }
  }

  private handleResponse(response: LspResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    this.pendingRequests.delete(response.id);
    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  // ── Initialization ──────────────────────────────────────────

  private async handleInitialize(request: LspRequest): Promise<void> {
    this.initializeParams = request.params as LspInitializeParams;

    // Initialize the real server (gracefully handle if not running)
    let realCapabilities: LspServerCapabilities = {};
    try {
      const result = await this.forwardToRealServerWait(request);
      realCapabilities = (result as LspServerCapabilities) || {};
    } catch {
      // Real server not available — TIMPS LSP still works with memory-only features
    }

    // Merge capabilities — TIMPS LSP adds its own on top
    this.serverCapabilities = realCapabilities;

    // Enhance capabilities with TIMPS features
    this.serverCapabilities.definitionProvider = true;
    this.serverCapabilities.hoverProvider = true;

    // Add diagnostic provider capability if language server protocol supports it
    // We publish diagnostics via notification, so we don't need the capability
    // unless the client supports the pull model

    // Send response back to editor
    this.sendToEditor(encodeLspMessage({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        capabilities: this.serverCapabilities,
        serverInfo: {
          name: `TIMPS LSP Proxy (${this.config.languageId})`,
          version: '1.0.0',
        },
      },
    }));
  }

  // ── Definition Handler ──────────────────────────────────────

  private async handleDefinitionProxy(request: LspRequest): Promise<void> {
    try {
      const params = request.params as LspDefinitionParams;
      let realResult: LspLocation | LspLocation[] | LspLocationLink[] | null = null;
      try {
        realResult = await this.forwardToRealServerWait({
          ...request,
          method: 'textDocument/definition',
        }) as LspLocation | LspLocation[] | LspLocationLink[] | null;
      } catch {
        // Real server not available — return memory-only definition results
      }

      const definitions: (LspLocation | LspLocationLink)[] = Array.isArray(realResult)
        ? realResult
        : realResult ? [realResult] : [];

      const fileUri = params.textDocument.uri;
      const fileName = path.basename(fileUri);

      // Enrich with TIMPS navigational memory
      let relatedFiles: { uri: string; label: string; visitCount: number; relevance: number }[] = [];
      try {
        const memories = await this.memoryClient.recall(fileName, { limit: 5 });
        relatedFiles = memories
          .filter(m => m.metadata?.fileUri && m.metadata?.fileUri !== fileUri)
          .map(m => ({
            uri: m.metadata.fileUri as string,
            label: m.content,
            visitCount: (m.metadata.visitCount as number) || 0,
            relevance: m.score,
          }));
      } catch {
        // Memory server unavailable — return standard definitions
      }

      // Attach related files as data on the definition result
      const enriched = definitions.map(loc => {
        if ('uri' in loc) {
          return { ...loc, data: relatedFiles.length > 0 ? { relatedFiles } : undefined };
        }
        return loc;
      });

      this.sendToEditor(encodeLspMessage({
        jsonrpc: '2.0',
        id: request.id,
        result: enriched,
      }));
    } catch (err) {
      this.sendToEditor(encodeLspMessage({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: String(err) },
      }));
    }
  }

  // ── Hover Handler ──────────────────────────────────────────

  private async handleHoverProxy(request: LspRequest): Promise<void> {
    try {
      const params = request.params as LspHoverParams;
      let realResult: LspHover | null = null;
      try {
        realResult = await this.forwardToRealServerWait({
          ...request,
          method: 'textDocument/hover',
        }) as LspHover | null;
      } catch {
        // Real server not available — memory-only hover
      }

      // Enrich with TIMPS memory context
      let memoryContext = '';
      try {
        const filePath = params.textDocument.uri;
        const fileName = path.basename(filePath);
        const lineContent = this.getLineContent(filePath, params.position.line);

        const memories = await this.memoryClient.recall(
          lineContent || fileName,
          { limit: 3 }
        );

        if (memories.length > 0) {
          memoryContext = '\n\n---\n🧠 **TIMPS Memory:**\n' +
            memories.map((m, i) =>
              `• ${m.content}${m.metadata?.timestamp ? ` _(${String(m.metadata.timestamp)})_` : ''}`
            ).join('\n');
        }
      } catch {
        // Memory server unavailable — return standard hover only
      }

      const hoverResult: LspHover = realResult || { contents: { kind: 'plaintext', value: '' } };

      if (memoryContext) {
        const existing = this.hoverToString(hoverResult.contents);
        hoverResult.contents = {
          kind: 'markdown',
          value: existing + memoryContext,
        };
      }

      this.sendToEditor(encodeLspMessage({
        jsonrpc: '2.0',
        id: request.id,
        result: hoverResult,
      }));
    } catch (err) {
      this.sendToEditor(encodeLspMessage({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: String(err) },
      }));
    }
  }

  // ── Document Sync Handlers ─────────────────────────────────

  private handleDidOpen(params: LspDidOpenParams): void {
    const doc = params.textDocument;
    this.documents.set(doc.uri, {
      uri: doc.uri,
      languageId: doc.languageId,
      version: doc.version,
      text: doc.text,
    });
  }

  private handleDidChange(params: LspDidChangeParams): void {
    const existing = this.documents.get(params.textDocument.uri);
    if (!existing) return;

    existing.version = params.textDocument.version;

    // Apply incremental changes or full replacement
    for (const change of params.contentChanges) {
      if (!change.range) {
        existing.text = change.text;
      } else {
        // Incremental update
        const lines = existing.text.split('\n');
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;
        const startChar = change.range.start.character;
        const endChar = change.range.end.character;

        if (startLine === endLine) {
          const line = lines[startLine];
          lines[startLine] = line.substring(0, startChar) + change.text + line.substring(endChar);
        } else {
          const before = lines.slice(0, startLine);
          const after = lines.slice(endLine + 1);
          const startPart = lines[startLine].substring(0, startChar);
          const endPart = lines[endLine].substring(endChar);
          before.push(startPart + change.text + endPart);
          existing.text = [...before, ...after].join('\n');
        }
        existing.text = lines.join('\n');
      }
    }

    // Debounced contradiction check
    this.scheduleContradictionCheck(params.textDocument.uri);
  }

  private handleDidClose(params: LspDidCloseParams): void {
    this.documents.delete(params.textDocument.uri);
    this.lastDiagnostics.delete(params.textDocument.uri);

    // Clear debounce timer
    const timer = this.debounceTimers.get(params.textDocument.uri);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(params.textDocument.uri);
    }
  }

  private async handleDidSave(params: LspDidSaveParams): Promise<void> {
    // Bug pattern check on save
    const doc = this.documents.get(params.textDocument.uri);
    if (!doc || !this.config.enabled) return;

    try {
      const result = await this.memoryClient.checkBugPattern(
        this.getLastLines(doc.text, 200),
        path.basename(doc.uri)
      );

      if (result.matches && result.patterns.length > 0) {
        const diagnostics: LspDiagnostic[] = result.patterns.map(p => {
          const line = this.findRelevantLine(doc.text, p.name);
          return {
            range: {
              start: { line, character: 0 },
              end: { line, character: this.getLineLength(doc.text, line) },
            },
            severity: p.severity === 'error' ? DiagnosticSeverity.Error
              : p.severity === 'warning' ? DiagnosticSeverity.Warning
              : DiagnosticSeverity.Information,
            message: `[TIMPS] Bug pattern detected: ${p.name} — ${p.description}`,
            source: 'TIMPS',
            code: 'bug-pattern',
          };
        });

        if (diagnostics.length > 0) {
          this.publishDiagnostics(doc.uri, diagnostics);
        }
      }
    } catch {
      // bug pattern check failed silently
    }
  }

  // ── Contradiction Diagnostics ──────────────────────────────

  private scheduleContradictionCheck(uri: string): void {
    const existing = this.debounceTimers.get(uri);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(uri);
      void this.runContradictionCheck(uri);
    }, this.config.debounceMs || 2000);

    this.debounceTimers.set(uri, timer);
  }

  private async runContradictionCheck(uri: string): Promise<void> {
    const doc = this.documents.get(uri);
    if (!doc || !this.config.enabled) return;

    // Only check semantic content — skip if unchanged
    const lastCheck = this.lastDiagnostics.get(uri);
    const lastLength = lastCheck?.length || 0;

    // Check last 50 lines or the selection-relevant portion
    const checkContent = this.getLastLines(doc.text, 50);

    try {
      const result = await this.memoryClient.checkContradiction(checkContent);
      const diagnostics: LspDiagnostic[] = [];

      if (result.contradicts) {
        const severity = result.severity === 'error' ? DiagnosticSeverity.Error
          : result.severity === 'information' ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Warning;

        const msg = result.conflictingMemory
          ? `Contradicts stored memory: ${result.conflictingMemory}`
          : 'Contradicts known memory patterns';

        diagnostics.push({
          range: {
            start: { line: Math.max(0, doc.text.split('\n').length - 50), character: 0 },
            end: { line: doc.text.split('\n').length - 1, character: 0 },
          },
          severity,
          message: `[TIMPS] ${msg}`,
          source: 'TIMPS',
          code: 'contradiction',
        });
      }

      // Only publish if diagnostics changed
      const diagnosticKey = JSON.stringify(diagnostics);
      const lastKey = JSON.stringify(lastCheck);
      if (diagnosticKey !== lastKey) {
        this.publishDiagnostics(uri, diagnostics);
        this.lastDiagnostics.set(uri, diagnostics);
      }
    } catch {
      // contradiction check failed silently
    }
  }

  private publishDiagnostics(uri: string, diagnostics: LspDiagnostic[]): void {
    const params: LspPublishDiagnosticsParams = { uri, diagnostics };
    this.sendToEditor(encodeLspMessage({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params,
    }));
  }

  // ── Real Server Communication ──────────────────────────────

  private forwardToRealServer(request: LspRequest): void {
    this.sendToRealServer(encodeLspMessage({
      jsonrpc: '2.0',
      id: request.id,
      method: request.method,
      params: request.params,
    }));
  }

  private forwardToRealServerNotification(notification: LspNotification): void {
    const msg: LspNotification = {
      jsonrpc: '2.0',
      method: notification.method,
      params: notification.params,
    };
    this.sendToRealServer(encodeLspMessage(msg));
  }

  private forwardToRealServerWait(request: LspRequest, timeoutMs = 5000): Promise<unknown> {
    if (!this.realServerProcess?.stdin?.writable) {
      return Promise.reject(new Error('Real server not available'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      this.sendToRealServer(encodeLspMessage({
        jsonrpc: '2.0',
        id,
        method: request.method,
        params: request.params,
      }));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('TIMPS LSP: Real server request timed out'));
        }
      }, timeoutMs);
    });
  }

  private sendToRealServer(data: string): void {
    if (this.realServerProcess?.stdin?.writable) {
      this.realServerProcess.stdin.write(data);
    }
  }

  private sendToEditor(data: string): void {
    this.onSend?.(data);
  }

  private handleRealServerResponse(data: string): void {
    // Forward responses to pending requests
    const msgs = decodeLspMessages(data);
    for (const msg of msgs) {
      if ('id' in msg) {
        this.handleResponse(msg as LspResponse);
      }
      // Real server might publish diagnostics too — forward them
      if ('method' in msg && (msg as LspNotification).method === 'textDocument/publishDiagnostics') {
        this.sendToEditor(data);
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private getLineContent(uri: string, line: number): string {
    const doc = this.documents.get(uri);
    if (!doc) return '';
    const lines = doc.text.split('\n');
    return lines[line] || '';
  }

  private getLastLines(text: string, n: number): string {
    const lines = text.split('\n');
    return lines.slice(-n).join('\n');
  }

  private getLineLength(text: string, line: number): number {
    const lines = text.split('\n');
    return lines[line]?.length || 0;
  }

  private findRelevantLine(text: string, patternName: string): number {
    const lines = text.split('\n');
    const keywords = patternName.toLowerCase().split(/\s+/);
    let bestLine = 0;
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score += kw.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLine = i;
      }
    }
    return bestLine;
  }

  private hoverToString(contents: LspHover['contents']): string {
    if (!contents) return '';
    if (typeof contents === 'string') return contents;
    if (Array.isArray(contents)) {
      return contents.map(c => typeof c === 'string' ? c : c.value).join('\n');
    }
    if ('kind' in contents) {
      return (contents as LspMarkupContent).value;
    }
    if ('value' in contents) {
      return (contents as { language: string; value: string }).value;
    }
    return '';
  }

  stop(): void {
    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.documents.clear();
    this.lastDiagnostics.clear();

    if (this.realServerProcess) {
      this.realServerProcess.kill();
      this.realServerProcess = null;
    }
    this.initialized = false;
  }

  isRunning(): boolean {
    return this.realServerProcess !== null && this.initialized;
  }
}
