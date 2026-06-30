// ============================================================
// TIMPS Chat Panel v2.1 — FIXED
// Bugs fixed:
//   1. getConfig handler now wired (modelBadge shows correctly)
//   2. markdown regex corrected (no double-escape)
//   3. memory context injected into system prompt
//   4. !audit / !blame / !forget commands handled
//   5. Apply-to-editor button for code blocks
//   6. Static methods for postMessage from extension.ts
// ============================================================

import * as vscode from 'vscode';
import { chat } from './ollama';
import { getSystemPrompt } from './systemPrompt';
import { TIMPsMemory, MemoryEntry } from './memory';
import { ChatMessage } from './types';
import { TIMPS_THEME, TIMPS_ANIMATIONS, TIMPS_GLOBAL_RESET } from './design-tokens';

let currentPanel: TIMPsChatPanel | undefined;

export class TIMPsChatPanel {
    public static readonly viewType = 'timpsChat';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _memory: TIMPsMemory;
    private _disposables: vscode.Disposable[] = [];
    private _messages: ChatMessage[] = [];
    private _isStreaming = false;
    private _abortController: AbortController | null = null;

    // ── Static factory ────────────────────────────────────────

    public static createOrShow(extensionUri: vscode.Uri, memory: TIMPsMemory): TIMPsChatPanel {
        if (currentPanel) {
            currentPanel._panel.reveal(vscode.ViewColumn.Beside);
            return currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(
            TIMPsChatPanel.viewType, 'TIMPS Chat',
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extensionUri] }
        );
        currentPanel = new TIMPsChatPanel(panel, extensionUri, memory);
        return currentPanel;
    }

    // Static helpers so extension.ts can post without holding a ref
    public static postMemoryAudit(memories: MemoryEntry[]) {
        currentPanel?._panel.webview.postMessage({ command: 'memoryAudit', memories });
    }
    public static postBlameResults(keyword: string, results: MemoryEntry[]) {
        currentPanel?._panel.webview.postMessage({ command: 'blameResults', keyword, results });
    }

    // ── Constructor ───────────────────────────────────────────

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, memory: TIMPsMemory) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._memory = memory;
        this._panel.webview.html = this._getHtml();

        this._panel.webview.onDidReceiveMessage(async msg => {
            switch (msg.command) {
                case 'sendMessage': await this._handleMessage(msg.text); break;
                case 'clearChat':   this._clearChat(); break;
                case 'stopGeneration': this._abortController?.abort(); break;
                case 'newSession':  this._clearChat(); break;
                case 'applyCode':   await this._applyToEditor(msg.code); break;
                case 'copyCode':
                    await vscode.env.clipboard.writeText(msg.code);
                    this._post({ command: 'copyConfirmed', id: msg.id });
                    break;
                // FIX #1: getConfig was never handled — now it is
                case 'getConfig': {
                    const cfg = vscode.workspace.getConfiguration('timps');
                    const model = cfg.get<string>('localModel', 'sandeeprdy1729/timps-coder');
                    const provider = cfg.get<string>('provider', 'ollama');
                    this._post({ command: 'setModel', model: `${model} (${provider})` });
                    break;
                }
            }
        }, null, this._disposables);

        this._panel.onDidDispose(() => {
            currentPanel = undefined;
            this.dispose();
        }, null, this._disposables);
    }

    // ── Public API ────────────────────────────────────────────

    public async sendUserMessage(text: string) {
        this._panel.reveal(vscode.ViewColumn.Beside);
        await this._handleMessage(text);
    }

    // ── Message handling ──────────────────────────────────────

    private async _handleMessage(text: string) {
        if (this._isStreaming || !text.trim()) return;

        // Memory commands
        if (text.trim() === '!audit') {
            const mems = await this._memory.audit();
            this._post({ command: 'memoryAudit', memories: mems });
            return;
        }
        if (text.startsWith('!forget ')) {
            const kw = text.slice(8).trim();
            const n = await this._memory.forget(kw);
            this._post({ command: 'systemMessage', text: `🗑️ Deleted ${n} memory item(s) matching "${kw}"` });
            return;
        }
        if (text.startsWith('!blame ')) {
            const kw = text.slice(7).trim();
            const results = await this._memory.search(kw, 10);
            this._post({ command: 'blameResults', keyword: kw, results });
            return;
        }

        // Store user message in memory
        await this._memory.store({ content: `User: ${text.slice(0, 200)}`, type: 'explicit', importance: 1, tags: ['conversation'] });

        // Retrieve relevant memories
        const memories = await this._memory.search(text, 5);
        const episodes = this._memory.loadEpisodes(5);
        const memCtx = this._memory.buildContext(memories, episodes);

        this._messages.push({ role: 'user', content: text });
        this._post({ command: 'addMessage', role: 'user', content: text, id: Date.now().toString() });

        this._isStreaming = true;
        this._abortController = new AbortController();
        const responseId = Date.now().toString();
        this._post({ command: 'startStreaming', id: responseId });

        try {
            const cfg = vscode.workspace.getConfiguration('timps');
            const ollamaUrl = cfg.get<string>('ollamaUrl', 'http://localhost:11434');
            const model = cfg.get<string>('localModel', 'sandeeprdy1729/timps-coder');
            const maxTokens = cfg.get<number>('maxTokens', 4096);
            const temperature = cfg.get<number>('temperature', 0.3);
            const systemPrompt = getSystemPrompt(memCtx);

            const apiMessages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                ...this._messages
            ];

            let fullResponse = '';
            for await (const chunk of chat(ollamaUrl, model, apiMessages, { temperature, maxTokens }, this._abortController.signal)) {
                fullResponse += chunk;
                this._post({ command: 'streamChunk', content: chunk, id: responseId });
            }

            this._messages.push({ role: 'assistant', content: fullResponse });
            this._post({ command: 'endStreaming', content: fullResponse, id: responseId });

            // Store reflection in memory
            await this._memory.reflect(text, fullResponse);
            this._memory.storeEpisode({
                summary: text.slice(0, 80),
                userMessage: text.slice(0, 300),
                assistantResponse: fullResponse.slice(0, 300),
            });

        } catch (err: any) {
            if (err.name === 'AbortError') {
                this._post({ command: 'streamAborted', id: responseId });
            } else {
                const msg = err.message?.includes('ECONNREFUSED')
                    ? 'Cannot connect to Ollama. Run: ollama serve — then reload VS Code.'
                    : err.message?.includes('404') || err.message?.includes('not found')
                    ? 'Model not found. Run: ollama pull sandeeprdy1729/timps-coder'
                    : err.message || String(err);
                this._post({ command: 'showError', message: msg });
                this._memory.trackError(msg);
            }
        } finally {
            this._isStreaming = false;
            this._abortController = null;
        }
    }

    private async _applyToEditor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { vscode.window.showWarningMessage('No active editor to apply changes.'); return; }
        const doc = editor.document;
        await editor.edit(eb => {
            if (!editor.selection.isEmpty) {
                eb.replace(editor.selection, code);
            } else {
                eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), code);
            }
        });
        vscode.window.showInformationMessage('✅ TIMPS applied changes to editor!');
        this._post({ command: 'applyConfirmed' });
    }

    private _clearChat() {
        this._messages = [];
        this._abortController?.abort();
        this._abortController = null;
        this._isStreaming = false;
        this._post({ command: 'clearChat' });
    }

    private _post(data: object) { this._panel.webview.postMessage(data); }

    public dispose() {
        currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) this._disposables.pop()?.dispose();
    }

    // ── HTML ──────────────────────────────────────────────────

    private _getHtml(): string {
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}'; img-src data: https:;"/>
<title>TIMPS Chat</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
/* ── TIMPS Desktop Theme — Teal/Cream Robot Palette ── */
${TIMPS_THEME}
${TIMPS_ANIMATIONS}
${TIMPS_GLOBAL_RESET}

