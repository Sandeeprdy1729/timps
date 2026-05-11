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
/* ── TIMPS Robot dark teal palette (matches CLI) ── */
:root {
  --bg:       #14140F;   /* very dark ink background */
  --bg2:      #1C1C14;   /* robot body dark surface */
  --bg3:      #252518;   /* slightly lighter surface */
  --bg-input: #1C1C14;   /* input background */
  --text:     #F5F0E1;   /* cream paper */
  --muted:    #64747A;   /* muted slate */
  --accent:   #4A8C7A;   /* robot screen mid-teal */
  --accent2:  #7EC8B8;   /* light teal highlight */
  --tan:      #C8BF8C;   /* robot body tan */
  --user-bg:  #1C2820;   /* user message bg — teal tint */
  --user-border: #2D5A4F;
  --err-bg:   #2A1414;
  --err-border: #C83838;
  --code-bg:  #0F0F0A;   /* dark code block */
}
/* ── Robot animations ── */
@keyframes robotFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes robotBlink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes fadeIn { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); height:100vh; display:flex; flex-direction:column; overflow:hidden; }

/* Header */
.header { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; background:var(--bg2); border-bottom:1px solid var(--user-border); flex-shrink:0; }
.logo { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; color:var(--accent); letter-spacing:0.03em; }
.logo-robot { animation:robotFloat 3s ease-in-out infinite; image-rendering:pixelated; }
.logo-robot-eye { animation:robotBlink 4s ease-in-out infinite; transform-origin:center; }
.model-badge { font-size:10px; background:var(--bg3); padding:2px 8px; border-radius:2px; color:var(--muted); border:1px solid var(--user-border); cursor:pointer; font-family:'JetBrains Mono',monospace; font-weight:600; }
.model-badge:hover { border-color:var(--accent); color:var(--accent); }
.header-actions { display:flex; gap:4px; }
.hbtn { background:var(--bg3); border:1px solid var(--user-border); color:var(--text); padding:4px 10px; border-radius:2px; cursor:pointer; font-size:11px; font-weight:600; transition:border-color 0.1s, color 0.1s; }
.hbtn:hover { border-color:var(--accent); color:var(--accent); }
.hbtn:active { opacity:0.7; }
.hbtn.danger { border-color:var(--err-border); color:var(--err-border); }

