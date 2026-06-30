import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { NexusForgeExplorerProvider } from './nexusExplorer';
import { SynapseMetabolonExplorerProvider } from './synapseExplorer';
import { registerMemoryView } from './memoryView';
import { TimpsMemoryPanelProvider } from './memory-panel';
import { MemoryWatcher } from './memory-watcher';
import { TimpsCompletionProvider } from './completion-provider';
import { ContradictionChecker } from './contradiction-checker';
import { TimpsClient } from './client/timpsClient';
import { TimpsLspClient } from './lsp-client';
import { TIMPS_THEME, TIMPS_ANIMATIONS, TIMPS_GLOBAL_RESET } from './design-tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
  status?: 'streaming' | 'done' | 'error';
  tokenCount?: number;
}

interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
}

interface TIMPSConfig {
  provider: string;
  model: string;
  ollamaUrl: string;
  openaiApiKey: string;
  geminiApiKey: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  autoContext: boolean;
}

// ─── Global State ─────────────────────────────────────────────────────────────

let chatProvider: TIMPSChatViewProvider | undefined;

// ─── Extension Activate ───────────────────────────────────────────────────────

let chronosVeilApiBase: string | undefined;

// ─── ChronosVeil integration ─────────────────────────────────────────────────
async function ingestToChronosVeil(content: string, sourceModule: string, tags: string[], entity?: string) {
  if (!chronosVeilApiBase) {
    const cfg = vscode.workspace.getConfiguration('timps');
    const userId = cfg.get<number>('userId', 1);
    chronosVeilApiBase = cfg.get<string>('apiBase', 'http://localhost:3000') + '/api';
  }
  try {
    await fetch(chronosVeilApiBase + '/chronos/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sourceModule,
        tags,
        entity,
        userId: 1,
        projectId: vscode.workspace.name || 'default',
      }),
    });
  } catch { /* non-critical */ }
}