/* Map desktop tokens to compact aliases for this webview */
:root {
  --bg:       var(--timps-bg);
  --bg2:      var(--timps-bg2);
  --bg3:      var(--timps-bg3);
  --panel-bg: var(--timps-surface);
  --text:     var(--timps-text);
  --muted:    var(--timps-text-muted);
  --teal:     var(--timps-border);
  --tealMid:  var(--timps-accent);
  --tealLt:   var(--timps-accent-hover);
  --tan:      var(--timps-text2);
  --cream:    var(--timps-text);
  --border:   var(--timps-border);
  --success:  var(--timps-success);
  --error:    var(--timps-error);
  --warning:  var(--timps-warning);
  --dotR:     var(--timps-dot-red);
  --dotY:     var(--timps-dot-yellow);
  --dotG:     var(--timps-dot-green);
  --code-bg:  var(--timps-code-bg);
  --user-bg:  var(--timps-user-bg);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--timps-font);
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* ── Menubar ── */
.menubar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 10px;
  height: 28px;
  background: var(--teal);
  flex-shrink: 0;
  border-bottom: 2px solid var(--border);
}
.menubar-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--cream);
  letter-spacing: 0.08em;
  padding-right: 14px;
  border-right: 1px solid rgba(255,255,255,0.15);
  margin-right: 8px;
}
.logo-robot {
  animation: robotFloat 3s ease-in-out infinite;
  image-rendering: pixelated;
}
.logo-robot-eye {
  animation: robotBlink 4s ease-in-out infinite;
  transform-origin: center;
}
.menu-item {
  padding: 0 10px;
  height: 28px;
  line-height: 28px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(245,240,225,0.75);
  cursor: pointer;
  letter-spacing: 0.03em;
}
.menu-item:hover { background: rgba(255,255,255,0.12); color: var(--cream); }
.menu-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.model-badge {
  font-size: 10px;
  background: rgba(0,0,0,0.3);
  padding: 2px 8px;
  border-radius: 2px;
  color: var(--tan);
  border: 1px solid rgba(200,191,140,0.25);
  font-family: var(--timps-font-mono);
  font-weight: 600;
  cursor: pointer;
}
.model-badge:hover { border-color: var(--tan); }
.online-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--dotG);
  animation: pulse 2s ease-in-out infinite;
}

