import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

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

export function activate(context: vscode.ExtensionContext) {
  console.log('TIMPS AI Coding Agent activating...');

  chatProvider = new TIMPSChatViewProvider(context);

  // Register the sidebar webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('timps.chatView', chatProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Commands
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
    })
  );

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) TIMPS';
  statusBar.tooltip = 'Open TIMPS AI Chat';
  statusBar.command = 'timps.openChat';
  statusBar.show();
  context.subscriptions.push(statusBar);

  console.log('TIMPS AI Coding Agent activated.');
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
      const path = `/v1/models/${modelName}:streamGenerateContent?alt=sse&key=${config.geminiApiKey}`;

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>TIMPS AI</title>
<style>
/* ─── TIMPS Design System ─────────────────────────── */
:root {
  --timps-purple: #7C3AED;
  --timps-purple-light: #A78BFA;
  --timps-purple-dark: #5B21B6;
  --timps-teal: #0D9488;
  --timps-teal-light: #2DD4BF;
  --timps-bg: #0F0F14;
  --timps-surface: #1A1A24;
  --timps-surface2: #22222F;
  --timps-surface3: #2A2A3A;
  --timps-border: rgba(124,58,237,0.2);
  --timps-border2: rgba(124,58,237,0.35);
  --timps-text: #E8E6F0;
  --timps-text-muted: #8B86A0;
  --timps-text-dim: #5A5570;
  --timps-user-bg: #1E1830;
  --timps-ai-bg: #0F1620;
  --timps-code-bg: #0D0D14;
  --timps-success: #10B981;
  --timps-error: #EF4444;
  --timps-warning: #F59E0B;
  --radius: 10px;
  --radius-sm: 6px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  background: var(--timps-bg);
  color: var(--timps-text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Scrollbar ─────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--timps-border2); border-radius: 2px; }