function detectCodingEntities(content: string): string[] {
  const tags: string[] = ['code'];
  const lower = content.toLowerCase();
  if (/bug|error|crash|exception|failed/.test(lower)) tags.push('bug');
  if (/debt|legacy|refactor|complex/.test(lower)) tags.push('tech-debt');
  if (/api|endpoint|webhook|route/.test(lower)) tags.push('api');
  if (/test|fail|pass|assert/.test(lower)) tags.push('testing');
  if (/security|vuln|xss|injection/.test(lower)) tags.push('security');
  return tags;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('TIMPS AI Coding Agent activating...');

  chatProvider = new TIMPSChatViewProvider(context);
  const timpsClient = new TimpsClient();

  const cfg = vscode.workspace.getConfiguration('timps');
  const userId = cfg.get<number>('userId', 1);
  const apiBase = cfg.get<string>('apiBase', 'http://localhost:3000');
  const nexusExplorer = new NexusForgeExplorerProvider(context.extensionUri, userId, apiBase);
  const synapseExplorer = new SynapseMetabolonExplorerProvider(context.extensionUri, userId, apiBase);

  // ── Phase 5b: Memory Panel ──
  const memoryPanelProvider = new TimpsMemoryPanelProvider(context.extensionUri);

  // ── Phase 5b: Memory Watcher ──
  const memoryWatcher = new MemoryWatcher();
  memoryWatcher.setEnabled(cfg.get<boolean>('enableWatcher', true));

  // ── Phase 5b: Autocomplete Provider ──
  const completionProvider = new TimpsCompletionProvider();
  completionProvider.setEnabled(cfg.get<boolean>('enableAutocomplete', true));

  // ── Phase 5b: Contradiction Checker ──
  const contradictionChecker = new ContradictionChecker();
  contradictionChecker.setEnabled(cfg.get<boolean>('enableContradictionCheck', true));

  // ── Register Webview Providers ──
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('timps.chatView', chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider('timps.memoryPanel', memoryPanelProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider('timps.nexusForgeExplorer', nexusExplorer, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider('timps.synapseMetabolonExplorer', synapseExplorer, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // ── Register Completion Provider ──
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'typescript', scheme: 'file' },
        { language: 'javascript', scheme: 'file' },
        { language: 'python', scheme: 'file' },
        { language: 'rust', scheme: 'file' },
        { language: 'go', scheme: 'file' },
        { language: 'java', scheme: 'file' },
        { language: 'csharp', scheme: 'file' },
        { language: 'cpp', scheme: 'file' },
        { language: 'ruby', scheme: 'file' },
      ],
      completionProvider,
      '.',
      '(',
      ' ',
    )
  );

  // ── Register Contradiction Checker for disposal ──
  context.subscriptions.push(contradictionChecker);

  // ── Register Memory Watcher for disposal ──
  context.subscriptions.push(memoryWatcher);

  // ── Commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand('timps.openChat', () => {
      vscode.commands.executeCommand('timps.chatView.focus');
    }),

    vscode.commands.registerCommand('timps.newSession', () => {
      chatProvider?.newSession();
    }),

    vscode.commands.registerCommand('timps.clearHistory', () => {
      chatProvider?.clearHistory();
    }),

    vscode.commands.registerCommand('timps.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:sandeeprdy1729.timps-ai-coding-agent');
    }),

    vscode.commands.registerCommand('timps.askAboutSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      const prompt = `Please explain this ${lang} code:\n\`\`\`${lang}\n${selection}\n\`\`\``;
      chatProvider?.sendMessage(prompt);
      vscode.commands.executeCommand('timps.chatView.focus');
    }),

    vscode.commands.registerCommand('timps.explainCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      chatProvider?.sendMessage(`Explain this ${lang} code in detail:\n\`\`\`${lang}\n${selection}\n\`\`\``);
      vscode.commands.executeCommand('timps.chatView.focus');
    }),

    vscode.commands.registerCommand('timps.fixCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      chatProvider?.sendMessage(`Find and fix bugs in this ${lang} code:\n\`\`\`${lang}\n${selection}\n\`\`\``);
      vscode.commands.executeCommand('timps.chatView.focus');
    }),

    vscode.commands.registerCommand('timps.generateTests', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      chatProvider?.sendMessage(`Generate comprehensive unit tests for this ${lang} code:\n\`\`\`${lang}\n${selection}\n\`\`\``);
      vscode.commands.executeCommand('timps.chatView.focus');
    }),

    // ── Phase 5b: New Commands ──

    vscode.commands.registerCommand('timps.recall', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search memories (leave empty to browse all)',
        placeHolder: 'e.g. authentication pattern, bug fix, API design',
      });
      if (query === undefined) return;
      const memories = await timpsClient.recall(query || '', { limit: 20 });
      if (memories.length === 0) {
        vscode.window.showInformationMessage('TIMPS: No memories found');
        return;
      }
      const picks = memories.slice(0, 20).map(m => ({
        label: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
        description: `${m.type || 'memory'} · ${m.confidence ? Math.round(m.confidence * 100) + '%' : ''}`,
        detail: (m.tags || []).join(', '),
      }));
      await vscode.window.showQuickPick(picks, { placeHolder: `Found ${memories.length} memories` });
    }),

    vscode.commands.registerCommand('timps.showMemoryPanel', () => {
      vscode.commands.executeCommand('timps.memoryPanel.focus');
    }),

    vscode.commands.registerCommand('timps.checkContradictions', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('TIMPS: Open a file to check for contradictions');
        return;
      }
      const selection = editor.selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(editor.selection);
      const result = await timpsClient.checkContradiction(selection.slice(0, 1000));
      if (result?.hasContradiction) {
        vscode.window.showWarningMessage(
          `TIMPS: Found ${(result.entries || []).length} contradictory memories`,
          'View',
        ).then(btn => {
          if (btn === 'View') vscode.commands.executeCommand('timps.memoryPanel.focus');
        });
      } else {
        vscode.window.showInformationMessage('TIMPS: No contradictions found');
      }
    }),

    vscode.commands.registerCommand('timps.toggleAutocomplete', () => {
      const cfg = vscode.workspace.getConfiguration('timps');
      const current = cfg.get<boolean>('enableAutocomplete', true);
      cfg.update('enableAutocomplete', !current, vscode.ConfigurationTarget.Global);
      completionProvider.setEnabled(!current);
      vscode.window.showInformationMessage(`TIMPS autocomplete: ${current ? 'disabled' : 'enabled'}`);
    }),

    vscode.commands.registerCommand('timps.toggleWatcher', () => {
      const cfg = vscode.workspace.getConfiguration('timps');
      const current = cfg.get<boolean>('enableWatcher', true);
      cfg.update('enableWatcher', !current, vscode.ConfigurationTarget.Global);
      memoryWatcher.setEnabled(!current);
      vscode.window.showInformationMessage(`TIMPS edit watcher: ${current ? 'disabled' : 'enabled'}`);
    }),

    vscode.commands.registerCommand('timps.toggleContradictionCheck', () => {
      const cfg = vscode.workspace.getConfiguration('timps');
      const current = cfg.get<boolean>('enableContradictionCheck', true);
      cfg.update('enableContradictionCheck', !current, vscode.ConfigurationTarget.Global);
      contradictionChecker.setEnabled(!current);
      vscode.window.showInformationMessage(`TIMPS contradiction checking: ${current ? 'disabled' : 'enabled'}`);
    }),

    vscode.commands.registerCommand('timps.memoryStats', async () => {
      const stats = await timpsClient.getStats();
      if (!stats) {
        vscode.window.showInformationMessage('TIMPS: Unable to retrieve memory statistics');
        return;
      }
      vscode.window.showInformationMessage(
        `TIMPS: ${stats.total} memories · ${stats.layers} layers · ${stats.contradictions} contradictions · ${stats.velocity} commits/day`
      );
    })
  );

  // Memory View (9-layer memory TreeView)
  const memoryStorageRoot = context.globalStorageUri
    ? context.globalStorageUri.fsPath
    : path.join(os.homedir(), '.timps', 'vscode-memory');
  registerMemoryView(context, memoryStorageRoot);

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) TIMPS';
  statusBar.tooltip = 'Open TIMPS AI Chat';
  statusBar.command = 'timps.openChat';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Listen for config changes to update feature toggles
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('timps')) return;
      const cfg = vscode.workspace.getConfiguration('timps');
      completionProvider.setEnabled(cfg.get<boolean>('enableAutocomplete', true));
      memoryWatcher.setEnabled(cfg.get<boolean>('enableWatcher', true));
      contradictionChecker.setEnabled(cfg.get<boolean>('enableContradictionCheck', true));
    })
  );

  // ── Phase 5c: LSP Integration ──
  let lspClient: TimpsLspClient | undefined;
  if (cfg.get<boolean>('lsp.enabled', true)) {
    lspClient = new TimpsLspClient();
    void lspClient.start().then(() => {
      // Register definition and hover providers for supported languages
      const lspLanguages = [
        { language: 'typescript', scheme: 'file' },
        { language: 'javascript', scheme: 'file' },
        { language: 'python', scheme: 'file' },
        { language: 'rust', scheme: 'file' },
        { language: 'go', scheme: 'file' },
      ];

      if (lspClient) {
        context.subscriptions.push(lspClient.registerDefinitionProvider(lspLanguages));
        context.subscriptions.push(lspClient.registerHoverProvider(lspLanguages));
      }
    });

    // Wire document sync events
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(doc => lspClient?.openDocument(doc)),
      vscode.workspace.onDidChangeTextDocument(e => lspClient?.changeDocument(e.document, e.contentChanges)),
      vscode.workspace.onDidCloseTextDocument(doc => lspClient?.closeDocument(doc.uri.toString())),
      vscode.workspace.onDidSaveTextDocument(doc => lspClient?.saveDocument(doc)),
    );

    context.subscriptions.push(lspClient);
  }

  // ── Phase 5c: LSP Toggle Command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('timps.toggleLsp', () => {
      lspClient?.toggle();
    })
  );

  console.log('TIMPS AI Coding Agent activated (Phase 5b: Memory Panel, Autocomplete, Contradiction Checker, Edit Watcher; Phase 5c: LSP Proxy).');
}