/* ── Main layout: chat + activity log ── */
.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

/* ── Chat pane ── */
.chat-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

/* Window chrome title bar */
.win-titlebar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--bg3);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.win-dot { width: 10px; height: 10px; border-radius: 50%; cursor: pointer; }
.win-dot.r { background: var(--dotR); }
.win-dot.y { background: var(--dotY); }
.win-dot.g { background: var(--dotG); }
.win-title { font-size: 11px; font-weight: 700; color: var(--muted); flex: 1; text-align: center; font-family: var(--timps-font-mono); letter-spacing: 0.06em; }

/* Skills pills */
.skills-bar {
  display: flex;
  gap: 4px;
  padding: 5px 8px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.skills-bar::-webkit-scrollbar { display: none; }
.spill {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  font-weight: 600;
  transition: border-color 0.1s, color 0.1s;
}
.spill:hover { border-color: var(--tealLt); color: var(--tealLt); }

/* Messages */
.msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg);
}
.msgs::-webkit-scrollbar { width: 4px; }
.msgs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.msg {
  max-width: 92%;
  border-radius: 2px;
  padding: 9px 12px;
  line-height: 1.65;
  font-size: 13px;
  animation: fadeSlide 0.2s ease;
  position: relative;
}
.msg.user {
  align-self: flex-end;
  background: var(--user-bg);
  border: 1px solid var(--teal);
  border-left: 3px solid var(--tealMid);
}
.msg.assistant {
  align-self: flex-start;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--tealLt);
}
.msg.error {
  align-self: center;
  background: #1a0a0a;
  border: 1px solid var(--error);
  color: var(--error);
  font-size: 12px;
}
.msg.system-msg {
  align-self: center;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-style: italic;
  padding: 2px 6px;
  border: none;
}
.role-label {
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--timps-font-mono);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.msg.user .role-label { color: var(--tealLt); }
.msg.assistant .role-label { color: var(--tealMid); }

