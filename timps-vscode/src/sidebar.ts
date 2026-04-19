// ============================================================
// TIMPS Sidebar — Persistent Activity Bar Panel
// ============================================================
import * as vscode from 'vscode';
import { TIMPsMemory } from './memory';

export class TIMPsSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _ctx: vscode.ExtensionContext,
        private readonly _memory: TIMPsMemory
    ) {}

    resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this._getHtml();

        view.webview.onDidReceiveMessage(async msg => {
            switch (msg.type) {
                case 'openChat':
                    vscode.commands.executeCommand('timps.chat');
                    break;
                case 'runSkill':
                    vscode.commands.executeCommand(`timps.${msg.skill}`);
                    break;
                case 'audit':
                    vscode.commands.executeCommand('timps.auditMemory');
                    break;
                case 'setup':
                    vscode.commands.executeCommand('timps.setup');
                    break;
                case 'status':
                    vscode.commands.executeCommand('timps.status');
                    break;
            }
        });
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 12px 8px;
    font-size: 12px;
}
.logo {
    font-size: 15px;
    font-weight: 700;
    color: #7c6af7;
    margin-bottom: 4px;
    letter-spacing: -0.5px;
}
.sub { color: var(--vscode-descriptionForeground); font-size: 11px; margin-bottom: 16px; }
.section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--vscode-descriptionForeground);
    margin: 14px 0 6px;
}
.btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: transparent;
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 6px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    margin-bottom: 4px;
    text-align: left;
    transition: all 0.15s;
}
.btn:hover {
    background: rgba(124,106,247,0.12);
    border-color: #7c6af7;
}
.btn .icon { font-size: 14px; width: 18px; text-align: center; }
.btn .label { flex: 1; }
.btn .kbd {
    font-size: 9px;
    color: var(--vscode-descriptionForeground);
    background: rgba(255,255,255,0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: monospace;
}
.primary {
    background: rgba(124,106,247,0.15);
    border-color: #7c6af7;
    color: #a78bfa;
}
.primary:hover { background: rgba(124,106,247,0.3); }
.divider { border: none; border-top: 1px solid var(--vscode-panel-border, #333); margin: 12px 0; }
.tip {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    padding: 8px;
    background: rgba(124,106,247,0.05);
    border-left: 2px solid #7c6af7;
    border-radius: 0 4px 4px 0;
    line-height: 1.5;
    margin-top: 8px;
}
</style>
</head>
<body>
<div class="logo">⚡ TIMPS</div>
<div class="sub">AI Coding Agent v2.1</div>

<div class="section-title">Quick Actions</div>
<button class="btn primary" onclick="send('openChat')">
    <span class="icon">💬</span><span class="label">Open Chat</span><span class="kbd">⌘⇧T</span>
</button>

<div class="section-title">Code Skills</div>
<button class="btn" onclick="send('runSkill','fix')">
    <span class="icon">🐛</span><span class="label">Fix Bug</span><span class="kbd">⌘⇧F</span>
</button>
<button class="btn" onclick="send('runSkill','explain')">
    <span class="icon">💡</span><span class="label">Explain Code</span><span class="kbd">⌘⇧E</span>
</button>
<button class="btn" onclick="send('runSkill','refactor')">
    <span class="icon">🔧</span><span class="label">Refactor</span><span class="kbd">⌘⇧R</span>
</button>
<button class="btn" onclick="send('runSkill','review')">
    <span class="icon">👁</span><span class="label">Code Review</span>
</button>
<button class="btn" onclick="send('runSkill','test')">
    <span class="icon">🧪</span><span class="label">Write Tests</span><span class="kbd">⌘⇧U</span>
</button>
<button class="btn" onclick="send('runSkill','docs')">
    <span class="icon">📝</span><span class="label">Generate Docs</span>
</button>
<button class="btn" onclick="send('runSkill','optimize')">
    <span class="icon">⚡</span><span class="label">Optimize</span>
</button>
<button class="btn" onclick="send('runSkill','security')">
    <span class="icon">🔒</span><span class="label">Security Audit</span>
</button>
<button class="btn" onclick="send('runSkill','generate')">
    <span class="icon">✨</span><span class="label">Generate Code</span>
</button>

<div class="section-title">Memory (!commands)</div>
<button class="btn" onclick="send('audit')">
    <span class="icon">🧠</span><span class="label">!audit — View Memories</span>
</button>

<hr class="divider"/>

<div class="section-title">Settings</div>
<button class="btn" onclick="send('status')">
    <span class="icon">🔍</span><span class="label">Check Status</span>
</button>
<button class="btn" onclick="send('setup')">
    <span class="icon">⚙️</span><span class="label">Setup / Install Model</span>
</button>

<div class="tip">
    💡 Select code first, then click a skill.<br/>
    Type <strong>!audit</strong>, <strong>!blame</strong>, or <strong>!forget</strong> in chat.
</div>

<script>
const vscode = acquireVsCodeApi();
function send(type, skill) {
    vscode.postMessage({ type, skill });
}
</script>
</body>
</html>`;
    }
}