export function deactivate() {}

// ─── Chat View Provider ───────────────────────────────────────────────────────

class TIMPSChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _sessions: Session[] = [];
  private _currentSessionId: string;
  private _abortController?: AbortController;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._currentSessionId = this._createSession();
    this._sessions = this._context.globalState.get<Session[]>('timps.sessions', []);
    if (this._sessions.length === 0) {
      this._sessions.push(this._newSession());
      this._currentSessionId = this._sessions[0].id;
    } else {
      this._currentSessionId = this._sessions[this._sessions.length - 1].id;
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri]
    };

    webviewView.webview.html = this._getHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'ready':
          this._sendToView({ type: 'init', sessions: this._sessions, currentSessionId: this._currentSessionId, config: this._getConfig() });
          break;
        case 'send':
          await this._handleUserMessage(msg.content, msg.sessionId);
          break;
        case 'stop':
          this._abortController?.abort();
          break;
        case 'newSession':
          this.newSession();
          break;
        case 'switchSession':
          this._currentSessionId = msg.sessionId;
          this._sendToView({ type: 'switchSession', sessionId: msg.sessionId });
          break;
        case 'deleteSession':
          this._deleteSession(msg.sessionId);
          break;
        case 'clearHistory':
          this.clearHistory();
          break;
        case 'copyCode':
          vscode.env.clipboard.writeText(msg.code);
          vscode.window.showInformationMessage('Code copied to clipboard');
          break;
        case 'insertCode':
          this._insertCodeToEditor(msg.code);
          break;
        case 'openSettings':
          vscode.commands.executeCommand('timps.openSettings');
          break;
        case 'getContext':
          this._sendCurrentFileContext();
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendToView({ type: 'init', sessions: this._sessions, currentSessionId: this._currentSessionId, config: this._getConfig() });
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  newSession() {
    const s = this._newSession();
    this._sessions.push(s);
    this._currentSessionId = s.id;
    this._saveSessions();
    this._sendToView({ type: 'newSession', session: s });
  }

  clearHistory() {
    const session = this._currentSession();
    if (session) {
      session.messages = [];
      this._saveSessions();
      this._sendToView({ type: 'clearHistory', sessionId: this._currentSessionId });
    }
  }

  sendMessage(content: string) {
    if (!this._view) { return; }
    this._sendToView({ type: 'externalMessage', content });
    this._handleUserMessage(content, this._currentSessionId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _createSession(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private _newSession(): Session {
    const config = this._getConfig();
    return {
      id: this._createSession(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      model: config.model
    };
  }

  private _currentSession(): Session | undefined {
    return this._sessions.find(s => s.id === this._currentSessionId);
  }

  private _deleteSession(sessionId: string) {
    this._sessions = this._sessions.filter(s => s.id !== sessionId);
    if (this._sessions.length === 0) {
      this._sessions.push(this._newSession());
    }
    if (this._currentSessionId === sessionId) {
      this._currentSessionId = this._sessions[this._sessions.length - 1].id;
    }
    this._saveSessions();
    this._sendToView({ type: 'init', sessions: this._sessions, currentSessionId: this._currentSessionId, config: this._getConfig() });
  }

  private _saveSessions() {
    // Keep last 20 sessions, max 50 messages each
    const trimmed = this._sessions.slice(-20).map(s => ({
      ...s,
      messages: s.messages.slice(-50)
    }));
    this._context.globalState.update('timps.sessions', trimmed);
  }

  private _getConfig(): TIMPSConfig {
    const cfg = vscode.workspace.getConfiguration('timps');
    return {
      provider: cfg.get('provider', 'ollama'),
      model: cfg.get('model', 'sandeeprdy1729/timps-coder'),
      ollamaUrl: cfg.get('ollamaUrl', 'http://localhost:11434'),
      openaiApiKey: cfg.get('openaiApiKey', ''),
      geminiApiKey: cfg.get('geminiApiKey', ''),
      maxTokens: cfg.get('maxTokens', 4096),
      temperature: cfg.get('temperature', 0.2),
      systemPrompt: cfg.get('systemPrompt', 'You are TIMPS-Coder, an expert AI coding assistant built by Sandeep Reddy (TIMPS). You help with coding, debugging, architecture, and explanations. Be concise, accurate, and practical.'),
      autoContext: cfg.get('autoContext', true)
    };
  }

  private _sendToView(msg: object) {
    this._view?.webview.postMessage(msg);
  }

  private _sendCurrentFileContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const doc = editor.document;
    const content = doc.getText();
    const lang = doc.languageId;
    const filename = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop() || 'file';
    this._sendToView({ type: 'fileContext', filename, language: lang, content: content.slice(0, 8000) });
  }

  private _insertCodeToEditor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor to insert code into.');
      return;
    }
    editor.edit(editBuilder => {
      editBuilder.replace(editor.selection, code);
    });
  }

  private _saveToChronosVeil(session: Session, userMsg: string, assistantMsg: string) {
    const content = `User: ${userMsg.slice(0, 200)}\n\nTIMPS: ${assistantMsg.slice(0, 300)}`;
    const tags = detectCodingEntities(content);
    const entity = vscode.window.activeTextEditor?.document.fileName.split('/').pop() || 'vscode';
    ingestToChronosVeil(content, 'timps-vscode', tags, entity);
    this._saveToNexusForge(userMsg, assistantMsg);
    this._saveToSynapseMetabolon(userMsg, assistantMsg);
  }

  private _saveToSynapseMetabolon(userMsg: string, assistantMsg: string) {
    const cfg = vscode.workspace.getConfiguration('timps');
    const apiBase = cfg.get<string>('apiBase', 'http://localhost:3000');
    const userId = cfg.get<number>('userId', 1);
    const content = `User: ${userMsg.slice(0, 200)}\n\nTIMPS: ${assistantMsg.slice(0, 300)}`;
    const tags = detectCodingEntities(content);
    const filename = vscode.window.activeTextEditor?.document.fileName.split('/').pop() || 'vscode';
    fetch(apiBase + '/api/synapse/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        projectId: vscode.workspace.name || 'default',
        content,
        tags,
        metadata: { source: 'timps-vscode', entity: filename },
        sourceModule: 'timps-vscode',
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  private _saveToNexusForge(userMsg: string, assistantMsg: string) {
    const cfg = vscode.workspace.getConfiguration('timps');
    const apiBase = cfg.get<string>('apiBase', 'http://localhost:3000');
    const userId = cfg.get<number>('userId', 1);
    const content = `User: ${userMsg.slice(0, 200)}\n\nTIMPS: ${assistantMsg.slice(0, 300)}`;
    const tags = detectCodingEntities(content);
    const filename = vscode.window.activeTextEditor?.document.fileName.split('/').pop() || 'vscode';
    fetch(apiBase + '/api/nexus/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        projectId: vscode.workspace.name || 'default',
        content,
        tags,
        metadata: { source: 'timps-vscode', entity: filename },
        sourceModule: 'timps-vscode',
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  private async _handleUserMessage(content: string, sessionId: string) {
    const session = this._sessions.find(s => s.id === sessionId) || this._currentSession();
    if (!session) { return; }

    const config = this._getConfig();

    // Auto-inject current file context if enabled
    let finalContent = content;
    if (config.autoContext) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !content.includes('```')) {
        const doc = editor.document;
        const filename = doc.fileName.split('/').pop() || '';
        const lang = doc.languageId;
        const fileContent = doc.getText().slice(0, 4000);
        finalContent = `${content}\n\n<context>\nCurrent file: ${filename} (${lang})\n\`\`\`${lang}\n${fileContent}\n\`\`\`\n</context>`;
      }
    }

    // Add user message to session
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,  // Store clean content
      timestamp: Date.now(),
      status: 'done'
    };
    session.messages.push(userMsg);

    // Update session title from first message
    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
    }

    // Add placeholder assistant message
    const assistantMsg: Message = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming'
    };
    session.messages.push(assistantMsg);

    this._sendToView({ type: 'userMessage', message: userMsg, sessionId });
    this._sendToView({ type: 'assistantStart', messageId: assistantMsg.id, sessionId });

    // Build message history for API
    const history = session.messages
      .filter(m => m.status === 'done' && m !== assistantMsg)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    // Replace last user content with context-injected version
    if (history.length > 0) {
      history[history.length - 1].content = finalContent;
    }

    this._abortController = new AbortController();

    try {
      await this._streamResponse(config, history, assistantMsg.id, (chunk: string) => {
        assistantMsg.content += chunk;
        this._sendToView({ type: 'assistantChunk', messageId: assistantMsg.id, chunk, sessionId });
      });

      assistantMsg.status = 'done';
      this._sendToView({ type: 'assistantDone', messageId: assistantMsg.id, content: assistantMsg.content, sessionId });
      this._saveSessions();
      this._saveToChronosVeil(session, userMsg.content, assistantMsg.content);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage === 'AbortError' || errorMessage.includes('aborted')) {
        assistantMsg.status = 'done';
        this._sendToView({ type: 'assistantStopped', messageId: assistantMsg.id, sessionId });
      } else {
        assistantMsg.status = 'error';
        assistantMsg.content = `Error: ${errorMessage}`;
        this._sendToView({ type: 'assistantError', messageId: assistantMsg.id, error: errorMessage, sessionId });
      }
      this._saveSessions();
    }
  }

  private async _streamResponse(
    config: TIMPSConfig,
    messages: { role: string; content: string }[],
    _messageId: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const allMessages = [
      { role: 'system', content: config.systemPrompt },
      ...messages
    ];

    switch (config.provider) {
      case 'ollama':
        return this._streamOllama(config, allMessages, onChunk);
      case 'openai':
        return this._streamOpenAI(config, allMessages, onChunk);
      case 'gemini':
        return this._streamGemini(config, messages, onChunk);
      default:
        return this._streamOllama(config, allMessages, onChunk);
    }
  }

  private _streamOllama(
    config: TIMPSConfig,
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/chat', config.ollamaUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const body = JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        options: { temperature: config.temperature, num_predict: config.maxTokens }
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      };

      const req = lib.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          for (const line of chunk.split('\n')) {
            if (!line.trim()) { continue; }
            try {
              const json = JSON.parse(line);
              if (json.message?.content) { onChunk(json.message.content); }
              if (json.done) { resolve(); }
            } catch {}
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });

      req.on('error', reject);
      this._abortController?.signal.addEventListener('abort', () => { req.destroy(); reject(new Error('AbortError')); });
      req.write(body);
      req.end();
    });
  }

  private _streamOpenAI(
    config: TIMPSConfig,
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages,
        stream: true,
        max_tokens: config.maxTokens,
        temperature: config.temperature
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          for (const line of chunk.split('\n')) {
            const data = line.replace(/^data: /, '').trim();
            if (!data || data === '[DONE]') { continue; }
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) { onChunk(content); }
            } catch {}
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });

      req.on('error', reject);
      this._abortController?.signal.addEventListener('abort', () => { req.destroy(); reject(new Error('AbortError')); });
      req.write(body);
      req.end();
    });
  }

  private _streamGemini(
    config: TIMPSConfig,
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const geminiMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const body = JSON.stringify({
        contents: geminiMessages,
        generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens }
      });

      const modelName = config.model || 'gemini-pro';
      const path = `/v1/models/${modelName}:streamGenerateContent?alt=sse`;

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-goog-api-key': config.geminiApiKey,
        },
      };

      const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          for (const line of chunk.split('\n')) {
            const data = line.replace(/^data: /, '').trim();
            if (!data) { continue; }
            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) { onChunk(text); }
            } catch {}
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });

      req.on('error', reject);
      this._abortController?.signal.addEventListener('abort', () => { req.destroy(); reject(new Error('AbortError')); });
      req.write(body);
      req.end();
    });
  }

  // ── HTML ────────────────────────────────────────────────────────────────────

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-timps-webview';">
<title>TIMPS AI</title>
<style>
/* ─── TIMPS Desktop Theme — Teal/Cream Robot Palette ─── */
${TIMPS_THEME}
${TIMPS_ANIMATIONS}
${TIMPS_GLOBAL_RESET}