/* Code */
.code-wrap { position: relative; margin: 8px 0; border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
.code-head { display: flex; justify-content: space-between; align-items: center; background: #08100D; padding: 4px 10px; font-size: 10px; color: var(--tan); border-bottom: 1px solid var(--border); }
.code-head .lang { font-family: 'JetBrains Mono', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.code-btns { display: flex; gap: 4px; }
.cbtn { background: transparent; border: 1px solid #2a3a38; color: var(--muted); padding: 2px 7px; border-radius: 2px; cursor: pointer; font-size: 10px; font-weight: 700; transition: border-color 0.1s, color 0.1s; }
.cbtn:hover { border-color: var(--tealLt); color: var(--tealLt); }
.cbtn.apply { border-color: var(--tealMid); color: var(--tealMid); }
.cbtn.apply:hover { background: rgba(74,140,122,0.15); }
.code-body { background: var(--code-bg); padding: 10px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; white-space: pre; color: var(--text); }
.icode { background: var(--bg3); padding: 1px 4px; border-radius: 2px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--tealLt); border: 1px solid var(--border); }

/* Memory cards */
.mem-card { background: rgba(45,90,79,0.12); border-left: 3px solid var(--tealMid); padding: 6px 10px; margin: 3px 0; font-size: 12px; border-radius: 0 2px 2px 0; }
.mem-meta { color: var(--muted); font-size: 10px; margin-top: 3px; font-family: 'JetBrains Mono', monospace; }

/* Typing */
.typing { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.dots { display: flex; gap: 3px; }
.dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--tealMid); animation: bounce 1.2s ease-in-out infinite; }
.dots span:nth-child(2) { animation-delay: .2s; }
.dots span:nth-child(3) { animation-delay: .4s; }

/* Welcome — retro window style */
.welcome { padding: 16px; animation: fadeSlide 0.3s ease; }
.welcome-window {
  background: var(--bg2);
  border: 1px solid var(--teal);
  border-radius: 4px;
  overflow: hidden;
  max-width: 380px;
  margin: 0 auto;
  box-shadow: 4px 4px 0px rgba(45,90,79,0.3);
}
.welcome-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  background: var(--teal);
  border-bottom: 1px solid rgba(0,0,0,0.3);
}
.w-dot { width: 10px; height: 10px; border-radius: 50%; }
.w-dot.r { background: var(--dotR); }
.w-dot.y { background: var(--dotY); }
.w-dot.g { background: var(--dotG); }
.welcome-title { font-size: 11px; font-weight: 700; color: rgba(245,240,225,0.85); flex: 1; text-align: center; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.08em; }
.welcome-body { padding: 20px 16px 16px; text-align: center; }
.welcome-robot { animation: robotFloat 3s ease-in-out infinite; display: inline-block; margin-bottom: 12px; image-rendering: pixelated; }
.welcome h2 { font-size: 17px; font-weight: 700; color: var(--tealLt); margin-bottom: 4px; letter-spacing: 0.02em; }
.welcome p { color: var(--muted); font-size: 12px; margin-bottom: 14px; line-height: 1.6; }
.qa-grid { display: flex; flex-direction: column; gap: 5px; text-align: left; }
.qa {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
  transition: border-color 0.1s, background 0.1s;
}
.qa:hover { border-color: var(--tealMid); background: rgba(45,90,79,0.15); }
.qa-icon { font-size: 14px; width: 20px; text-align: center; }
.qa-title { font-weight: 700; color: var(--text); font-size: 12px; }
.qa-desc { color: var(--muted); font-size: 11px; }

/* Input area */
.input-area {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.cmd-hint {
  font-size: 14px;
  color: var(--tealMid);
  font-family: var(--timps-font-mono);
  padding: 0 2px 0 0;
  align-self: center;
  flex-shrink: 0;
  line-height: 1;
}
.input-area textarea {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: none;
  outline: none;
  min-height: 36px;
  max-height: 110px;
  line-height: 1.4;
}
.input-area textarea:focus { border-color: var(--tealMid); }
.input-area textarea::placeholder { color: var(--muted); }
.send-btn, .stop-btn {
  width: 36px;
  height: 36px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  align-self: flex-end;
  font-weight: 700;
  border: 1px solid;
  transition: opacity 0.1s;
}
.send-btn { background: var(--tealMid); color: var(--bg); border-color: var(--tealMid); }
.send-btn:hover { opacity: 0.85; }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.stop-btn { background: var(--error); color: #fff; border-color: var(--error); }
.stop-btn:hover { opacity: 0.85; }
.hidden { display: none !important; }

/* ── Activity Log pane (right) ── */
.log-pane {
  width: 200px;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  flex-shrink: 0;
}
.log-pane .win-titlebar {
  border-bottom: 1px solid var(--border);
}
.log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  font-family: var(--timps-font-mono);
  font-size: 10px;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.log-entries::-webkit-scrollbar { display: none; }
.log-entry {
  display: flex;
  gap: 4px;
  align-items: flex-start;
  padding: 2px 0;
  border-bottom: 1px solid rgba(45,90,79,0.2);
  animation: fadeSlide 0.2s ease;
}
.log-time { color: var(--teal); flex-shrink: 0; }
.log-text { color: var(--muted); line-height: 1.4; word-break: break-word; }
.log-text.ok  { color: var(--success); }
.log-text.err { color: var(--error); }
.log-text.inf { color: var(--tealLt); }

/* Stats bar at bottom of log pane */
.stats-bar {
  padding: 6px 8px;
  border-top: 1px solid var(--border);
  font-family: var(--timps-font-mono);
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.stat-row { display: flex; justify-content: space-between; color: var(--muted); }
.stat-val { color: var(--tan); font-weight: 700; }

/* MD */
.mc strong { color: var(--tealLt); font-weight: 700; }
.mc em { color: var(--tan); }
.mc h1 { font-size: 16px; color: var(--tealLt); margin: 10px 0 5px; border-bottom: 1px solid var(--border); padding-bottom: 3px; }
.mc h2 { font-size: 14px; color: var(--tealLt); margin: 9px 0 4px; }
.mc h3 { font-size: 13px; color: var(--tealMid); margin: 8px 0 4px; }
.mc ul, .mc ol { padding-left: 16px; margin: 4px 0; }
.mc li { margin: 2px 0; }
.mc blockquote { border-left: 2px solid var(--border); padding-left: 8px; color: var(--muted); margin: 5px 0; background: var(--bg3); }
.mc hr { border: none; border-top: 1px solid var(--border); margin: 8px 0; }
.mc a { color: var(--tealLt); text-decoration: underline; }
.mc p { margin-bottom: 5px; }
</style>
</head>
<body>
<!-- ── Menu Bar ── -->
<div class="menubar">
  <div class="menubar-logo">
    <!-- Pixel robot — teal screen, tan body -->
    <svg class="logo-robot" viewBox="0 0 16 20" width="20" height="25" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="0" width="10" height="9" rx="1" fill="#2D5A4F"/>
      <rect x="4" y="1" width="8" height="7" rx="1" fill="#3D7A6A"/>
      <rect class="logo-robot-eye" x="5" y="3" width="2" height="2" fill="#E8E0B0"/>
      <rect class="logo-robot-eye" x="9" y="3" width="2" height="2" fill="#E8E0B0"/>
      <rect x="6" y="6" width="4" height="1" fill="#E8E0B0"/>
      <rect x="5" y="9" width="1" height="2" fill="#C8BF8C"/>
      <rect x="10" y="9" width="1" height="2" fill="#C8BF8C"/>
      <rect x="2" y="11" width="12" height="6" rx="1" fill="#C8BF8C"/>
      <rect x="4" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
      <rect x="9" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
    </svg>
    TIMPS
  </div>
  <div class="menu-item" onclick="sendQ('Review my code for issues')">Agent</div>
  <div class="menu-item" onclick="sendQ('!audit')">Memory</div>
  <div class="menu-item" onclick="sendQ('Security audit: check for injection, XSS, hardcoded secrets, auth flaws.')">Tools</div>
  <div class="menu-right">
    <div class="online-dot" title="Connected"></div>
    <span class="model-badge" id="modelBadge" title="Active model">Loading…</span>
    <div class="menu-item" onclick="clearChat()" style="color:var(--error);padding:0 6px">⌫</div>
  </div>
</div>

<!-- ── Layout ── -->
<div class="layout">

  <!-- Chat pane -->
  <div class="chat-pane">
    <div class="win-titlebar">
      <div class="win-dot r" onclick="clearChat()"></div>
      <div class="win-dot y"></div>
      <div class="win-dot g"></div>
      <span class="win-title">TIMPS Chat — Active Session</span>
    </div>

    <!-- Quick-action pills -->
    <div class="skills-bar">
      <button class="spill" onclick="sendQ('Fix the bug in my selected code. Explain the root cause first.')">🐛 Fix Bug</button>
      <button class="spill" onclick="sendQ('Review this code. Use 🔴 Critical / 🟡 Warning / 🟢 Suggestion.')">👁 Review</button>
      <button class="spill" onclick="sendQ('Explain this code step by step.')">💡 Explain</button>
      <button class="spill" onclick="sendQ('Refactor for better readability and performance.')">🔧 Refactor</button>
      <button class="spill" onclick="sendQ('Write comprehensive unit tests with edge cases.')">🧪 Tests</button>
      <button class="spill" onclick="sendQ('Add JSDoc documentation to all functions.')">📝 Docs</button>
      <button class="spill" onclick="sendQ('Optimize for performance. Show complexity comparison.')">⚡ Optimize</button>
      <button class="spill" onclick="sendQ('Security audit: injection, XSS, hardcoded secrets, auth flaws.')">🔒 Security</button>
      <button class="spill" onclick="sendQ('!audit')">🧠 Memory</button>
    </div>

    <!-- Messages -->
    <div class="msgs" id="msgs">
      <div class="welcome" id="welcome">
        <div class="welcome-window">
          <div class="welcome-bar">
            <div class="w-dot r"></div>
            <div class="w-dot y"></div>
            <div class="w-dot g"></div>
            <span class="welcome-title">timps v2.0 — coding agent</span>
          </div>
          <div class="welcome-body">
            <!-- Large animated robot -->
            <div class="welcome-robot">
              <svg viewBox="0 0 48 60" width="72" height="90" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">
                <rect x="20" y="0" width="8" height="4" fill="#4A8C7A"/>
                <rect x="22" y="0" width="4" height="8" fill="#4A8C7A"/>
                <rect x="6" y="8" width="36" height="26" rx="3" fill="#2D5A4F"/>
                <rect x="9" y="11" width="30" height="20" rx="2" fill="#3D7A6A"/>
                <rect x="12" y="14" width="7" height="7" fill="#E8E0B0"/>
                <rect x="29" y="14" width="7" height="7" fill="#E8E0B0"/>
                <rect x="14" y="24" width="20" height="3" fill="#E8E0B0"/>
                <rect x="11" y="22" width="3" height="3" fill="#E8E0B0"/>
                <rect x="34" y="22" width="3" height="3" fill="#E8E0B0"/>
                <rect x="17" y="34" width="4" height="8" fill="#C8BF8C"/>
                <rect x="27" y="34" width="4" height="8" fill="#C8BF8C"/>
                <rect x="6" y="36" width="42" height="20" rx="3" fill="#C8BF8C"/>
                <rect x="0" y="38" width="7" height="14" rx="2" fill="#B0A87A"/>
                <rect x="41" y="38" width="7" height="14" rx="2" fill="#B0A87A"/>
                <rect x="10" y="56" width="10" height="4" rx="1" fill="#1C1C1C"/>
                <rect x="28" y="56" width="10" height="4" rx="1" fill="#1C1C1C"/>
              </svg>
            </div>
            <h2>TIMPS Agent</h2>
            <p>Open-source AI coding partner<br>Memory-aware · Runs locally via Ollama</p>
            <div class="qa-grid">
              <div class="qa" onclick="sendQ('Fix the bug in my selected code. Explain root cause first.')">
                <span class="qa-icon">🐛</span>
                <div><div class="qa-title">Fix Bug</div><div class="qa-desc">Diagnose and fix root cause</div></div>
              </div>
              <div class="qa" onclick="sendQ('Review this code with Critical / Warning / Suggestion format.')">
                <span class="qa-icon">👁</span>
                <div><div class="qa-title">Code Review</div><div class="qa-desc">Deep review with severity levels</div></div>
              </div>
              <div class="qa" onclick="sendQ('Write comprehensive unit tests with edge cases.')">
                <span class="qa-icon">🧪</span>
                <div><div class="qa-title">Write Tests</div><div class="qa-desc">Generate complete test suites</div></div>
              </div>
              <div class="qa" onclick="sendQ('!audit')">
                <span class="qa-icon">🧠</span>
                <div><div class="qa-title">Memory Audit</div><div class="qa-desc">See what TIMPS remembers</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="input-area">
      <span class="cmd-hint">❯</span>
      <textarea id="inp" placeholder="Ask TIMPS anything… (!audit, !blame &lt;kw&gt;, !forget &lt;kw&gt;)" rows="1" onkeydown="onKey(event)"></textarea>
      <button class="send-btn" id="sendBtn" onclick="send()" title="Send (Enter)">↑</button>
      <button class="stop-btn hidden" id="stopBtn" onclick="stop()" title="Stop generation">■</button>
    </div>
  </div>

  <!-- Activity Log pane -->
  <div class="log-pane">
    <div class="win-titlebar">
      <div class="win-dot r"></div>
      <div class="win-dot y"></div>
      <div class="win-dot g"></div>
      <span class="win-title">Activity Log</span>
    </div>
    <div class="log-entries" id="activityLog">
      <div class="log-entry"><span class="log-time">--:--</span><span class="log-text inf">Agent ready</span></div>
    </div>
    <div class="stats-bar" id="statsBar">
      <div class="stat-row"><span>Provider</span><span class="stat-val" id="statProvider">—</span></div>
      <div class="stat-row"><span>Tokens</span><span class="stat-val" id="statTokens">0</span></div>
      <div class="stat-row"><span>Messages</span><span class="stat-val" id="statMsgs">0</span></div>
    </div>
  </div>

</div><!-- /layout -->

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let streaming = false, curId = '', curContent = '', codeCount = 0, msgCount = 0, totalTokens = 0;

window.addEventListener('load', () => {
  vscode.postMessage({ command: 'getConfig' });
  autoResize(document.getElementById('inp'));
  logActivity('Session started', 'inf');
});

function ts() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0');
}

function logActivity(text, cls) {
  const el = document.getElementById('activityLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = '<span class="log-time">[' + ts() + ']</span><span class="log-text ' + (cls||'') + '">' + esc(text) + '</span>';
  el.appendChild(entry);
  el.scrollTop = el.scrollHeight;
  // Keep max 80 entries
  while (el.children.length > 80) el.removeChild(el.firstChild);
}

function updateStats() {
  document.getElementById('statTokens').textContent = totalTokens.toLocaleString();
  document.getElementById('statMsgs').textContent = String(msgCount);
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}
function send() {
  const el = document.getElementById('inp');
  const txt = el.value.trim();
  if (!txt || streaming) return;
  el.value = ''; resize(el);
  vscode.postMessage({ command: 'sendMessage', text: txt });
  logActivity('You: ' + txt.slice(0,40) + (txt.length > 40 ? '…' : ''));
}
function sendQ(txt) {
  if (streaming) return;
  vscode.postMessage({ command: 'sendMessage', text: txt });
  logActivity('Quick: ' + txt.slice(0,35) + '…');
}
function clearChat() { vscode.postMessage({ command: 'clearChat' }); logActivity('Chat cleared'); }
function stop() { vscode.postMessage({ command: 'stopGeneration' }); logActivity('Generation stopped', 'err'); }

function setStreaming(v) {
  streaming = v;
  document.getElementById('sendBtn').classList.toggle('hidden', v);
  document.getElementById('stopBtn').classList.toggle('hidden', !v);
}

function hideWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.style.display = 'none';
}

function addMsg(role, content, id) {
  hideWelcome();
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  if (id) d.id = 'msg-' + id;
  const label = role === 'user' ? '❯ YOU' : role === 'assistant' ? '🤖 TIMPS' : '';
  let html = label ? '<div class="role-label">' + label + '</div>' : '';
  html += '<div class="mc">' + (role === 'assistant' ? md(content) : esc(content).replace(/\\n/g,'<br>')) + '</div>';
  d.innerHTML = html;
  c.appendChild(d);
  scroll();
  if (role !== 'system-msg') { msgCount++; updateStats(); }
  return d;
}

function addMem(mems, title) {
  hideWelcome();
  const c = document.getElementById('msgs');
  const d = document.createElement('div');
  d.className = 'msg assistant';
  let html = '<div class="role-label">🧠 TIMPS — ' + esc(title) + '</div><div class="mc">';
  if (!mems || mems.length === 0) {
    html += '<em>No memories found.</em>';
  } else {
    for (const m of mems) {
      const stars = '⭐'.repeat(Math.min(m.importance||1, 5));
      html += '<div class="mem-card"><b>[' + esc(m.id||'?') + '] ' + esc((m.type||'').toUpperCase()) + '</b> ' + stars + '<br>' + esc(m.content) + '<div class="mem-meta">' + new Date(m.createdAt||Date.now()).toLocaleString() + ' · ' + (m.accessCount||0) + 'x · ' + ((m.tags||[]).join(', ')||'no tags') + '</div></div>';
    }
  }
  d.innerHTML = html + '</div>';
  c.appendChild(d);
  scroll();
}

function scroll() { const c = document.getElementById('msgs'); c.scrollTop = c.scrollHeight; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function md(text) {
  let h = esc(text);
  h = h.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, (_, lang, code) => {
    const id = 'c' + (++codeCount);
    const l = lang || 'code';
    return '<div class="code-wrap"><div class="code-head"><span class="lang">' + l + '</span><div class="code-btns"><button class="cbtn apply" onclick="applyCode(\\'' + id + '\\')">✓ Apply</button><button class="cbtn" id="cp-' + id + '" onclick="copyCode(\\'' + id + '\\')">Copy</button></div></div><div class="code-body" id="' + id + '">' + code + '</div></div>';
  });
  h = h.replace(/\`([^\`\n]+)\`/g, '<code class="icode">$1</code>');
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  h = h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  h = h.replace(/^---$/gm,'<hr>');
  h = h.replace(/^[\*\-] (.+)$/gm,'<li>$1</li>').replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  h = h.replace(/(<li>[\s\S]+?<\/li>)+/g, s => '<ul>' + s + '</ul>');
  h = h.replace(/\n\n/g,'</p><p>');
  h = '<p>' + h + '</p>';
  h = h.replace(/<p>\s*(<h[123]>)/g,'$1').replace(/(<\/h[123]>)\s*<\/p>/g,'$1');
  h = h.replace(/<p>\s*(<div)/g,'$1').replace(/(<\/div>)\s*<\/p>/g,'$1');
  h = h.replace(/<p>\s*(<ul>)/g,'$1').replace(/(<\/ul>)\s*<\/p>/g,'$1');
  h = h.replace(/<p>\s*(<hr>)\s*<\/p>/g,'$1');
  h = h.replace(/<p>\s*<\/p>/g,'');
  h = h.replace(/\n/g,'<br>');
  return h;
}

function applyCode(id) {
  const el = document.getElementById(id);
  if (el) vscode.postMessage({ command: 'applyCode', code: el.textContent });
}
function copyCode(id) {
  const el = document.getElementById(id);
  if (!el) return;
  vscode.postMessage({ command: 'copyCode', code: el.textContent, id });
}

function autoResize(el) { resize(el); el.addEventListener('input', () => resize(el)); }
function resize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 110) + 'px'; }

window.addEventListener('message', e => {
  const m = e.data;
  switch (m.command) {
    case 'setModel':
      document.getElementById('modelBadge').textContent = m.model;
      document.getElementById('statProvider').textContent = m.model.split('(')[1]?.replace(')','') || m.model.split('/')[0] || '?';
      logActivity('Model: ' + m.model, 'inf');
      break;
    case 'addMessage':
      addMsg(m.role, m.content, m.id);
      if (m.role === 'assistant') logActivity('Response received', 'ok');
      break;
    case 'startStreaming':
      curId = m.id; curContent = '';
      const el = addMsg('assistant', '', m.id);
      el.querySelector('.mc').innerHTML = '<div class="typing"><div class="dots"><span></span><span></span><span></span></div>&nbsp;Thinking…</div>';
      setStreaming(true);
      logActivity('Generating response…', 'inf');
      break;
    case 'streamChunk':
      curContent += m.content;
      const cel = document.getElementById('msg-' + m.id);
      if (cel) { cel.querySelector('.mc').innerHTML = md(curContent); scroll(); }
      break;
    case 'endStreaming':
      setStreaming(false);
      const fel = document.getElementById('msg-' + m.id);
      if (fel) { fel.querySelector('.mc').innerHTML = md(m.content); scroll(); }
      curId = ''; curContent = '';
      if (m.usage) { totalTokens += (m.usage.inputTokens||0) + (m.usage.outputTokens||0); updateStats(); }
      logActivity('Done', 'ok');
      break;
    case 'streamAborted':
      setStreaming(false);
      const ael = document.getElementById('msg-' + m.id);
      if (ael) { const mc = ael.querySelector('.mc'); if(mc) mc.innerHTML += '<br><em style="color:var(--error)">[Stopped]</em>'; }
      break;
    case 'showError':
      hideWelcome();
      addMsg('error', '⚠ ' + m.message);
      setStreaming(false);
      logActivity('Error: ' + (m.message||'').slice(0,40), 'err');
      break;
    case 'clearChat':
      document.getElementById('msgs').innerHTML = '';
      setStreaming(false); curId=''; curContent=''; codeCount=0; msgCount=0;
      updateStats();
      const w2 = document.createElement('div');
      w2.className = 'welcome'; w2.id = 'welcome';
      w2.innerHTML = '<div class="welcome-window"><div class="welcome-bar"><div class="w-dot r"></div><div class="w-dot y"></div><div class="w-dot g"></div><span class="welcome-title">timps v2.0 — new session</span></div><div class="welcome-body"><div class="welcome-robot"><svg viewBox="0 0 48 60" width="56" height="70" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="20" y="0" width="8" height="4" fill="#4A8C7A"/><rect x="6" y="8" width="36" height="26" rx="3" fill="#2D5A4F"/><rect x="9" y="11" width="30" height="20" rx="2" fill="#3D7A6A"/><rect x="12" y="14" width="7" height="7" fill="#E8E0B0"/><rect x="29" y="14" width="7" height="7" fill="#E8E0B0"/><rect x="14" y="24" width="20" height="3" fill="#E8E0B0"/><rect x="6" y="36" width="42" height="20" rx="3" fill="#C8BF8C"/><rect x="10" y="56" width="10" height="4" rx="1" fill="#1C1C1C"/><rect x="28" y="56" width="10" height="4" rx="1" fill="#1C1C1C"/></svg></div><h2>New Session</h2><p>Chat cleared. Ask me anything!</p></div></div>';
      document.getElementById('msgs').appendChild(w2);
      break;
    case 'memoryAudit':
      addMem(m.memories, 'Memory Audit');
      logActivity('Memory audit: ' + (m.memories||[]).length + ' items', 'inf');
      break;
    case 'blameResults':
      addMem(m.results, '!blame "' + (m.keyword||'') + '"');
      break;
    case 'systemMessage':
      hideWelcome();
      const sd = document.createElement('div');
      sd.className = 'msg system-msg';
      sd.textContent = m.text;
      document.getElementById('msgs').appendChild(sd);
      scroll();
      logActivity(m.text.slice(0,40));
      break;
    case 'copyConfirmed':
      const cb = document.getElementById('cp-' + m.id);
      if (cb) { cb.textContent = '✓ Copied!'; setTimeout(() => { cb.textContent = 'Copy'; }, 1800); }
      break;
  }
});

document.getElementById('inp').focus();
</script>
</body>
</html>`;
    }
}
function getNonce(): string {
    let t = '';
    const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) t += p[Math.floor(Math.random() * p.length)];
    return t;
}