/* Skills bar */
.skills-bar { display:flex; gap:4px; padding:6px 10px; background:var(--bg2); border-bottom:1px solid var(--user-border); overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
.skills-bar::-webkit-scrollbar { display:none; }
.sbtn { display:flex; align-items:center; gap:4px; padding:4px 9px; background:var(--bg3); border:1px solid var(--user-border); border-radius:2px; color:var(--muted); font-size:11px; cursor:pointer; white-space:nowrap; font-weight:600; transition:border-color 0.1s, color 0.1s; }
.sbtn:hover { border-color:var(--accent); color:var(--accent); }

/* Messages */
.msgs { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; background:var(--bg); }
.msgs::-webkit-scrollbar { width:4px; } .msgs::-webkit-scrollbar-thumb { background:var(--user-border); border-radius:2px; }
.msg { max-width:88%; border-radius:2px; padding:10px 13px; line-height:1.65; font-size:13px; animation:fadeIn 0.18s ease; border-left:2px solid transparent; }
.msg.user { align-self:flex-end; background:var(--user-bg); border-color:var(--user-border); }
.msg.assistant { align-self:flex-start; background:var(--bg2); border-color:var(--accent); }
.msg.error { align-self:center; background:var(--err-bg); border-color:var(--err-border); color:var(--err-border); font-size:12px; }
.msg.system-msg { align-self:center; background:transparent; color:var(--muted); font-size:11px; font-style:italic; padding:3px 8px; border:none; }
.role-label { font-size:11px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:4px; }
.msg.user .role-label { color:var(--accent2); }
.msg.assistant .role-label { color:var(--accent); }

/* Code blocks */
.code-wrap { position:relative; margin:8px 0; border-radius:2px; overflow:hidden; border:1px solid var(--user-border); }
.code-head { display:flex; justify-content:space-between; align-items:center; background:var(--code-bg); padding:4px 12px; font-size:11px; color:var(--tan); }
.code-head .lang { text-transform:uppercase; font-weight:700; letter-spacing:0.8px; color:var(--tan); font-family:'JetBrains Mono',monospace; }
.code-btns { display:flex; gap:4px; }
.cbtn { background:transparent; border:1px solid #3a3a3a; color:#888; padding:2px 7px; border-radius:2px; cursor:pointer; font-size:10px; font-weight:600; }
.cbtn:hover { border-color:var(--accent2); color:var(--accent2); }
.cbtn.apply { border-color:var(--accent); color:var(--accent); }
.cbtn.apply:hover { background:rgba(74,140,122,0.15); }
.code-body { background:var(--code-bg); padding:12px; overflow-x:auto; font-family:'JetBrains Mono','Cascadia Code','Fira Code',monospace; font-size:12px; line-height:1.5; white-space:pre; color:#d4cfa8; }
.icode { background:var(--bg3); padding:1px 5px; border-radius:2px; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--accent2); border:1px solid var(--user-border); }

/* Memory cards */
.mem-card { background:var(--tan-pale,#EDE8D0); border-left:3px solid var(--accent); padding:7px 10px; margin:3px 0; font-size:12px; border-radius:0 2px 2px 0; }
.mem-meta { color:var(--muted); font-size:10px; margin-top:3px; font-family:'JetBrains Mono',monospace; }

/* Typing */
.typing { display:flex; align-items:center; gap:8px; padding:4px 0; color:var(--muted); font-size:12px; }
.dots { display:flex; gap:3px; }
.dots span { width:6px; height:6px; border-radius:50%; background:var(--accent); animation:bounce 1.2s infinite; }
.dots span:nth-child(2){animation-delay:.2s} .dots span:nth-child(3){animation-delay:.4s}

/* Welcome panel — dark teal style */
.welcome { text-align:center; padding:20px 16px; }
.welcome-window { background:var(--bg2); border:1px solid var(--user-border); border-radius:4px; overflow:hidden; max-width:360px; margin:0 auto; }
.welcome-bar { display:flex; align-items:center; gap:6px; padding:8px 12px; background:var(--bg3); border-bottom:1px solid var(--user-border); }
.welcome-dot { width:10px; height:10px; border-radius:50%; }
.welcome-dot.r { background:#ff5f57; } .welcome-dot.y { background:#febc2e; } .welcome-dot.g { background:#28c840; }
.welcome-title { font-size:11px; font-weight:600; color:var(--muted); flex:1; text-align:center; font-family:'JetBrains Mono',monospace; }
.welcome-body { padding:20px 16px; }
.welcome-robot { animation:robotFloat 3s ease-in-out infinite; display:inline-block; margin-bottom:10px; image-rendering:pixelated; }
.welcome h2 { font-size:18px; font-weight:700; color:var(--accent); margin-bottom:6px; }
.welcome p { color:var(--muted); font-size:12px; margin-bottom:14px; line-height:1.6; }
.qactions { display:flex; flex-direction:column; gap:6px; text-align:left; }
.qa { display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--bg3); border:1px solid var(--user-border); border-radius:2px; cursor:pointer; font-size:12px; transition:border-color 0.1s; }
.qa:hover { border-color:var(--accent); }
.qa-icon { font-size:15px; width:22px; text-align:center; }
.qa-title { font-weight:700; color:var(--text); font-size:12px; }
.qa-desc { color:var(--muted); font-size:11px; }

/* Input */
.input-area { display:flex; gap:8px; padding:10px 12px; background:var(--bg2); border-top:1px solid var(--user-border); flex-shrink:0; }
.input-area textarea { flex:1; background:var(--bg-input); border:1px solid var(--user-border); border-radius:2px; color:var(--text); padding:9px 12px; font-size:13px; font-family:inherit; resize:none; outline:none; min-height:38px; max-height:120px; line-height:1.4; }
.input-area textarea:focus { border-color:var(--accent); }
.input-area textarea::placeholder { color:var(--muted); }
.send-btn,.stop-btn { width:38px; height:38px; border-radius:2px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; align-self:flex-end; border:1px solid var(--user-border); font-weight:700; transition:opacity 0.1s; }
.send-btn { background:var(--accent); color:var(--bg); border-color:var(--accent); }
.send-btn:hover { opacity:0.85; }
.send-btn:disabled { opacity:0.35; cursor:not-allowed; }
.stop-btn { background:var(--err-border); color:#fff; border-color:var(--err-border); }
.stop-btn:hover { opacity:0.85; }
.hidden { display:none; }

/* MD formatting */
.mc strong { color:var(--accent2); font-weight:700; }
.mc em { color:var(--tan); }
.mc h1 { font-size:17px; color:var(--accent); margin:10px 0 5px; border-bottom:1px solid var(--user-border); padding-bottom:4px; }
.mc h2 { font-size:14px; color:var(--accent); margin:9px 0 4px; }
.mc h3 { font-size:13px; color:var(--accent2); margin:8px 0 4px; }
.mc ul,.mc ol { padding-left:18px; margin:5px 0; }
.mc li { margin:2px 0; }
.mc blockquote { border-left:2px solid var(--user-border); padding-left:10px; color:var(--muted); margin:6px 0; background:var(--bg3); }
.mc hr { border:none; border-top:1px solid var(--user-border); margin:10px 0; }
.mc a { color:var(--accent2); text-decoration:underline; }
.mc p { margin-bottom:6px; }
/* Respect user's reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .logo-robot, .welcome-robot { animation: none !important; }
  .logo-robot-eye { animation: none !important; }
  .dots span { animation: none !important; }
}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:8px">
    <div class="logo">
      <!-- Animated pixel robot logo — teal screen, cream eyes, tan body -->
      <svg class="logo-robot" viewBox="0 0 16 20" width="24" height="28" xmlns="http://www.w3.org/2000/svg">
        <!-- Head/screen -->
        <rect x="3" y="0" width="10" height="9" rx="1" fill="#2D5A4F"/>
        <rect x="4" y="1" width="8" height="7" rx="1" fill="#3D7A6A"/>
        <!-- Eyes (cream) -->
        <rect class="logo-robot-eye" x="5" y="3" width="2" height="2" fill="#E8E0B0"/>
        <rect class="logo-robot-eye" x="9" y="3" width="2" height="2" fill="#E8E0B0"/>
        <!-- Mouth -->
        <rect x="6" y="6" width="4" height="1" fill="#E8E0B0"/>
        <!-- Neck -->
        <rect x="5" y="9" width="1" height="2" fill="#C8BF8C"/>
        <rect x="10" y="9" width="1" height="2" fill="#C8BF8C"/>
        <!-- Body (tan) -->
        <rect x="2" y="11" width="12" height="6" rx="1" fill="#C8BF8C"/>
        <!-- Feet (dark) -->
        <rect x="4" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
        <rect x="9" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
      </svg>
      TIMPS
    </div>
    <span class="model-badge" id="modelBadge" title="Click to change model">Loading...</span>
  </div>
  <div class="header-actions">
    <button class="hbtn" onclick="sendQ('Review my code for issues')">Review</button>
    <button class="hbtn" onclick="sendQ('Explain this file')">Explain</button>
    <button class="hbtn danger" onclick="clearChat()">Clear</button>
  </div>
</div>

<div class="skills-bar">
  <button class="sbtn" onclick="sendQ('Fix the bug in my selected code. Explain the root cause first.')">🐛 Fix Bug</button>
  <button class="sbtn" onclick="sendQ('Review this code. Use 🔴 Critical / 🟡 Warning / 🟢 Suggestion format.')">👁 Review</button>
  <button class="sbtn" onclick="sendQ('Explain this code step by step.')">💡 Explain</button>
  <button class="sbtn" onclick="sendQ('Refactor this code for better readability and performance.')">🔧 Refactor</button>
  <button class="sbtn" onclick="sendQ('Write comprehensive unit tests with edge cases.')">🧪 Tests</button>
  <button class="sbtn" onclick="sendQ('Add JSDoc/docstring documentation to all functions.')">📝 Docs</button>
  <button class="sbtn" onclick="sendQ('Optimize this code for performance. Show complexity comparison.')">⚡ Optimize</button>
  <button class="sbtn" onclick="sendQ('Security audit: check for injection, XSS, hardcoded secrets, auth flaws.')">🔒 Security</button>
  <button class="sbtn" onclick="sendQ('!audit')">🧠 Memory</button>
</div>

<div class="msgs" id="msgs">
  <div class="welcome" id="welcome">
    <div class="welcome-window">
      <div class="welcome-bar">
        <div class="welcome-dot r"></div>
        <div class="welcome-dot y"></div>
        <div class="welcome-dot g"></div>
        <span class="welcome-title">timps — coding agent</span>
      </div>
      <div class="welcome-body">
        <!-- Animated pixel robot — teal screen, tan body, cream eyes -->
        <div class="welcome-robot">
          <svg viewBox="0 0 16 20" width="80" height="100" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">
            <!-- Head/screen (teal) -->
            <rect x="3" y="0" width="10" height="9" rx="1" fill="#2D5A4F"/>
            <!-- Screen inner -->
            <rect x="4" y="1" width="8" height="7" rx="1" fill="#3D7A6A"/>
            <!-- Eyes (cream/pale) -->
            <rect x="5" y="3" width="2" height="2" fill="#E8E0B0"/>
            <rect x="9" y="3" width="2" height="2" fill="#E8E0B0"/>
            <!-- Mouth (cream) -->
            <rect x="6" y="6" width="4" height="1" fill="#E8E0B0"/>
            <!-- Neck connectors (tan) -->
            <rect x="5" y="9" width="1" height="2" fill="#C8BF8C"/>
            <rect x="10" y="9" width="1" height="2" fill="#C8BF8C"/>
            <!-- Body (tan) -->
            <rect x="2" y="11" width="12" height="6" rx="1" fill="#C8BF8C"/>
            <!-- Arm left (tan) -->
            <rect x="0" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <!-- Arm right (tan) -->
            <rect x="14" y="12" width="2" height="3" rx="1" fill="#C8BF8C"/>
            <!-- Feet (dark) -->
            <rect x="4" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
            <rect x="9" y="17" width="3" height="3" rx="1" fill="#1C1C1C"/>
          </svg>
        </div>
        <h2>TIMPS Agent</h2>
        <p>Open-source AI coding partner · Memory-aware · Runs locally</p>
        <div class="qactions">
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
            <div><div class="qa-title">Write Tests</div><div class="qa-desc">Generate comprehensive test cases</div></div>
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

<div class="input-area">
  <textarea id="inp" placeholder="Ask TIMPS... (!audit, !blame &lt;kw&gt;, !forget &lt;kw&gt;)" rows="1" onkeydown="onKey(event)"></textarea>
  <button class="send-btn" id="sendBtn" onclick="send()">↑</button>
  <button class="stop-btn hidden" id="stopBtn" onclick="stop()">■</button>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let streaming = false, curId = '', curContent = '', codeCount = 0;

window.addEventListener('load', () => {
    vscode.postMessage({ command: 'getConfig' }); // FIX #1
    autoResize(document.getElementById('inp'));
});

function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}
function send() {
    const el = document.getElementById('inp');
    const txt = el.value.trim();
    if (!txt || streaming) return;
    el.value = ''; resize(el);
    vscode.postMessage({ command: 'sendMessage', text: txt });
}
function sendQ(txt) {
    if (streaming) return;
    vscode.postMessage({ command: 'sendMessage', text: txt });
}
function clearChat() { vscode.postMessage({ command: 'clearChat' }); }
function stop() { vscode.postMessage({ command: 'stopGeneration' }); }

function setStreaming(v) {
    streaming = v;
    document.getElementById('sendBtn').classList.toggle('hidden', v);
    document.getElementById('stopBtn').classList.toggle('hidden', !v);
}

function hideWelcome() {
    const w = document.getElementById('welcome');
    if (w) { w.style.display='none'; }
}

function addMsg(role, content, id) {
    hideWelcome();
    const c = document.getElementById('msgs');
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    if (id) d.id = 'msg-' + id;
    const label = role === 'user' ? '❯ You' : role === 'assistant' ? '🤖 TIMPS' : '';
    let html = label ? '<div class="role-label">'+label+'</div>' : '';
    html += '<div class="mc">' + (role === 'assistant' ? md(content) : esc(content).replace(/\\n/g,'<br>')) + '</div>';
    d.innerHTML = html;
    c.appendChild(d);
    scroll();
    return d;
}

function addMem(mems, title) {
    hideWelcome();
    const c = document.getElementById('msgs');
    const d = document.createElement('div');
    d.className = 'msg assistant';
    let html = '<div class="role-label">🤖 TIMPS — ' + esc(title) + '</div><div class="mc">';
    if (!mems || mems.length === 0) {
        html += '<em>No memories found.</em>';
    } else {
        for (const m of mems) {
            const stars = '⭐'.repeat(Math.min(m.importance||1,5));
            html += '<div class="mem-card"><b>['+esc(m.id||'?')+'] '+esc((m.type||'').toUpperCase())+'</b> '+stars+'<br>'+esc(m.content)+'<div class="mem-meta">'+new Date(m.createdAt||Date.now()).toLocaleString()+' · accessed '+( m.accessCount||0)+'x · '+((m.tags||[]).join(', ')||'no tags')+'</div></div>';
        }
    }
    d.innerHTML = html + '</div>';
    c.appendChild(d);
    scroll();
}

function scroll() { const c=document.getElementById('msgs'); c.scrollTop=c.scrollHeight; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// FIX #2: markdown regex corrected (was double-escaped, breaking code blocks)
function md(text) {
    let h = esc(text);
    // Fenced code blocks
    h = h.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, (_, lang, code) => {
        const id = 'c' + (++codeCount);
        const l = lang || 'code';
        return '<div class="code-wrap">' +
            '<div class="code-head"><span class="lang">'+l+'</span>' +
            '<div class="code-btns">' +
            '<button class="cbtn apply" onclick="applyCode(\''+id+'\')">✓ Apply</button>' +
            '<button class="cbtn" id="cp-'+id+'" onclick="copyCode(\''+id+'\')">Copy</button>' +
            '</div></div>' +
            '<div class="code-body" id="'+id+'">'+code+'</div></div>';
    });
    // Inline code
    h = h.replace(/\`([^\`\n]+)\`/g, '<code class="icode">$1</code>');
    // Headers
    h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
    // Bold/italic
    h = h.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
    // Links
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
    // Blockquote
    h = h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
    // HR
    h = h.replace(/^---$/gm,'<hr>');
    // Lists
    h = h.replace(/^[\*\-] (.+)$/gm,'<li>$1</li>').replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
    h = h.replace(/(<li>[\s\S]+?<\/li>)+/g, s => '<ul>' + s + '</ul>');
    // Paragraphs
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

function autoResize(el) {
    resize(el);
    el.addEventListener('input', () => resize(el));
}
function resize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

window.addEventListener('message', e => {
    const m = e.data;
    switch (m.command) {
        case 'setModel':
            document.getElementById('modelBadge').textContent = m.model;
            break;
        case 'addMessage':
            addMsg(m.role, m.content, m.id);
            break;
        case 'startStreaming':
            curId = m.id; curContent = '';
            const el = addMsg('assistant', '', m.id);
            el.querySelector('.mc').innerHTML = '<div class="typing"><div class="dots"><span></span><span></span><span></span></div> Thinking...</div>';
            setStreaming(true);
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
            break;
        case 'streamAborted':
            setStreaming(false);
            const ael = document.getElementById('msg-' + m.id);
            if (ael) { const mc = ael.querySelector('.mc'); if(mc) mc.innerHTML += '<br><span style="color:#C83838;font-style:italic">[Stopped]</span>'; }
            break;
        case 'showError':
            hideWelcome();
            addMsg('error', '⚠️ ' + m.message);
            setStreaming(false);
            break;
        case 'clearChat':
            document.getElementById('msgs').innerHTML = '';
            setStreaming(false); curId=''; curContent=''; codeCount=0;
            // Re-add welcome with robot
            const w = document.createElement('div');
            w.className='welcome'; w.id='welcome';
            w.innerHTML='<div class="welcome-window"><div class="welcome-bar"><div class="welcome-dot r"></div><div class="welcome-dot y"></div><div class="welcome-dot g"></div><span class="welcome-title">timps — chat</span></div><div class="welcome-body"><div class="welcome-robot"><svg viewBox="0 0 48 56" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated"><rect x="20" y="0" width="8" height="4" fill="#4A8C7A"/><rect x="6" y="6" width="36" height="26" rx="3" fill="#2D5A4F"/><rect x="9" y="9" width="30" height="20" rx="2" fill="#3D7A6A"/><rect x="13" y="13" width="6" height="6" fill="#C8BF8C"/><rect x="29" y="13" width="6" height="6" fill="#C8BF8C"/><rect x="13" y="22" width="22" height="2" fill="#C8BF8C"/><rect x="9" y="32" width="30" height="16" rx="2" fill="#C8BF8C"/></svg></div><h2>TIMPS Agent</h2><p>Chat cleared. Ready for a new session.</p></div></div>';
            document.getElementById('msgs').appendChild(w);
            break;
        case 'memoryAudit':
            addMem(m.memories, 'Memory Audit (!audit)');
            break;
        case 'blameResults':
            addMem(m.results, '!blame "' + (m.keyword||'') + '"');
            break;
        case 'systemMessage':
            hideWelcome();
            const sd = document.createElement('div');
            sd.className='msg system-msg';
            sd.textContent = m.text;
            document.getElementById('msgs').appendChild(sd);
            scroll();
            break;
        case 'copyConfirmed':
            const cb = document.getElementById('cp-' + m.id);
            if (cb) { cb.textContent='✓ Copied!'; setTimeout(()=>{ cb.textContent='Copy'; },2000); }
            break;
        case 'applyConfirmed':
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