body {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Header ─────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--timps-bg2);
  border-bottom: 1px solid var(--timps-border);
  gap: 8px;
  flex-shrink: 0;
}
.header-logo {
  display: flex;
  align-items: center;
  gap: 7px;
}
.logo-icon {
  width: 22px;
  height: 22px;
  background: var(--timps-accent);
  border-radius: var(--timps-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 11px;
  color: #fff;
  flex-shrink: 0;
}
.header-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--timps-text);
  letter-spacing: 0.04em;
}
.header-model {
  font-size: 10px;
  color: var(--timps-accent-hover);
  background: var(--timps-accent-light);
  padding: 2px 7px;
  border-radius: var(--timps-radius-sm);
  border: 1px solid var(--timps-border-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  font-family: var(--timps-font-mono);
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.icon-btn {
  background: none;
  border: none;
  color: var(--timps-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--timps-radius-sm);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  width: 26px;
  height: 26px;
}
.icon-btn:hover { color: var(--timps-text); background: var(--timps-bg3); }

/* ─── Session Tabs ─────────────────────────────────── */
.session-tabs {
  display: flex;
  overflow-x: auto;
  background: var(--timps-bg);
  border-bottom: 1px solid var(--timps-border);
  flex-shrink: 0;
  scrollbar-width: none;
}
.session-tabs::-webkit-scrollbar { display: none; }
.session-tab {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  font-size: 11px;
  color: var(--timps-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-right: 1px solid var(--timps-border);
  white-space: nowrap;
  max-width: 100px;
  transition: all 0.15s;
  font-family: var(--timps-font-mono);
}
.session-tab:hover { color: var(--timps-text); background: var(--timps-bg2); }
.session-tab.active { color: var(--timps-accent-hover); border-bottom-color: var(--timps-accent); background: var(--timps-bg2); }
.session-tab-title { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.session-tab-close { opacity: 0; font-size: 10px; padding: 1px 2px; border-radius: var(--timps-radius-sm); flex-shrink: 0; color: var(--timps-text-muted); }
.session-tab:hover .session-tab-close { opacity: 1; }
.session-tab-close:hover { background: rgba(200,56,56,0.2); color: var(--timps-error); }
.session-new-btn {
  flex-shrink: 0;
  padding: 5px 8px;
  color: var(--timps-text-muted);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
}
.session-new-btn:hover { color: var(--timps-accent-hover); }

/* ─── Messages Area ──────────────────────────────────── */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 24px 16px;
  text-align: center;
  gap: 10px;
}
.welcome-logo {
  width: 44px;
  height: 44px;
  background: var(--timps-accent);
  border-radius: var(--timps-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 18px;
  color: white;
  box-shadow: 0 0 24px var(--timps-accent-glow);
}
.welcome h2 {
  font-size: 14px;
  font-weight: 700;
  color: var(--timps-text);
  line-height: 1.3;
}
.welcome p {
  font-size: 11px;
  color: var(--timps-text-muted);
  line-height: 1.6;
  max-width: 220px;
}
.welcome-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
  margin-top: 4px;
}
.chip {
  background: var(--timps-bg3);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 4px 10px;
  font-size: 11px;
  color: var(--timps-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--timps-font-mono);
}
.chip:hover {
  border-color: var(--timps-accent);
  color: var(--timps-accent-hover);
  background: var(--timps-accent-light);
}

/* ─── Message Bubble ─────────────────────────────────── */
.message {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  animation: fadeSlide 0.15s ease;
}

.message.user {
  background: var(--timps-user-bg);
  border-left: 2px solid var(--timps-accent);
}
.message.assistant {
  background: var(--timps-bg);
  border-left: 2px solid var(--timps-accent-hover);
}
.message.error {
  border-left: 2px solid var(--timps-error);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.message-avatar {
  width: 16px;
  height: 16px;
  border-radius: var(--timps-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  flex-shrink: 0;
}
.message-avatar.user { background: var(--timps-bg3); color: var(--timps-text2); }
.message-avatar.assistant { background: var(--timps-accent); color: #fff; }
.message-role { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; font-family: var(--timps-font-mono); }
.message-role.user { color: var(--timps-text2); }
.message-role.assistant { color: var(--timps-accent); }
.message-time { font-size: 9px; color: var(--timps-text-muted); margin-left: auto; font-family: var(--timps-font-mono); }

.message-content {
  font-size: 13px;
  line-height: 1.65;
  color: var(--timps-text);
  word-break: break-word;
}
.message-content p { margin-bottom: 6px; }
.message-content p:last-child { margin-bottom: 0; }
.message-content strong { color: var(--timps-accent-hover); font-weight: 600; }
.message-content em { color: var(--timps-text2); font-style: italic; }
.message-content ul, .message-content ol { padding-left: 16px; margin-bottom: 6px; }
.message-content li { margin-bottom: 2px; }
.message-content h1, .message-content h2, .message-content h3 {
  color: var(--timps-text);
  margin: 8px 0 4px;
  font-weight: 600;
}
.message-content h1 { font-size: 15px; }
.message-content h2 { font-size: 14px; }
.message-content h3 { font-size: 13px; color: var(--timps-accent); }

/* Inline code */
.message-content code:not(pre code) {
  background: var(--timps-code-bg);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  padding: 1px 4px;
  font-family: var(--timps-font-mono);
  font-size: 11.5px;
  color: var(--timps-accent-hover);
}

/* ─── Code Blocks ─────────────────────────────────────── */
.code-block {
  background: var(--timps-code-bg);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  margin: 6px 0;
  overflow: hidden;
}
.code-block-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: rgba(45,90,79,0.12);
  border-bottom: 1px solid var(--timps-border);
  gap: 6px;
}
.code-lang {
  font-size: 10px;
  font-weight: 700;
  color: var(--timps-accent-hover);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-family: var(--timps-font-mono);
}
.code-actions { margin-left: auto; display: flex; gap: 4px; }
.code-btn {
  background: none;
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  color: var(--timps-text-muted);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 10px;
  transition: all 0.15s;
  font-family: var(--timps-font-mono);
}
.code-btn:hover { border-color: var(--timps-accent); color: var(--timps-accent-hover); background: var(--timps-accent-light); }
.code-block pre {
  padding: 8px 10px;
  overflow-x: auto;
  margin: 0;
}
.code-block code {
  font-family: var(--timps-font-mono);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--timps-text);
  white-space: pre;
}

/* ─── Streaming cursor ───────────────────────────────── */
.cursor {
  display: inline-block;
  width: 2px;
  height: 13px;
  background: var(--timps-accent);
  border-radius: 1px;
  animation: blink 1s infinite;
  vertical-align: middle;
  margin-left: 1px;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ─── Thinking indicator ─────────────────────────────── */
.thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--timps-text-muted);
  font-size: 12px;
  font-style: italic;
  padding: 4px 0;
}
.thinking-dots span {
  display: inline-block;
  width: 4px; height: 4px;
  background: var(--timps-accent);
  border-radius: 50%;
  animation: dotBounce 1.4s infinite;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

/* ─── Input Area ─────────────────────────────────────── */
.input-area {
  border-top: 1px solid var(--timps-border);
  background: var(--timps-bg2);
  flex-shrink: 0;
}
.context-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--timps-border);
  font-size: 10px;
  color: var(--timps-text-muted);
  font-family: var(--timps-font-mono);
}
.context-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--timps-accent);
  font-size: 10px;
}
.context-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--timps-accent);
  flex-shrink: 0;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 10px;
}
.input-wrap {
  flex: 1;
  position: relative;
  background: var(--timps-bg);
  border: 1px solid var(--timps-border);
  border-radius: var(--timps-radius-sm);
  transition: border-color 0.15s;
}
.input-wrap:focus-within { border-color: var(--timps-accent); box-shadow: 0 0 0 2px var(--timps-accent-light); }
textarea {
  width: 100%;
  background: none;
  border: none;
  color: var(--timps-text);
  font-size: 13px;
  font-family: var(--timps-font);
  line-height: 1.5;
  padding: 8px 10px;
  resize: none;
  outline: none;
  max-height: 120px;
  min-height: 34px;
}
textarea::placeholder { color: var(--timps-text-muted); }
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-top: 1px solid var(--timps-border);
}
.toolbar-btn {
  background: none;
  border: none;
  color: var(--timps-text-muted);
  cursor: pointer;
  padding: 2px 5px;
  border-radius: var(--timps-radius-sm);
  font-size: 10px;
  transition: color 0.15s;
  font-family: var(--timps-font-mono);
}
.toolbar-btn:hover { color: var(--timps-accent-hover); background: var(--timps-accent-light); }
.char-count {
  margin-left: auto;
  font-size: 9px;
  color: var(--timps-text-muted);
  font-family: var(--timps-font-mono);
}
.send-btn {
  width: 34px;
  height: 34px;
  background: var(--timps-accent);
  border: 1px solid var(--timps-border-light);
  border-radius: var(--timps-radius-sm);
  color: var(--timps-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.15s;
  font-weight: 700;
}
.send-btn:hover { background: var(--timps-accent-hover); }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.stop-btn {
  width: 34px;
  height: 34px;
  background: rgba(200,56,56,0.15);
  border: 1px solid rgba(200,56,56,0.3);
  border-radius: var(--timps-radius-sm);
  color: var(--timps-error);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.15s;
}
.stop-btn:hover { background: rgba(200,56,56,0.25); }

/* ─── Misc ───────────────────────────────────────────── */
.error-msg { color: var(--timps-error); font-size: 12px; font-style: italic; }
.hidden { display: none !important; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-logo">
    <div class="logo-icon">T</div>
    <span class="header-title">TIMPS AI</span>
  </div>
  <div class="header-model" id="modelBadge">timps-coder</div>
  <div class="header-actions">
    <button class="icon-btn" onclick="getCtx()" title="Add current file context">📎</button>
    <button class="icon-btn" onclick="openSettings()" title="Settings">⚙</button>
  </div>
</div>

<!-- Session tabs -->
<div class="session-tabs" id="sessionTabs">
  <div class="session-new-btn" onclick="newSession()" title="New chat">＋</div>
</div>

<!-- Messages -->
<div class="messages" id="messages">
  <div class="welcome" id="welcome">
    <div class="welcome-logo">T</div>
    <h2>TIMPS AI Coding Agent</h2>
    <p>Powered by TIMPS-Coder on Ollama — your local, private AI assistant.</p>
    <div class="welcome-chips" id="welcomeChips">
      <div class="chip" onclick="quickSend('Explain the current file')">Explain file</div>
      <div class="chip" onclick="quickSend('Find bugs in the current code')">Find bugs</div>
      <div class="chip" onclick="quickSend('Write unit tests for this code')">Write tests</div>
      <div class="chip" onclick="quickSend('Refactor to improve readability')">Refactor</div>
      <div class="chip" onclick="quickSend('Add detailed comments to this code')">Add comments</div>
      <div class="chip" onclick="quickSend('Optimize this code for performance')">Optimize</div>
    </div>
  </div>
</div>

<!-- Input Area -->
<div class="input-area">
  <div class="context-bar" id="contextBar" style="display:none">
    <div class="context-indicator">
      <div class="context-dot"></div>
      <span id="contextFileName">No file</span>
    </div>
    <span style="margin-left:auto;cursor:pointer;color:var(--timps-text-dim)" onclick="clearContext()" title="Remove context">✕</span>
  </div>
  <div class="input-row">
    <div class="input-wrap">
      <textarea
        id="input"
        placeholder="Ask TIMPS anything… (Enter to send, Shift+Enter for newline)"
        rows="1"
      ></textarea>
      <div class="input-toolbar">
        <button class="toolbar-btn" onclick="getCtx()" title="Attach current file">📎 Context</button>
        <button class="toolbar-btn" onclick="quickSend('@codebase Explain the project structure')" title="Ask about codebase">📦 Codebase</button>
        <span class="char-count" id="charCount">0</span>
      </div>
    </div>
    <button class="send-btn" id="sendBtn" onclick="sendMsg()" title="Send (Enter)">▶</button>
    <button class="stop-btn hidden" id="stopBtn" onclick="stopGen()" title="Stop generation">■</button>
  </div>
</div>

<script nonce="timps-webview">
const vscode = acquireVsCodeApi();

// ─── State ─────────────────────────────────────────────
let sessions = [];
let currentSessionId = null;
let isStreaming = false;
let currentMsgId = null;
let injectedContext = null;
let config = {};

// ─── VS Code message handler ─────────────────────────
window.addEventListener('message', ({ data }) => {
  switch(data.type) {
    case 'init':
      config = data.config || {};
      sessions = data.sessions || [];
      currentSessionId = data.currentSessionId;
      renderTabs();
      renderMessages();
      updateModelBadge();
      break;
    case 'newSession':
      sessions.push(data.session);
      currentSessionId = data.session.id;
      renderTabs();
      renderMessages();
      break;
    case 'switchSession':
      currentSessionId = data.sessionId;
      renderMessages();
      break;
    case 'clearHistory':
      const s = sessions.find(x => x.id === data.sessionId);
      if (s) s.messages = [];
      renderMessages();
      break;
    case 'userMessage':
      if (data.sessionId !== currentSessionId) break;
      addUserMessage(data.message);
      break;
    case 'assistantStart':
      if (data.sessionId !== currentSessionId) break;
      currentMsgId = data.messageId;
      addAssistantMessage(data.messageId);
      setStreaming(true);
      break;
    case 'assistantChunk':
      if (data.sessionId !== currentSessionId) break;
      appendChunk(data.messageId, data.chunk);
      break;
    case 'assistantDone':
      if (data.sessionId !== currentSessionId) break;
      finishMessage(data.messageId, data.content);
      setStreaming(false);
      updateSessionInList(data.sessionId);
      break;
    case 'assistantStopped':
      removeCursor(data.messageId);
      setStreaming(false);
      break;
    case 'assistantError':
      if (data.sessionId !== currentSessionId) break;
      showError(data.messageId, data.error);
      setStreaming(false);
      break;
    case 'fileContext':
      injectedContext = data;
      document.getElementById('contextBar').style.display = 'flex';
      document.getElementById('contextFileName').textContent = data.filename + ' (' + data.language + ')';
      break;
    case 'externalMessage':
      document.getElementById('input').value = data.content;
      break;
  }
});

// ─── Init ───────────────────────────────────────────────
vscode.postMessage({ type: 'ready' });

// ─── Render ─────────────────────────────────────────────
function renderTabs() {
  const tabs = document.getElementById('sessionTabs');
  tabs.innerHTML = '';
  sessions.forEach(s => {
    const tab = document.createElement('div');
    tab.className = 'session-tab' + (s.id === currentSessionId ? ' active' : '');
    tab.innerHTML = '<span class="session-tab-title">' + escHtml(s.title || 'New Chat') + '</span>'
      + '<span class="session-tab-close" onclick="deleteSession(event,\'' + s.id + '\')">✕</span>';
    tab.addEventListener('click', () => switchSession(s.id));
    tabs.appendChild(tab);
  });
  const newBtn = document.createElement('div');
  newBtn.className = 'session-new-btn';
  newBtn.title = 'New chat';
  newBtn.textContent = '＋';
  newBtn.onclick = newSession;
  tabs.appendChild(newBtn);
}

function renderMessages() {
  const session = sessions.find(s => s.id === currentSessionId);
  const container = document.getElementById('messages');
  const welcome = document.getElementById('welcome');

  if (!session || session.messages.length === 0) {
    welcome.style.display = 'flex';
    // Remove all non-welcome children
    Array.from(container.children).forEach(c => { if (c !== welcome) c.remove(); });
    return;
  }
  welcome.style.display = 'none';
  Array.from(container.children).forEach(c => { if (c !== welcome) c.remove(); });

  session.messages.forEach(m => {
    if (m.role === 'user') {
      addUserMessage(m, false);
    } else if (m.role === 'assistant') {
      const div = buildAssistantDiv(m.id);
      container.appendChild(div);
      renderMarkdown(m.id, m.content);
    }
  });
  scrollBottom();
}

function updateModelBadge() {
  const badge = document.getElementById('modelBadge');
  const model = config.model || 'timps-coder';
  badge.textContent = model.split('/').pop() || model;
}

function updateSessionInList(sessionId) {
  renderTabs();
}

// ─── Message builders ────────────────────────────────────
function addUserMessage(msg, scroll = true) {
  const welcome = document.getElementById('welcome');
  welcome.style.display = 'none';

  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message user';
  div.id = 'msg-' + msg.id;
  div.innerHTML = '<div class="message-header">'
    + '<div class="message-avatar user">U</div>'
    + '<span class="message-role user">You</span>'
    + '<span class="message-time">' + fmtTime(msg.timestamp) + '</span>'
    + '</div>'
    + '<div class="message-content">' + escHtml(msg.content).replace(/\n/g, '<br>') + '</div>';
  container.appendChild(div);
  if (scroll) scrollBottom();
}

function addAssistantMessage(msgId) {
  const container = document.getElementById('messages');
  const div = buildAssistantDiv(msgId);
  const content = div.querySelector('.message-content');
  content.innerHTML = '<div class="thinking"><span class="thinking-dots"><span></span><span></span><span></span></span><span>Thinking…</span></div>';
  container.appendChild(div);
  scrollBottom();
}

function buildAssistantDiv(msgId) {
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = 'msg-' + msgId;
  div.innerHTML = '<div class="message-header">'
    + '<div class="message-avatar assistant">T</div>'
    + '<span class="message-role assistant">TIMPS</span>'
    + '<span class="message-time">' + fmtTime(Date.now()) + '</span>'
    + '</div>'
    + '<div class="message-content" id="content-' + msgId + '"></div>';
  return div;
}

// ─── Streaming ───────────────────────────────────────────
let streamBuffers = {};

function appendChunk(msgId, chunk) {
  if (!streamBuffers[msgId]) streamBuffers[msgId] = '';
  streamBuffers[msgId] += chunk;

  const content = document.getElementById('content-' + msgId);
  if (!content) return;

  // Simple streaming render — update every chunk
  content.innerHTML = renderMd(streamBuffers[msgId]) + '<span class="cursor"></span>';
  scrollBottom();
}

function finishMessage(msgId, fullContent) {
  delete streamBuffers[msgId];
  const content = document.getElementById('content-' + msgId);
  if (!content) return;
  renderMarkdown(msgId, fullContent);
  scrollBottom();
}

function removeCursor(msgId) {
  const content = document.getElementById('content-' + msgId);
  if (!content) return;
  const cursor = content.querySelector('.cursor');
  if (cursor) cursor.remove();
}

function showError(msgId, error) {
  const content = document.getElementById('content-' + msgId);
  if (!content) return;
  content.innerHTML = '<span class="error-msg">⚠ Error: ' + escHtml(error) + '</span>';
}

function setStreaming(active) {
  isStreaming = active;
  document.getElementById('sendBtn').classList.toggle('hidden', active);
  document.getElementById('stopBtn').classList.toggle('hidden', !active);
}

// ─── Markdown renderer ───────────────────────────────────
function renderMarkdown(msgId, text) {
  const content = document.getElementById('content-' + msgId);
  if (!content) return;
  content.innerHTML = renderMd(text);

  // Wire up code block buttons
  content.querySelectorAll('.code-block').forEach(block => {
    const code = block.querySelector('code')?.textContent || '';
    block.querySelectorAll('.code-btn').forEach(btn => {
      if (btn.dataset.action === 'copy') {
        btn.addEventListener('click', () => { vscode.postMessage({ type: 'copyCode', code }); btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Copy', 1500); });
      } else if (btn.dataset.action === 'insert') {
        btn.addEventListener('click', () => vscode.postMessage({ type: 'insertCode', code }));
      }
    });
  });
}

function renderMd(text) {
  let html = escHtml(text);

  // Code blocks
  const bt3 = String.fromCharCode(96,96,96); const singleBt = String.fromCharCode(96);
  const codeBlockRe = new RegExp(bt3 + '(\\w+)?\\n?([\\s\\S]*?)' + bt3, 'g');
  html = html.replace(codeBlockRe, (_: string, lang: string, code: string) => {
    const l = lang || 'text';
    return '<div class="code-block">'
      + '<div class="code-block-header">'
      + '<span class="code-lang">' + l + '</span>'
      + '<div class="code-actions">'
      + '<button class="code-btn" data-action="copy">Copy</button>'
      + '<button class="code-btn" data-action="insert">Insert</button>'
      + '</div></div>'
      + '<pre><code>' + code.trim() + '</code></pre>'
      + '</div>';
  });

  // Inline code
  const inlineRe = new RegExp(singleBt + '([^' + singleBt + ']+)' + singleBt, 'g');
  html = html.replace(inlineRe, '<code>$1</code>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--timps-border);margin:8px 0">');

  // Paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<(h[1-3]|ul|div|hr))/g, '$1');
  html = html.replace(/(<\/(h[1-3]|ul|div|hr)>)<\/p>/g, '$1');

  return html;
}

// ─── Actions ─────────────────────────────────────────────
function sendMsg() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text || isStreaming) return;

  let content = text;
  if (injectedContext) {
    const bt = String.fromCharCode(96,96,96);
    content = text + '\n\n<file context="' + injectedContext.filename + '">\n' + bt + injectedContext.language + '\n' + injectedContext.content + '\n' + bt + '\n</file>';
  }

  vscode.postMessage({ type: 'send', content, sessionId: currentSessionId });
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('charCount').textContent = '0';

  // Add to local session so it appears immediately
  const session = sessions.find(s => s.id === currentSessionId);
  if (session) {
    session.messages.push({ id: 'tmp_' + Date.now(), role: 'user', content: text, timestamp: Date.now(), status: 'done' });
    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
    }
  }
}

function stopGen() {
  vscode.postMessage({ type: 'stop' });
}

function newSession() {
  vscode.postMessage({ type: 'newSession' });
}

function switchSession(id) {
  currentSessionId = id;
  vscode.postMessage({ type: 'switchSession', sessionId: id });
  renderTabs();
  renderMessages();
}

function deleteSession(e, id) {
  e.stopPropagation();
  vscode.postMessage({ type: 'deleteSession', sessionId: id });
  sessions = sessions.filter(s => s.id !== id);
  if (sessions.length === 0) { newSession(); return; }
  if (currentSessionId === id) currentSessionId = sessions[sessions.length - 1].id;
  renderTabs();
  renderMessages();
}

function getCtx() {
  vscode.postMessage({ type: 'getContext' });
}

function clearContext() {
  injectedContext = null;
  document.getElementById('contextBar').style.display = 'none';
}

function openSettings() {
  vscode.postMessage({ type: 'openSettings' });
}

function quickSend(text) {
  document.getElementById('input').value = text;
  sendMsg();
}

// ─── Input auto-resize & keyhandler ───────────────────────
const input = document.getElementById('input');
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  document.getElementById('charCount').textContent = input.value.length;
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
});

// ─── Helpers ─────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
function scrollBottom() {
  const msgs = document.getElementById('messages');
  msgs.scrollTop = msgs.scrollHeight;
}
</script>
</body>
</html>`;
  }
}