/* ─── Header ─────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--timps-surface);
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
  background: linear-gradient(135deg, var(--timps-purple), var(--timps-teal));
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 11px;
  color: white;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}
.header-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--timps-text);
  letter-spacing: 0.02em;
}
.header-model {
  font-size: 10px;
  color: var(--timps-purple-light);
  background: rgba(124,58,237,0.12);
  padding: 2px 7px;
  border-radius: 99px;
  border: 1px solid rgba(124,58,237,0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
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
  border-radius: 5px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  width: 26px;
  height: 26px;
}
.icon-btn:hover { color: var(--timps-text); background: var(--timps-surface3); }
.icon-btn.danger:hover { color: var(--timps-error); }

/* ─── Session Tabs ─────────────────────────────────── */
.session-tabs {
  display: flex;
  overflow-x: auto;
  background: var(--timps-surface);
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
  padding: 6px 10px;
  font-size: 11px;
  color: var(--timps-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-right: 1px solid var(--timps-border);
  white-space: nowrap;
  max-width: 130px;
  transition: color 0.15s, border-color 0.15s;
}
.session-tab:hover { color: var(--timps-text); background: var(--timps-surface2); }
.session-tab.active { color: var(--timps-purple-light); border-bottom-color: var(--timps-purple); background: var(--timps-surface2); }
.session-tab-title { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.session-tab-close { opacity: 0; font-size: 10px; padding: 1px 2px; border-radius: 3px; flex-shrink: 0; color: var(--timps-text-muted); }
.session-tab:hover .session-tab-close { opacity: 1; }
.session-tab-close:hover { background: rgba(239,68,68,0.2); color: var(--timps-error); }
.session-new-btn {
  flex-shrink: 0;
  padding: 6px 10px;
  color: var(--timps-text-muted);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
}
.session-new-btn:hover { color: var(--timps-purple-light); }

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
  padding: 32px 20px;
  text-align: center;
  gap: 12px;
}
.welcome-logo {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, var(--timps-purple) 0%, var(--timps-teal) 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 22px;
  color: white;
  letter-spacing: -1px;
  box-shadow: 0 0 32px rgba(124,58,237,0.25);
}
.welcome h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--timps-text);
  line-height: 1.3;
}
.welcome p {
  font-size: 12px;
  color: var(--timps-text-muted);
  line-height: 1.6;
  max-width: 240px;
}
.welcome-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 4px;
}
.chip {
  background: var(--timps-surface2);
  border: 1px solid var(--timps-border);
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--timps-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.chip:hover {
  border-color: var(--timps-purple);
  color: var(--timps-purple-light);
  background: rgba(124,58,237,0.08);
}

/* ─── Message Bubble ─────────────────────────────────── */
.message {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.message.user { background: var(--timps-user-bg); }
.message.assistant { background: var(--timps-bg); }
.message.error { border-left: 2px solid var(--timps-error); }

.message-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}
.message-avatar {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: -0.5px;
}
.message-avatar.user { background: linear-gradient(135deg, #374151, #1F2937); color: #9CA3AF; }
.message-avatar.assistant { background: linear-gradient(135deg, var(--timps-purple), var(--timps-teal)); color: white; }
.message-role { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.message-role.user { color: var(--timps-text-muted); }
.message-role.assistant { color: var(--timps-purple-light); }
.message-time { font-size: 10px; color: var(--timps-text-dim); margin-left: auto; }

.message-content {
  font-size: 13px;
  line-height: 1.65;
  color: var(--timps-text);
  word-break: break-word;
}
.message-content p { margin-bottom: 8px; }
.message-content p:last-child { margin-bottom: 0; }
.message-content strong { color: var(--timps-purple-light); font-weight: 600; }
.message-content em { color: var(--timps-teal-light); font-style: italic; }
.message-content ul, .message-content ol { padding-left: 18px; margin-bottom: 8px; }
.message-content li { margin-bottom: 3px; }
.message-content h1, .message-content h2, .message-content h3 {
  color: var(--timps-text);
  margin: 10px 0 6px;
  font-weight: 600;
}
.message-content h1 { font-size: 15px; }
.message-content h2 { font-size: 14px; }
.message-content h3 { font-size: 13px; color: var(--timps-purple-light); }

/* Inline code */
.message-content code:not(pre code) {
  background: var(--timps-code-bg);
  border: 1px solid var(--timps-border);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  color: var(--timps-teal-light);
}

/* ─── Code Blocks ─────────────────────────────────────── */
.code-block {
  background: var(--timps-code-bg);
  border: 1px solid var(--timps-border);
  border-radius: var(--radius-sm);
  margin: 8px 0;
  overflow: hidden;
}
.code-block-header {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  background: rgba(124,58,237,0.08);
  border-bottom: 1px solid var(--timps-border);
  gap: 6px;
}
.code-lang {
  font-size: 10px;
  font-weight: 600;
  color: var(--timps-purple-light);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.code-filename { font-size: 10px; color: var(--timps-text-muted); }
.code-actions { margin-left: auto; display: flex; gap: 4px; }
.code-btn {
  background: none;
  border: 1px solid var(--timps-border);
  border-radius: 4px;
  color: var(--timps-text-muted);
  cursor: pointer;
  padding: 2px 7px;
  font-size: 10px;
  transition: all 0.15s;
}
.code-btn:hover { border-color: var(--timps-purple); color: var(--timps-purple-light); background: rgba(124,58,237,0.1); }
.code-block pre {
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0;
}
.code-block code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  color: #CBD5E1;
  white-space: pre;
}

/* ─── Streaming cursor ───────────────────────────────── */
.cursor {
  display: inline-block;
  width: 2px;
  height: 13px;
  background: var(--timps-purple-light);
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
  background: var(--timps-purple);
  border-radius: 50%;
  animation: dot 1.4s infinite;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }

/* ─── Input Area ─────────────────────────────────────── */
.input-area {
  border-top: 1px solid var(--timps-border);
  background: var(--timps-surface);
  flex-shrink: 0;
}
.context-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--timps-border);
  font-size: 10px;
  color: var(--timps-text-dim);
}
.context-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--timps-teal-light);
  font-size: 10px;
}
.context-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--timps-teal);
  flex-shrink: 0;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
}
.input-wrap {
  flex: 1;
  position: relative;
  background: var(--timps-surface2);
  border: 1px solid var(--timps-border);
  border-radius: var(--radius);
  transition: border-color 0.15s;
}
.input-wrap:focus-within { border-color: var(--timps-purple); box-shadow: 0 0 0 2px rgba(124,58,237,0.12); }
textarea {
  width: 100%;
  background: none;
  border: none;
  color: var(--timps-text);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  padding: 9px 12px;
  resize: none;
  outline: none;
  max-height: 160px;
  min-height: 36px;
}
textarea::placeholder { color: var(--timps-text-dim); }
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid var(--timps-border);
}
.toolbar-btn {
  background: none;
  border: none;
  color: var(--timps-text-dim);
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 4px;
  font-size: 11px;
  transition: color 0.15s;
}
.toolbar-btn:hover { color: var(--timps-purple-light); background: rgba(124,58,237,0.08); }
.char-count {
  margin-left: auto;
  font-size: 10px;
  color: var(--timps-text-dim);
}
.send-btn {
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, var(--timps-purple), var(--timps-purple-dark));
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(124,58,237,0.3);
}
.send-btn:hover { background: linear-gradient(135deg, var(--timps-purple-light), var(--timps-purple)); transform: scale(1.04); }
.send-btn:active { transform: scale(0.97); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.stop-btn {
  width: 34px;
  height: 34px;
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: var(--radius-sm);
  color: var(--timps-error);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.15s;
}
.stop-btn:hover { background: rgba(239,68,68,0.25); }

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

<script>
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